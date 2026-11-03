import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { NewsletterSignup } from "../src/newsletter-signup";
import {
  maskReservationDate,
  publicApiError,
  reservationDate,
} from "../src/public-form-api";
import { ReservationForm } from "../src/reservation-form";

const originalFetch = globalThis.fetch;
const publicApi = async () => ({ shopvento: true, locationId: 1 });
const ScriptComponent = () => null;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  delete window.turnstile;
});
function challenge() {
  window.turnstile = {
    render: (_element, options) => {
      queueMicrotask(() => options.callback?.("test-token"));
      return "widget";
    },
    getResponse: () => "test-token",
    reset: () => {},
  };
}
test("strict reservation dates mask digits and reject calendar overflow", () => {
  expect(maskReservationDate("12122026")).toBe("12.12.2026");
  expect(reservationDate("12.12.2026")).toBe("2026-12-12");
  expect(() => reservationDate("31.02.2026")).toThrow();
  expect(() => reservationDate("2026-12-12")).toThrow();
});
test("newsletter account adapter preserves pending DOI and renders overridden copy", async () => {
  let calls = 0;
  const view = render(
    <NewsletterSignup
      siteKey="test"
      onSubscribe={async () => {
        calls++;
      }}
      labels={{ "Newsletter abonnieren": "Subscribe" }}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Subscribe" }));
  await waitFor(() =>
    expect(view.getByRole("status").textContent).toContain("Bitte bestätige"),
  );
  expect(calls).toBe(1);
});
test("automatic guest newsletter consumes consent once and sends the explicit source and challenge", async () => {
  challenge();
  let attempts = 0;
  const bodies: unknown[] = [];
  globalThis.fetch = (async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({});
  }) as typeof fetch;
  const automatic = {
    onAttempt: () => {
      attempts++;
      return true;
    },
  };
  const props = {
    siteKey: "test",
    publicApi,
    ScriptComponent,
    automatic,
    initialEmail: "guest@example.invalid",
    source: "reservation" as const,
  };
  const view = render(<NewsletterSignup {...props} />);
  await waitFor(() => expect(bodies).toHaveLength(1));
  view.rerender(<NewsletterSignup {...props} />);
  expect(attempts).toBe(1);
  expect(bodies[0]).toEqual({
    email: "guest@example.invalid",
    source: "reservation",
    turnstile_token: "test-token",
  });
});
test("newsletter account cooldown remains visible and retryable", async () => {
  const view = render(
    <NewsletterSignup
      siteKey="test"
      onSubscribe={async () => {
        throw Object.assign(new Error("cooldown"), { status: 429 });
      }}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Newsletter abonnieren" }));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toContain("fünf Minuten"),
  );
  expect(view.getByRole("button").hasAttribute("disabled")).toBe(false);
});
test("reservation uses runtime settings and posts a normalized date and time", async () => {
  challenge();
  const posts: unknown[] = [];
  globalThis.fetch = (async (url, init) => {
    if (String(url).includes("settings"))
      return Response.json({
        ready: true,
        turnstile_site_key: "test",
        online_party_min: 2,
        online_party_max: 8,
      });
    posts.push(JSON.parse(String(init?.body)));
    return Response.json({ status: "confirmed" });
  }) as typeof fetch;
  const view = render(
    <ReservationForm
      siteKey="test"
      publicApi={publicApi}
      ScriptComponent={ScriptComponent}
      accountEnabled={false}
      labels={{ "Jetzt reservieren": "Reserve" }}
    />,
  );
  await waitFor(() =>
    expect(view.container.querySelectorAll("#resv-guests option").length).toBe(
      8,
    ),
  );
  const fill = (id: string, value: string) =>
    fireEvent.change(view.container.querySelector(id)!, { target: { value } });
  fill("#resv-name", "Alex Guest");
  fill("#resv-email", "alex@example.invalid");
  fill("#resv-date", "12122026");
  fill("#resv-time", "1830");
  fireEvent.submit(view.container.querySelector("form")!);
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0]).toMatchObject({
    franchise_location_id: 1,
    date: "2026-12-12",
    time: "18:30",
    num_guests: 2,
    guest_name: "Alex Guest",
    turnstile_token: "test-token",
  });
  await waitFor(() =>
    expect(view.getByText("✓ Tisch reserviert")).toBeDefined(),
  );
});
test("closed reservation dates do not submit and focus their invalid field", async () => {
  challenge();
  let posts = 0;
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === "POST") posts++;
    return Response.json({
      ready: true,
      turnstile_site_key: "test",
      online_party_min: 2,
      online_party_max: 8,
      opening_exceptions: [
        { from: "2026-12-12", until: "2026-12-12", label: "Closed" },
      ],
    });
  }) as typeof fetch;
  const view = render(
    <ReservationForm
      siteKey="test"
      publicApi={publicApi}
      ScriptComponent={ScriptComponent}
      accountEnabled={false}
    />,
  );
  await waitFor(() =>
    expect(view.container.querySelectorAll("#resv-guests option").length).toBe(
      8,
    ),
  );
  const date = view.container.querySelector<HTMLInputElement>("#resv-date")!;
  fireEvent.change(view.container.querySelector("#resv-name")!, {
    target: { value: "Alex" },
  });
  fireEvent.change(view.container.querySelector("#resv-email")!, {
    target: { value: "alex@example.invalid" },
  });
  fireEvent.change(date, { target: { value: "12122026" } });
  fireEvent.submit(view.container.querySelector("form")!);
  await waitFor(() => expect(date.getAttribute("aria-invalid")).toBe("true"));
  expect(document.activeElement).toBe(date);
  expect(posts).toBe(0);
});

