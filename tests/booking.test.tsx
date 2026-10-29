import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import {
  BookingApiError,
  berlinToday,
  bookingErrorMessage,
  bookingFieldErrors,
  createBookingClient,
  type Tasting,
  type Timewindow,
  windowBookable,
  windowTooSoon,
} from "../src/client";
import {
  BookingResult,
  DateTimePicker,
  EventBooking,
  TastingBooking,
} from "../src/components";
import { useBookingDraft, useSubmitBooking } from "../src/hooks";
import { Turnstile } from "../src/turnstile";

const variant: Tasting = {
  tasting_id: 1,
  tasting_name: "Wein und Käse",
  price: 7500,
  variant_id: "12345678-1234-1234-1234-123456789abc",
  variant_name: "Klassik",
  full_name: "Wein und Käse (Klassik)",
};
const futureDate = berlinToday(Date.now() + 30 * 24 * 60 * 60 * 1000);
const slot: Timewindow = {
  id: "57",
  timewindow_id: `series_booking_1_${futureDate}`,
  tasting_id: 1,
  franchise_location_id: 3,
  date: futureDate,
  start_time: "18:00:00",
  event_name: "Tasting",
  max_participants: 20,
  free_spots: 10,
  availabilityStatus: "available",
};
const response = {
  order_id: "order",
  order_number: "SV123",
  success: true,
  status: "success",
  checkout_url: "https://checkout.stripe.com/c/pay/test",
};
function fixture(
  options: {
    variants?: Tasting[];
    checkout?: string | null;
    slot?: Timewindow;
    windows?: Timewindow[];
    success?: boolean;
    direct?: boolean;
    guest?: boolean;
    failure?: unknown;
    envelope?: "detail" | "error";
    status?: number;
  } = {},
) {
  const fetcher = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST")
      return new Response(
        JSON.stringify(
          options.failure
            ? { [options.envelope ?? "detail"]: options.failure }
            : {
                ...response,
                success: options.success ?? true,
                checkout_url:
                  options.checkout === undefined
                    ? response.checkout_url
                    : options.checkout,
              },
        ),
        { status: options.failure ? (options.status ?? 400) : 200 },
      );
    const body = url.endsWith("/settings")
      ? {
          direct_booking_enabled: options.direct ?? true,
          guest_booking_enabled: options.guest ?? true,
        }
      : url.includes("timewindows")
        ? { timewindows: options.windows ?? [options.slot ?? slot], total: 1 }
        : url.endsWith("/locations")
          ? { locations: [{ id: 3, location_name: "Hauptstandort" }], total: 1 }
          : (options.variants ?? [variant]);
    return new Response(JSON.stringify(body));
  });
  return {
    fetcher,
    client: createBookingClient({
      baseUrl: "https://api.example",
      fetch: fetcher as unknown as typeof fetch,
    }),
  };
}
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
async function account(options: Parameters<typeof fixture>[0] = {}) {
  const { client, fetcher } = fixture(options);
  const redirect = mock();
  render(
    <TastingBooking
      baseUrl="https://api.example"
      tastingId={1}
      mode="account"
      client={client}
      termsUrl="/terms"
      privacyUrl="/privacy"
      onRedirect={redirect}
    />,
  );
  await screen.findByLabelText("Termin");
  fireEvent.change(screen.getByLabelText("Termin"), {
    target: { value: slot.timewindow_id },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  return { fetcher, redirect };
}
describe("booking flow", () => {
  test("account happy path uses backend price and redirects to Stripe", async () => {
    const { fetcher, redirect } = await account();
    expect(screen.getByText("75,00 €")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Zahlungspflichtig buchen" }),
    );
    await waitFor(() =>
      expect(redirect).toHaveBeenCalledWith(response.checkout_url),
    );
    const call = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      timewindow_id: slot.timewindow_id,
      seats: [{ variant_id: variant.variant_id }],
    });
  });
  test("a tasting without variants remains a valid native form", async () => {
    await account({
      variants: [{ ...variant, variant_id: null, variant_name: null }],
    });
    expect(
      (screen.getByLabelText("Variante") as HTMLSelectElement).checkValidity(),
    ).toBe(true);
  });
  test("fully voucher funded bookings show the order without redirecting", async () => {
    const { redirect } = await account({ checkout: null });
    fireEvent.click(
      screen.getByRole("button", { name: "Zahlungspflichtig buchen" }),
    );
    expect(await screen.findByText("Buchungsnummer: SV123")).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
  test("sold out disables the date and explains why submission is blocked", async () => {
    const { fetcher } = await account({
      slot: { ...slot, free_spots: 0, availabilityStatus: "not_available" },
    });
    expect(
      (
        screen.getByRole("option", {
          name: /0 freie Plätze/,
        }) as HTMLOptionElement
      ).disabled,
    ).toBe(true);
    fireEvent.submit(
      screen.getByRole("button").closest("form") as HTMLFormElement,
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "genügend freien Plätzen",
    );
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
  });
  test("backend deadline disables selection", async () => {
    await account({
      slot: { ...slot, booking_deadline: "2020-01-01T00:00:00Z" },
    });
    expect(
      (
        screen.getByRole("option", {
          name: /Buchungsfrist abgelaufen/,
        }) as HTMLOptionElement
      ).disabled,
    ).toBe(true);
  });
  test.each([
    [
      400,
      "Online kannst Du nur Termine buchen, die mindestens 24 Stunden in der Zukunft liegen. Bitte wähle einen späteren Termin.",
    ],
    [
      400,
      "Direktbuchungen sind derzeit nicht verfügbar. Bitte verwende einen Gutschein pro Platz.",
    ],
    [
      409,
      "Dieser Gutschein kann gerade nicht eingelöst werden. Bitte wende Dich an uns.",
    ],
    [400, "Jeder Gutscheincode darf nur einmal verwendet werden."],
    [
      404,
      "Diesen Termin konnten wir nicht finden. Bitte lade die Seite neu und wähle erneut.",
    ],
    [
      404,
      "Die gewählte Variante ist nicht mehr verfügbar. Bitte lade die Seite neu und wähle erneut.",
    ],
    [
      400,
      "Dieser Termin kann gerade nicht online gebucht werden. Bitte wähle einen anderen Termin oder kontaktiere uns.",
    ],
    [
      404,
      "Den Gutscheincode „FRIST10“ konnten wir nicht finden. Bitte prüfe Deine Eingabe.",
    ],
    [
      400,
      "Für diesen Termin sind nur noch 2 Plätze frei, Du möchtest 3 buchen. Bitte wähle einen anderen Termin.",
    ],
    [400, "Der Gutscheincode „ABC“ wurde bereits eingelöst."],
  ] as const)(
    "preserves backend %s detail %s and focuses it",
    async (status, detail) => {
      await account({ failure: detail, status });
      fireEvent.click(
        screen.getByRole("button", { name: "Zahlungspflichtig buchen" }),
      );
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe(detail);
      // Bun formats the entire happy-dom graph on a failed DOM-object assertion.
      // Focus effects may still be pending on the first poll on a busy CI runner.
      await waitFor(() => expect(document.activeElement === alert).toBe(true));
    },
  );
  test("voucher only setting rejects seats with no voucher", async () => {
    const { fetcher } = await account({ direct: false });
    expect(
      (screen.getByLabelText("Gutscheincode") as HTMLInputElement).required,
    ).toBe(true);
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Zahlungspflichtig buchen" })
        .closest("form") as HTMLFormElement,
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "für jeden Platz einen Gutschein",
    );
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
  });
  test.each([
    { guest: false },
    { direct: false },
    { guest: false, direct: false },
  ])("guest flags block the form: %j", async (flags) => {
    const { client } = fixture(flags);
    render(
      <TastingBooking
        baseUrl="https://api.example"
        tastingId={1}
        client={client}
        termsUrl="/terms"
        privacyUrl="/privacy"
      />,
    );
    expect(
      await screen.findByText(/Onlinebuchungen ohne Anmeldung/),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  test("guest submits contact, mixed seats and a fresh Turnstile token", async () => {
    const { client, fetcher } = fixture();
    const redirect = mock();
    const provider = {
      render: mock(
        (
          _element: HTMLElement,
          options: { callback: (token: string) => void },
        ) => {
          options.callback("verified");
          return "widget";
        },
      ),
      remove: mock(),
    };
    Object.assign(window, { turnstile: provider });
    render(
      <TastingBooking
        baseUrl="https://api.example"
        tastingId={1}
        client={client}
        termsUrl="/terms"
        privacyUrl="/privacy"
        turnstileSiteKey="site"
        onRedirect={redirect}
      />,
    );
    await screen.findByLabelText("Vorname");
    expect(screen.getByText(/z. B. \+49/)).toBeTruthy();
    expect(
      screen.getByLabelText("Anzahl Plätze").querySelectorAll("option"),
    ).toHaveLength(8);
    fireEvent.change(screen.getByLabelText("Termin"), {
      target: { value: slot.timewindow_id },
    });
    fireEvent.change(screen.getByLabelText("Anzahl Plätze"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getAllByLabelText("Gutscheincode (optional)")[0], {
      target: { value: " CODE " },
    });
    for (const [label, value] of [
      ["Vorname", "Ada"],
      ["Nachname", "Test"],
      ["E-Mail-Adresse", "test@example.com"],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.submit(
      screen.getByRole("button").closest("form") as HTMLFormElement,
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Bitte bestätige die Bedingungen",
    );
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() =>
      expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(redirect).toHaveBeenCalled());
    const call = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
    expect(String(call?.[0])).toEndWith("/bookings/guest");
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      first_name: "Ada",
      last_name: "Test",
      email: "test@example.com",
      turnstile_token: "verified",
      terms_privacy_accepted: true,
      seats: [
        { variant_id: variant.variant_id, voucher_code: "CODE" },
        { variant_id: variant.variant_id },
      ],
    });
    cleanup();
    expect(provider.remove).toHaveBeenCalledWith("widget");
    Object.assign(window, { turnstile: undefined });
  });
});
describe("draft and returns", () => {
  test("reload restores selected date, variants, vouchers and contact", async () => {
    const first = renderHook(() => useBookingDraft("installation:1"));
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    const draft = {
      timewindow_id: slot.timewindow_id,
      seats: [
        {
          variant_id: variant.variant_id ?? undefined,
          voucher_code: "VOUCHER",
        },
      ],
      contact: {
        first_name: "Ada",
        last_name: "Test",
        email: "ada@example.com",
      },
    };
    act(() => first.result.current.setDraft(draft));
    first.unmount();
    const second = renderHook(() => useBookingDraft("installation:1"));
    await waitFor(() => expect(second.result.current.ready).toBe(true));
    expect(second.result.current.draft).toEqual(draft);
  });
  test("malformed storage is discarded", async () => {
    sessionStorage.setItem("bad", "{invalid");
    const hook = renderHook(() => useBookingDraft("bad"));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.draft.seats).toEqual([{}]);
  });
  test("success return displays reference without claiming payment is confirmed", () => {
    render(
      <BookingResult url="/success?order_number=SV123" outcome="success" />,
    );
    expect(screen.getByText("Referenz: SV123")).toBeTruthy();
    expect(screen.getByText(/Deine Zahlung wird geprüft/)).toBeTruthy();
  });
  test("cancel return supports a session id and retry link", () => {
    render(
      <BookingResult
        url="/cancel?session_id=cs_123"
        outcome="cancel"
        retryUrl="/booking"
      />,
    );
    expect(screen.getByRole("link").getAttribute("href")).toBe("/booking");
    expect(screen.getByText("Referenz: cs_123")).toBeTruthy();
  });
  test("server rendering requires no browser globals", () => {
    expect(
      renderToString(
        <TastingBooking
          baseUrl="https://api.example"
          tastingId={1}
          termsUrl="/terms"
          privacyUrl="/privacy"
        />,
      ),
    ).toContain("Veranstaltungen werden geladen");
  });
});
test("rate limit and network mapping", () => {
  expect(bookingErrorMessage(new BookingApiError(429, "limit"))).toContain(
    "Zu viele Anfragen",
  );
  expect(bookingErrorMessage(new TypeError("fetch failed"))).toContain(
    "Verbindung",
  );
});

describe("review regressions", () => {
  test("a materialized date can be booked twice using its external booking identifier", async () => {
    const { fetcher, client } = fixture({ checkout: null });
    const draft = {
      timewindow_id: slot.timewindow_id,
      seats: [{ variant_id: variant.variant_id ?? undefined }],
      contact: { first_name: "", last_name: "", email: "" },
    };
    for (let i = 0; i < 2; i++) {
      const hook = renderHook(() => useSubmitBooking(client, () => {}));
      await act(async () => {
        await hook.result.current.submit(draft, false, "");
      });
      hook.unmount();
    }
    const posts = fetcher.mock.calls.filter(
      ([, init]) => init?.method === "POST",
    );
    expect(posts).toHaveLength(2);
    for (const [, init] of posts)
      expect(JSON.parse(String(init?.body)).timewindow_id).toBe(
        `series_booking_1_${futureDate}`,
      );
  });
  test("uses Berlin today including midnight and DST, and rejects elapsed starts", async () => {
    expect(berlinToday(Date.parse("2026-10-07T22:30:00Z"))).toBe("2026-10-08");
    expect(berlinToday(Date.parse("2026-01-07T23:30:00Z"))).toBe("2026-01-08");
    expect(
      windowBookable(
        { ...slot, date: "2026-10-08", start_time: "00:15:00" },
        1,
        Date.parse("2026-10-07T22:30:00Z"),
      ),
    ).toBe(false);
    const { fetcher } = await account({
      windows: [
        slot,
        { ...slot, id: "old", timewindow_id: "past", date: "2020-01-01" },
      ],
    });
    expect(screen.queryByRole("option", { name: /2020/ })).toBeNull();
    expect(
      String(
        fetcher.mock.calls.find(([url]) =>
          String(url).includes("timewindows"),
        )?.[0],
      ),
    ).toContain(`start_date=${berlinToday()}`);
  });
  test("filters and labels locations", async () => {
    const { fetcher, client } = fixture({
      windows: [
        slot,
        {
          ...slot,
          id: "58",
          timewindow_id: "elsewhere",
          franchise_location_id: 4,
        },
      ],
    });
    render(
      <TastingBooking
        baseUrl="https://api.example"
        tastingId={1}
        locationId={3}
        mode="account"
        client={client}
        termsUrl="/terms"
        privacyUrl="/privacy"
      />,
    );
    expect(
      await screen.findByRole("option", { name: /Hauptstandort/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Standort 4/ })).toBeNull();
    expect(
      String(
        fetcher.mock.calls.find(([url]) =>
          String(url).includes("timewindows"),
        )?.[0],
      ),
    ).toContain("location_id=3");
  });
  test("rejects an untrusted checkout and blocks duplicate booking with an order reference", async () => {
    const { fetcher, redirect } = await account({
      checkout: "https://evil.example/pay",
    });
    fireEvent.click(screen.getByRole("button"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Deine Buchung SV123 wurde übermittelt",
    );
    expect(alert.textContent).toContain("bevor Du erneut buchst");
    expect(redirect).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
  });
  test("explicit custom checkout domains redirect while unsuccessful responses need reconciliation", async () => {
    const { client } = fixture({ checkout: "https://checkout.example/pay" });
    const redirect = mock();
    const draft = {
      timewindow_id: slot.timewindow_id,
      seats: [{}],
      contact: { first_name: "", last_name: "", email: "" },
    };
    const hook = renderHook(() =>
      useSubmitBooking(client, redirect, ["checkout.example"]),
    );
    await act(async () => {
      await hook.result.current.submit(draft, false, "");
    });
    expect(redirect).toHaveBeenCalledWith("https://checkout.example/pay");
    hook.unmount();
    const failed = fixture({ success: false });
    const second = renderHook(() => useSubmitBooking(failed.client, redirect));
    await act(async () => {
      await second.result.current.submit(draft, false, "");
    });
    expect(second.result.current.error).toContain("SV123");
    expect(second.result.current.error).toContain(
      "Deine Buchung konnte nicht abgeschlossen werden.",
    );
    expect(second.result.current.result?.checkout_url).toBeNull();
  });
  test("clears sensitive draft data after successful submission", async () => {
    await account({ checkout: null });
    fireEvent.change(screen.getByLabelText("Gutscheincode (optional)"), {
      target: { value: "ABC" },
    });
    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("Buchungsnummer: SV123");
    const stored = JSON.parse(
      sessionStorage.getItem("vv:booking:https://api.example:1:all:account") ??
        "null",
    );
    expect(stored.seats).toEqual([{}]);
    expect(stored.timewindow_id).toBe("");
  });
  test("component reload restores selection and voucher without restoring consent", async () => {
    await account();
    fireEvent.change(screen.getByLabelText("Gutscheincode (optional)"), {
      target: { value: "ABC" },
    });
    cleanup();
    const { client } = fixture();
    render(
      <TastingBooking
        baseUrl="https://api.example"
        tastingId={1}
        mode="account"
        client={client}
        termsUrl="/terms"
        privacyUrl="/privacy"
      />,
    );
    await screen.findByLabelText("Termin");
    expect((screen.getByLabelText("Termin") as HTMLSelectElement).value).toBe(
      slot.timewindow_id,
    );
    expect(
      (screen.getByLabelText("Gutscheincode (optional)") as HTMLInputElement)
        .value,
    ).toBe("ABC");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      false,
    );
  });
  test("repeated validation refocuses the reason and links preserve the booking tab", async () => {
    await account();
    fireEvent.click(screen.getByRole("checkbox"));
    const form = screen.getByRole("button").closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(document.activeElement).toBe(alert));
    screen.getByRole("button").focus();
    fireEvent.submit(form);
    await waitFor(() => expect(document.activeElement).toBe(alert));
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener");
    }
  });
  test("technical and validation details are mapped without exposing diagnostics", () => {
    expect(
      bookingErrorMessage(
        new BookingApiError(500, "DatabaseError password=secret"),
      ),
    ).toBe(
      "Die Buchung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
    );
    expect(bookingErrorMessage(new BookingApiError(404, "Not Found"))).toBe(
      "Die Buchung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
    );
    expect(
      bookingErrorMessage(new BookingApiError(422, [{ loc: ["body"] }])),
    ).toBe("Bitte prüfe Deine Eingaben und versuche es erneut.");
  });
  test("destructured getTasting supports asynchronous refreshed auth", async () => {
    const fetcher = mock(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        expect(
          (init?.headers as Record<string, string> | undefined)?.Authorization,
        ).toBe("Bearer refreshed");
        return new Response(JSON.stringify([variant]));
      },
    );
    const { getTasting } = createBookingClient({
      baseUrl: "https://api.example",
      fetch: fetcher,
      getAccessToken: async () => "refreshed",
    });
    expect(await getTasting(1)).toEqual([variant]);
  });
});

