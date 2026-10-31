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