test("reservation calendar errors use the host labels", async () => {
  challenge();
  globalThis.fetch = (async () =>
    Response.json({
      ready: true,
      turnstile_site_key: "test",
      online_party_min: 2,
      online_party_max: 8,
    })) as unknown as typeof fetch;
  const view = render(
    <ReservationForm
      siteKey="test"
      publicApi={publicApi}
      ScriptComponent={ScriptComponent}
      accountEnabled={false}
      labels={{ "Bitte gib ein gültiges Datum ein.": "Invalid calendar date" }}
    />,
  );
  fireEvent.change(view.container.querySelector("#resv-date")!, {
    target: { value: "31022026" },
  });
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toBe("Invalid calendar date"),
  );
});

test("public API helpers localize their own validation and status messages", () => {
  expect(() => reservationDate("invalid", "en-GB")).toThrow(
    "Please enter the date as DD/MM/YYYY.",
  );
  for (const code of [403, 409, 422, 429, 500])
    expect(publicApiError(code, "en-GB")).not.toMatch(
      /Bitte|Plätze|Anfrage|Sicherheitsprüfung/,
    );
});
test("reservation date confirms the parsed day and month visibly", () => {
  for (const [locale, expected] of [
    ["en-US", "December 11, 2026"],
    ["en-GB", "12 November 2026"],
    ["de", "12. November 2026"],
  ]) {
    const view = render(
      <ReservationForm
        locale={locale}
        siteKey=""
        publicApi={publicApi}
        ScriptComponent={ScriptComponent}
      />,
    );
    const input = view.container.querySelector('input[name="date"]');
    if (!input) throw new Error("Missing date field");
    fireEvent.change(input, {
      target: { value: locale === "de" ? "12.11.2026" : "12/11/2026" },
    });
    expect(view.container.textContent).toContain(expected);
    cleanup();
  }
});

test("localized public helpers retain host message overrides", () => {
  expect(
    publicApiError(422, "en-GB", {
      "Bitte prüfe Deine Angaben und die zulässige Personenzahl.":
        "Host party error",
    }),
  ).toBe("Host party error");
  expect(() =>
    reservationDate("31/02/2026", "en-GB", {
      "Bitte gib ein gültiges Datum ein.": "Host date error",
    }),
  ).toThrow("Host date error");
});