test("callback identity changes preserve a loaded form and use refreshed authentication", async () => {
  const { fetcher } = fixture();
  const props = {
    baseUrl: "https://api.example",
    tastingId: 1,
    mode: "account" as const,
    termsUrl: "/terms",
    privacyUrl: "/privacy",
  };
  const view = render(
    <TastingBooking
      {...props}
      fetch={(...args) => fetcher(...args)}
      getAccessToken={() => "old"}
      onRedirect={() => {}}
    />,
  );
  await screen.findByLabelText("Termin");
  fireEvent.change(screen.getByLabelText("Termin"), {
    target: { value: slot.timewindow_id },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  const count = fetcher.mock.calls.length;
  view.rerender(
    <TastingBooking
      {...props}
      fetch={(...args) => fetcher(...args)}
      getAccessToken={async () => "fresh"}
      onRedirect={() => {}}
    />,
  );
  expect(screen.queryByText("Veranstaltungen werden geladen…")).toBeNull();
  expect(fetcher.mock.calls).toHaveLength(count);
  fireEvent.click(screen.getByRole("button"));
  await screen.findByText("Buchungsnummer: SV123");
  const post = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
  expect(new Headers(post?.[1]?.headers).get("Authorization")).toBe(
    "Bearer fresh",
  );
});

test("phone stays in memory and is omitted from the stored draft", async () => {
  const hook = renderHook(() => useBookingDraft("phone-test"));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  act(() =>
    hook.result.current.setDraft((d) => ({
      ...d,
      contact: { ...d.contact, phone: "+49 123" },
    })),
  );
  expect(hook.result.current.draft.contact.phone).toBe("+49 123");
  expect(
    JSON.parse(sessionStorage.getItem("phone-test") ?? "{}").contact.phone,
  ).toBeUndefined();
});

test("Turnstile interactive timeout invalidates its token", async () => {
  let options:
    | { callback: (token: string) => void; "timeout-callback": () => void }
    | undefined;
  Object.assign(window, {
    turnstile: {
      render: (_element: HTMLElement, supplied: typeof options) => {
        options = supplied;
        return "timeout-widget";
      },
      remove: mock(),
    },
  });
  const onToken = mock();
  const widget = render(<Turnstile siteKey="test" onToken={onToken} />);
  await waitFor(() => expect(options).toBeDefined());
  act(() => options?.callback("verified"));
  expect(onToken).toHaveBeenLastCalledWith("verified");
  act(() => options?.["timeout-callback"]());
  expect(onToken).toHaveBeenLastCalledWith("");
  expect(screen.getByRole("alert").textContent).toContain("nicht verfügbar");
  widget.unmount();
  Object.assign(window, { turnstile: undefined });
});

describe("final guest contract regressions", () => {
  test("location discovery makes one request without a tasting filter and forwards options", async () => {
    const { client, fetcher } = fixture({
      windows: [slot, { ...slot, tasting_id: 2, id: "58" }],
    });
    const controller = new AbortController();
    const result = await client.listLocationTimewindows(3, {
      startDate: "2026-11-01",
      signal: controller.signal,
    });
    expect(result.timewindows.map((window) => window.tasting_id)).toEqual([
      1, 2,
    ]);
    expect(fetcher.mock.calls).toHaveLength(1);
    const [input, init] = fetcher.mock.calls[0];
    const params = new URL(String(input)).searchParams;
    expect(params.get("location_id")).toBe("3");
    expect(params.get("start_date")).toBe("2026-11-01");
    expect(params.has("tasting_id")).toBe(false);
    expect(init?.signal).toBe(controller.signal);
    await client.listLocationTimewindows(3);
    expect(String(fetcher.mock.calls[1][0])).toContain(
      `start_date=${berlinToday()}`,
    );
  });
  test.each([
    [
      503,
      "detail",
      "Diese Buchung ist derzeit nicht verfügbar. Bitte versuche es später erneut.",
    ],
    [
      500,
      "detail",
      "Die Zahlung konnte gerade nicht vorbereitet werden. Bitte versuche es später erneut.",
    ],
    [
      500,
      "detail",
      "Da ist leider etwas schiefgelaufen. Bitte versuche es später erneut.",
    ],
  ] as const)(
    "preserves German %s %s envelopes",
    async (status, envelope, detail) => {
      const { client } = fixture({ status, envelope, failure: detail });
      try {
        await client.submit({ timewindow_id: slot.timewindow_id, seats: [{}] });
        throw new Error("Expected rejection");
      } catch (error) {
        expect(bookingErrorMessage(error)).toBe(detail);
      }
    },
  );
  test.each([
    [
      "Rate limit exceeded: Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.",
      "Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.",
    ],
    [
      "Rate limit exceeded: 60 per 1 minute",
      "Zu viele Anfragen. Bitte versuche es in einer Minute erneut.",
    ],
    [
      "Rate limit exceeded: Zu viele Anfragen. Bitte warte eine Stunde und versuche es erneut.",
      "Zu viele Anfragen. Bitte warte eine Stunde und versuche es erneut.",
    ],
  ])("maps the real slowapi envelope %s", async (failure, expected) => {
    const fetcher = mock(
      async () =>
        new Response(JSON.stringify({ error: failure }), { status: 429 }),
    );
    const client = createBookingClient({
      baseUrl: "https://api.example",
      fetch: fetcher,
    });
    for (const request of [
      () =>
        client.submitGuest({
          timewindow_id: slot.timewindow_id,
          seats: [{}],
          first_name: "Ada",
          last_name: "Test",
          email: "ada@example.com",
          turnstile_token: "token",
          terms_privacy_accepted: true,
        }),
      () => client.listLocationTimewindows(3),
    ]) {
      try {
        await request();
        throw new Error("Expected rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(BookingApiError);
        expect(bookingErrorMessage(error)).toBe(expected);
      }
    }
  });
  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid location ID %s before a request",
    (locationId) => {
      const { client, fetcher } = fixture();
      expect(() => client.listLocationTimewindows(locationId)).toThrow(
        TypeError,
      );
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  test("English email and short name validation get local German messages", () => {
    const error = new BookingApiError(422, [
      {
        loc: ["body", "email"],
        type: "value_error",
        msg: "value is not a valid email address: invalid domain",
        input: "secret",
      },
      {
        loc: ["body", "first_name"],
        type: "string_too_short",
        msg: "String should have at least 1 character",
      },
      {
        loc: ["body", "last_name"],
        type: "string_too_short",
        msg: "String should have at least 1 character",
      },
    ]);
    expect(bookingFieldErrors(error)).toEqual({
      email: "Bitte gib eine gültige E-Mail-Adresse an.",
      first_name: "Bitte gib Deinen Namen an.",
      last_name: "Bitte gib Deinen Namen an.",
    });
    expect(bookingErrorMessage(error)).toBe(
      "Bitte gib eine gültige E-Mail-Adresse an. Bitte gib Deinen Namen an.",
    );
  });
  test("German validation is mapped per field and body errors stay in the summary", async () => {
    const phone =
      "Bitte gib Deine Telefonnummer mit internationaler Vorwahl an.";
    const name = "Bitte prüfe Deinen Namen und versuche es erneut.";
    const combined =
      "Bitte kürze Deinen Namen auf insgesamt höchstens 255 Zeichen.";
    const detail = [
      {
        loc: ["body", "phone"],
        msg: `Value error, ${phone}`,
        input: "[redacted]",
      },
      { loc: ["body", "first_name"], msg: `Value error, ${name}` },
      { loc: ["body"], msg: `Value error, ${combined}` },
      { loc: ["body", "email"], msg: "value is not a valid email address" },
    ];
    const { client } = fixture({ failure: detail, status: 422 });
    const hook = renderHook(() => useSubmitBooking(client, () => {}));
    await act(async () => {
      await hook.result.current.submit(
        {
          timewindow_id: slot.timewindow_id,
          seats: [{}],
          contact: {
            first_name: "Ada",
            last_name: "Test",
            email: "ada@example.com",
            phone: "0151",
          },
        },
        true,
        "token",
        true,
      );
    });
    expect(hook.result.current.fieldErrors).toEqual({
      phone,
      first_name: name,
    });
    expect(hook.result.current.error).toBe(`${phone} ${name} ${combined}`);
    expect(bookingFieldErrors(new BookingApiError(422, detail))).toEqual({
      phone,
      first_name: name,
    });
    expect(
      bookingErrorMessage(new BookingApiError(500, "stripe secret diagnostic")),
    ).not.toContain("secret");
  });
  test("contact errors are associated with accessible inputs and the phone has an international hint", async () => {
    const { GuestFields } = await import("../src/components");
    render(
      <GuestFields
        contact={{
          first_name: "Ada",
          last_name: "Test",
          email: "ada@example.com",
        }}
        onChange={() => {}}
        errors={{ phone: "Bitte prüfe Deine Telefonnummer." }}
      />,
    );
    const phone = screen.getByLabelText("Telefon (optional)");
    expect(phone.getAttribute("aria-invalid")).toBe("true");
    expect(
      document.getElementById(phone.getAttribute("aria-describedby") ?? "")
        ?.textContent,
    ).toBe("Bitte prüfe Deine Telefonnummer.");
  });
  test("editing dismisses only that field error and a new response restores it", async () => {
    const { GuestFields } = await import("../src/components");
    const phoneMessage = "Bitte prüfe Deine Telefonnummer.";
    const props = {
      contact: {
        first_name: "Ada",
        last_name: "Test",
        email: "ada@example.com",
        phone: "0151",
      },
      onChange: mock(),
      errors: {
        phone: phoneMessage,
        email: "Bitte prüfe Deine E-Mail-Adresse.",
      },
    };
    const view = render(<GuestFields {...props} />);
    const phone = screen.getByLabelText("Telefon (optional)");
    expect(screen.getByText(phoneMessage).className).toBe("sv-field-error");
    fireEvent.change(phone, { target: { value: "+49 151" } });
    expect(phone.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByText(phoneMessage)).toBeNull();
    expect(
      screen.getByLabelText("E-Mail-Adresse").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(
      document.getElementById(phone.getAttribute("aria-describedby") ?? "")
        ?.textContent,
    ).toContain("internationaler Vorwahl");
    view.rerender(<GuestFields {...props} errors={{ ...props.errors }} />);
    expect(phone.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(phoneMessage)).toBeTruthy();
  });
  test("cancel without a URL renders a retry link without a reference", () => {
    render(<BookingResult outcome="cancel" retryUrl="/booking" />);
    expect(screen.getByText("Die Zahlung wurde abgebrochen")).toBeTruthy();
    expect(screen.queryByText(/Referenz:/)).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/booking");
  });
  test.each([
    ["2026-10-07T10:00:00Z", "2026-10-08", "12:00:00"],
    ["2026-01-07T11:00:00Z", "2026-01-08", "12:00:00"],
    ["2026-03-28T11:00:00Z", "2026-03-29", "12:00:00"],
    ["2026-10-24T10:00:00Z", "2026-10-25", "12:00:00"],
  ])(
    "24-hour cutoff matches Berlin local subtraction at %s",
    (iso, date, start_time) => {
      const now = Date.parse(iso);
      const boundary = { ...slot, date, start_time };
      expect(windowBookable(boundary, 1, now)).toBe(true);
      expect(windowTooSoon(boundary, now + 1)).toBe(true);
      render(
        <DateTimePicker
          windows={[
            boundary,
            { ...boundary, id: "soon", start_time: "11:59:59" },
          ]}
          value=""
          onChange={() => {}}
          seats={1}
          now={now}
        />,
      );
      expect(screen.getAllByRole("option")).toHaveLength(2);
      expect(screen.getByText(/mindestens 24 Stunden/)).toBeTruthy();
    },
  );
});

test("old and new booking names render the same loaded form and preserve drafts", async () => {
  const { client, fetcher } = fixture();
  const props = {
    baseUrl: "https://api.example",
    client,
    mode: "account" as const,
    termsUrl: "/terms",
    privacyUrl: "/privacy",
  };
  const view = render(<TastingBooking {...props} tastingId={1} />);
  const picker = await screen.findByLabelText("Termin");
  fireEvent.change(picker, { target: { value: slot.timewindow_id } });
  const before = view.container.innerHTML;
  view.rerender(<EventBooking {...props} eventId={1} tastingId={999} />);
  expect(view.container.innerHTML).toBe(before);
  expect(fetcher.mock.calls).toHaveLength(4);
  expect(
    sessionStorage.getItem("vv:booking:https://api.example:1:all:account"),
  ).toContain(slot.timewindow_id);
  expect(
    sessionStorage.getItem("vv:booking:https://api.example:999:all:account"),
  ).toBeNull();
  // A real submission through the new name keeps the backend wire contract.
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Zahlungspflichtig buchen" }),
  );
  await screen.findByText("Buchungsnummer: SV123");
  const call = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
  expect(String(call?.[0])).toBe(
    "https://api.example/api/shop/tastings/bookings",
  );
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({
    timewindow_id: slot.timewindow_id,
    seats: [{ variant_id: variant.variant_id }],
  });
});

test.each([
  [
    { variants: [] as Tasting[] },
    "eventUnavailable",
    "Dieses Tasting ist nicht verfügbar.",
  ],
  [{ guest: false }, "guestDisabled", "Tasting nur mit Anmeldung."],
] as const)(
  "booking event labels can retain host terminology: %s",
  async (options, key, text) => {
    const { client } = fixture(options);
    render(
      <EventBooking
        baseUrl="https://api.example"
        client={client}
        eventId={1}
        termsUrl="/terms"
        privacyUrl="/privacy"
        labels={{ [key]: text }}
      />,
    );
    expect(await screen.findByText(text)).toBeTruthy();
  },
);

test("booking loading label is overridable during server rendering", () => {
  expect(
    renderToString(
      <EventBooking
        baseUrl="https://api.example"
        eventId={1}
        termsUrl="/terms"
        privacyUrl="/privacy"
        labels={{ eventsLoading: "Tastings laden" }}
      />,
    ),
  ).toContain("Tastings laden");
});

test("undefined booking loading label keeps the default", () => {
  expect(
    renderToString(
      <EventBooking
        baseUrl="https://api.example"
        eventId={1}
        termsUrl="/terms"
        privacyUrl="/privacy"
        labels={{ eventsLoading: undefined }}
      />,
    ),
  ).toContain("Veranstaltungen werden geladen…");
});