test("newsletter empty and malformed email errors persist, translate and focus the field", async () => {
  const view = render(
    <NewsletterSignup
      siteKey="test"
      ScriptComponent={ScriptComponent}
      labels={{ "Bitte gib Deine E-Mail-Adresse ein.": "Email required" }}
    />,
  );
  const form = view.container.querySelector("form")!;
  const email = view.getByRole("textbox", { name: "E-Mail" });
  expect(form.noValidate).toBe(true);
  fireEvent.submit(form);
  expect(email.getAttribute("aria-invalid")).toBe("true");
  const errorId = email.getAttribute("aria-describedby")!;
  expect(document.getElementById(errorId)?.textContent).toBe("Email required");
  expect(document.activeElement).toBe(email);
  fireEvent.blur(email);
  expect(document.getElementById(errorId)?.textContent).toBe("Email required");
  fireEvent.change(email, { target: { value: "invalid" } });
  fireEvent.submit(form);
  expect(document.getElementById(errorId)?.textContent).toBe(
    "Bitte gib eine gültige E-Mail-Adresse ein.",
  );
  fireEvent.change(email, { target: { value: "guest@example.invalid" } });
  fireEvent.submit(form);
  expect(email.getAttribute("aria-invalid")).toBe("false");
  expect(email.hasAttribute("aria-describedby")).toBe(false);
});

test("reservation validates all required fields, focuses in field order and clears corrected errors", async () => {
  challenge();
  const posts: unknown[] = [];
  globalThis.fetch = (async (_url, init) => {
    posts.push(JSON.parse(String(init?.body)));
    return Response.json({ ok: true });
  }) as typeof fetch;
  const view = render(
    <ReservationForm
      siteKey="test"
      publicApi={async () => ({ shopvento: false, locationId: 1 })}
      ScriptComponent={ScriptComponent}
      accountEnabled={false}
      labels={{ "Bitte gib Deinen Namen ein.": "Name required" }}
    />,
  );
  const form = view.container.querySelector("form")!;
  expect(form.noValidate).toBe(true);
  const field = (name: string) =>
    view.container.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  fireEvent.submit(form);
  for (const name of ["name", "email", "date", "time"]) {
    expect(field(name).getAttribute("aria-invalid")).toBe("true");
    const id = field(name).getAttribute("aria-describedby")!;
    expect(document.getElementById(id)?.textContent?.length).toBeGreaterThan(0);
  }
  expect(document.activeElement).toBe(field("name"));
  expect(view.getByText("Name required")).toBeDefined();
  fireEvent.change(field("name"), { target: { value: "   " } });
  fireEvent.submit(form);
  expect(document.activeElement).toBe(field("name"));
  fireEvent.change(field("name"), { target: { value: "Alex" } });
  fireEvent.change(field("email"), { target: { value: "bad" } });
  fireEvent.submit(form);
  expect(document.activeElement).toBe(field("email"));
  expect(
    view.getByText("Bitte gib eine gültige E-Mail-Adresse ein."),
  ).toBeDefined();
  fireEvent.change(field("email"), {
    target: { value: "alex@example.invalid" },
  });
  fireEvent.change(field("date"), { target: { value: "1212" } });
  fireEvent.change(field("time"), { target: { value: "29:99" } });
  fireEvent.submit(form);
  expect(document.activeElement).toBe(field("date"));
  fireEvent.change(field("date"), { target: { value: "12122026" } });
  fireEvent.submit(form);
  expect(document.activeElement).toBe(field("time"));
  expect(posts).toHaveLength(0);
  fireEvent.change(field("time"), { target: { value: "1830" } });
  const guests = view.getByRole("combobox");
  fireEvent.change(guests, { target: { value: "" } });
  fireEvent.submit(form);
  expect(document.activeElement).toBe(guests);
  expect(guests.getAttribute("aria-invalid")).toBe("true");
  expect(
    document.getElementById(guests.getAttribute("aria-describedby") ?? "")
      ?.textContent,
  ).toBe("Bitte wähle eine Personenzahl aus.");
  expect(posts).toHaveLength(0);
  fireEvent.change(guests, { target: { value: "2" } });
  fireEvent.submit(form);
  for (const name of ["name", "email", "date", "time"]) {
    expect(field(name).getAttribute("aria-invalid")).toBe("false");
  }
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0]).toEqual({
    name: "Alex",
    email: "alex@example.invalid",
    phone: "",
    date: "2026-12-12",
    time: "18:30",
    guests: "2",
    message: "",
    newsletter: false,
    turnstileToken: "test-token",
  });
  await waitFor(() =>
    expect(view.getByText("✓ Anfrage gesendet")).toBeDefined(),
  );
});

test("public form inline links have a persistent underline", async () => {
  const view = render(
    <>
      <NewsletterSignup siteKey="test" ScriptComponent={ScriptComponent} />
      <ReservationForm
        siteKey="test"
        publicApi={async () => ({ shopvento: false, locationId: 1 })}
        ScriptComponent={ScriptComponent}
        accountEnabled={false}
        groupInquiryHref="/groups"
      />
    </>,
  );
  await waitFor(() => expect(window.turnstile).toBeUndefined());
  for (const link of view.getAllByRole("link")) {
    expect(link.style.textDecoration).toBe("underline");
  }
});

test("English newsletter errors use the shipped catalogue and isolated descriptions", () => {
  const view = render(
    <>
      <NewsletterSignup
        siteKey="test"
        locale="en"
        ScriptComponent={ScriptComponent}
      />
      <NewsletterSignup
        siteKey="test"
        locale="en"
        ScriptComponent={ScriptComponent}
      />
    </>,
  );
  const forms = view.container.querySelectorAll("form");
  for (const form of Array.from(forms)) fireEvent.submit(form);
  const emails = view.getAllByRole("textbox", { name: "Email" });
  const ids = emails.map((email) => email.getAttribute("aria-describedby"));
  expect(new Set(ids).size).toBe(2);
  for (const id of ids)
    expect(document.getElementById(id ?? "")?.textContent).toBe(
      "Please enter your email address.",
    );
});

test("submit focus observes committed field errors without submit-only alert bursts", async () => {
  const view = render(
    <>
      <ReservationForm
        siteKey="test"
        accountEnabled={false}
        publicApi={async () => ({ shopvento: false, locationId: 1 })}
        ScriptComponent={ScriptComponent}
      />
      <NewsletterSignup siteKey="test" ScriptComponent={ScriptComponent} />
    </>,
  );
  const captured: { invalid: string | null; error: string | null }[] = [];
  const reservationName = view.getByLabelText("Name *");
  const newsletterEmail = view.container.querySelector(
    '.sv-newsletter input[name="email"]',
  ) as HTMLInputElement;
  for (const field of [reservationName, newsletterEmail]) {
    field.addEventListener("focus", () =>
      captured.push({
        invalid: field.getAttribute("aria-invalid"),
        error:
          document.getElementById(field.getAttribute("aria-describedby") ?? "")
            ?.textContent ?? null,
      }),
    );
  }
  for (const form of Array.from(view.container.querySelectorAll("form")))
    fireEvent.submit(form);
  expect(captured).toEqual([
    { invalid: "true", error: "Bitte gib Deinen Namen ein." },
    { invalid: "true", error: "Bitte gib Deine E-Mail-Adresse ein." },
  ]);
  for (const selector of [
    "#resv-name-error",
    "#resv-email-error",
    ".sv-newsletter input[name=email]",
  ]) {
    const node = view.container.querySelector(selector);
    const error =
      node?.tagName === "INPUT"
        ? document.getElementById(node.getAttribute("aria-describedby") ?? "")
        : node;
    expect(error?.getAttribute("role")).toBeNull();
    expect((error as HTMLElement).style.color).toBe(
      "var(--sv-primary, #0b5cad)",
    );
  }
  // A new submit attempt must focus again even when the same field is invalid.
  newsletterEmail.blur();
  fireEvent.submit(newsletterEmail.closest("form") as HTMLFormElement);
  expect(captured).toHaveLength(3);
  await waitFor(() =>
    expect(view.container.querySelector("#resv-time-message")).toBeDefined(),
  );
});

test("empty time stays quiet on blur until submit while malformed entered time stays live", async () => {
  const view = render(
    <ReservationForm
      siteKey="test"
      accountEnabled={false}
      publicApi={async () => ({ shopvento: false, locationId: 1 })}
      ScriptComponent={ScriptComponent}
    />,
  );
  const time = view.getByLabelText("Uhrzeit *");
  fireEvent.blur(time);
  expect(time.getAttribute("aria-invalid")).toBe("false");
  expect(time.hasAttribute("aria-describedby")).toBe(false);
  fireEvent.change(time, { target: { value: "29:99" } });
  fireEvent.blur(time);
  expect(time.getAttribute("aria-invalid")).toBe("true");
  expect(view.getByRole("alert").textContent).toContain("gültige Uhrzeit");
  fireEvent.change(time, { target: { value: "" } });
  expect(time.getAttribute("aria-invalid")).toBe("false");
  fireEvent.submit(time.closest("form") as HTMLFormElement);
  expect(time.getAttribute("aria-invalid")).toBe("true");
  await waitFor(() =>
    expect(view.container.querySelector("#resv-date-message")).toBeDefined(),
  );
});
test.each(["de", "en"])(
  "a timed private-event closure focuses time and permits its ending boundary (%s)",
  async (locale) => {
    challenge();
    const posts: unknown[] = [];
    globalThis.fetch = (async (url, init) => {
      if (String(url).includes("settings"))
        return Response.json({
          ready: true,
          turnstile_site_key: "test",
          online_party_min: 2,
          online_party_max: 8,
          opening_exceptions: [
            {
              from: "2027-01-04",
              until: "2027-01-04",
              closed_from: "2027-01-04T17:00",
              closed_until: "2027-01-04T22:30",
              label: "geschlossene Gesellschaft",
            },
          ],
        });
      posts.push(JSON.parse(String(init?.body)));
      return Response.json({ status: "confirmed" });
    }) as typeof fetch;
    const view = render(
      <ReservationForm
        locale={locale}
        siteKey="test"
        publicApi={publicApi}
        ScriptComponent={ScriptComponent}
        accountEnabled={false}
      />,
    );
    await waitFor(() =>
      expect(
        view.container.querySelectorAll("#resv-guests option").length,
      ).toBe(8),
    );
    const fill = (selector: string, value: string) =>
      fireEvent.change(view.container.querySelector(selector)!, {
        target: { value },
      });
    fill("#resv-name", "Alex Guest");
    fill("#resv-email", "alex@example.invalid");
    fill("#resv-date", locale === "en" ? "01042027" : "04012027");
    fill("#resv-time", "1800");
    fireEvent.submit(view.container.querySelector("form")!);
    const date = view.container.querySelector<HTMLInputElement>("#resv-date")!;
    const time = view.container.querySelector<HTMLInputElement>("#resv-time")!;
    expect(date.getAttribute("aria-invalid")).not.toBe("true");
    expect(time.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(time);
    expect(
      view.getAllByText(/geschlossene Gesellschaft/).length,
    ).toBeGreaterThan(0);
    expect(posts).toHaveLength(0);
    fill("#resv-time", "2230");
    fireEvent.submit(view.container.querySelector("form")!);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ date: "2027-01-04", time: "22:30" });
  },
);

test("a fully closed date with a timed closure shows the date error for a valid time", async () => {
  challenge();
  let posts = 0;
  globalThis.fetch = (async (url, init) => {
    if (String(url).includes("settings"))
      return Response.json({
        ready: true,
        turnstile_site_key: "test",
        online_party_min: 2,
        online_party_max: 8,
        opening_exceptions: [
          { from: "2027-01-04", until: "2027-01-04", label: "Ruhetag" },
          {
            from: "2027-01-04",
            until: "2027-01-04",
            closed_from: "2027-01-04T17:00",
            closed_until: "2027-01-04T22:30",
          },
        ],
      });
    if (init?.method === "POST") posts++;
    return Response.json({ status: "confirmed" });
  }) as typeof fetch;
  const view = render(
    <ReservationForm
      siteKey="test"
      publicApi={publicApi}
      ScriptComponent={ScriptComponent}
      accountEnabled={false}
    />,
  );
  await waitFor(() =>
    expect(view.container.querySelectorAll("#resv-guests option").length).toBe(
      8,
    ),
  );
  for (const [id, value] of [
    ["#resv-name", "Alex Guest"],
    ["#resv-email", "alex@example.invalid"],
    ["#resv-date", "04012027"],
    ["#resv-time", "1200"],
  ]) {
    const input = view.container.querySelector(id);
    if (!input) throw new Error(`Missing input: ${id}`);
    fireEvent.change(input, { target: { value } });
  }
  const form = view.container.querySelector("form");
  if (!form) throw new Error("Missing reservation form");
  fireEvent.submit(form);
  expect(
    view.container.querySelector("#resv-date")?.getAttribute("aria-invalid"),
  ).toBe("true");
  expect(
    view.container.querySelector("#resv-time")?.getAttribute("aria-invalid"),
  ).not.toBe("true");
  expect(view.container.textContent).toContain("haben wir geschlossen");
  expect(view.container.textContent).not.toContain(
    "Bitte gib eine gültige Uhrzeit ein.",
  );
  expect(posts).toBe(0);
});
