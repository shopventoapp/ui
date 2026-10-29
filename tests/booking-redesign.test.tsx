import { afterEach, expect, test } from "bun:test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  BookingFlow,
  readFlowDraft,
  startFlowDraft,
  voucherCodeFromQuery,
  writeFlowDraft,
} from "../src/booking-flow";
import { BookingOutcome, bookingCalendarFile } from "../src/booking-result";
import { writeBookingResult } from "../src/booking-storage";
import { availability, type CalendarInput } from "../src/calendar";
import { createBookingClient, type Timewindow } from "../src/client";

const slot: Timewindow = {
  id: "slot",
  timewindow_id: "single_slot",
  tasting_id: 5,
  date: "2099-10-25",
  start_time: "19:00:00",
  end_time: "21:30:00",
  event_name: "Example",
  max_participants: 16,
  free_spots: 10,
  franchise_location_id: 1,
};
const data = {
  windows: [slot],
  events: [
    {
      tasting_id: 5,
      tasting_name: "Example",
      full_name: "Example",
      variant_id: "v1",
      price: 4900,
    },
  ],
  settings: {
    countries: [{ value: "DE", label: "Deutschland" }],
    installation_country: "DE",
    direct_booking_enabled: true,
    guest_booking_enabled: true,
    min_customer_age: 21,
  },
  locations: [
    { id: 1, location_name: "Example", location_street: "Example Street" },
  ],
} satisfies CalendarInput;
const texts = {
  withdrawal: "Fixed date",
  minimum: "Minimum guests",
  reschedule: "Move date",
};
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
test("draft survives a new date and reload but excludes phone and expires after one day", () => {
  const d = startFlowDraft("draft", "one", 2, "v1");
  writeFlowDraft("draft", {
    ...d,
    codes: ["legacy"],
    notes: "Note",
    contact: {
      first_name: "Test",
      last_name: "Guest",
      email: "test@example.invalid",
      phone: "+491234567890",
    },
  });
  const next = startFlowDraft("draft", "two", 3, "v1");
  expect(next.contact.first_name).toBe("Test");
  expect(next.codes).toEqual(["legacy"]);
  expect(next.notes).toBe("Note");
  expect(readFlowDraft("draft")?.contact.phone).toBeUndefined();
  writeFlowDraft("draft", { ...next, updated: Date.now() - 86400001 });
  expect(readFlowDraft("draft")).toBeNull();
  sessionStorage.setItem(
    "draft",
    JSON.stringify({ ...next, seats: [{ variant_id: 99 }] }),
  );
  expect(readFlowDraft("draft")).toBeNull();
});
test("states use exact counts only up to four and configurable Berlin lead time", () => {
  const now = Date.parse("2099-10-23T17:00:00Z");
  expect(availability(slot, 2, 24, now).text).toBe("Plätze frei");
  expect(availability({ ...slot, free_spots: 4 }, 2, 24, now).text).toBe(
    "Nur noch 4 Plätze",
  );
  expect(availability({ ...slot, free_spots: 1 }, 2, 24, now).state).toBe(
    "short",
  );
  expect(availability(slot, 1, 72, now).state).toBe("closed");
});
test("calendar transport forwards a bounded month and URL encodes the voucher", async () => {
  const urls: string[] = [];
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async (input) => {
      urls.push(String(input));
      return Response.json({ timewindows: [], total: 0 });
    },
  });
  await client.listLocationTimewindows(1, {
    startDate: "2026-11-01",
    endDate: "2026-11-30",
  });
  await client.checkVoucher("A/B?C");
  expect(urls[0]).toContain("end_date=2026-11-30");
  expect(urls[1]).toEndWith("/vouchers/A%2FB%3FC");
});
test("legacy lookup 404 keeps the code pending and advancing retains the draft", async () => {
  startFlowDraft("draft", slot.timewindow_id, 2, "v1");
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () => Response.json({ detail: "Missing" }, { status: 404 }),
  });
  let step = 0;
  render(
    <BookingFlow
      client={client}
      data={data}
      draftKey="draft"
      step={1}
      onStep={(n) => {
        step = n;
      }}
      calendarUrl="/dates"
      loginUrl="/login"
      successUrl="/success"
      termsUrl="/terms"
      privacyUrl="/privacy"
      texts={texts}
    />,
  );
  await screen.findByLabelText("Gutscheincode");
  fireEvent.change(screen.getByLabelText("Gutscheincode"), {
    target: { value: "legacy" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Einlösen" }));
  await waitFor(() =>
    expect(readFlowDraft("draft")?.codes).toEqual(["legacy"]),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Weiter zu Deinen Daten" }),
  );
  expect(step).toBe(2);
  expect(readFlowDraft("draft")?.windowId).toBe(slot.timewindow_id);
});
test("account submit includes notes, saves result before Stripe and keeps draft until success", async () => {
  const d = startFlowDraft("draft", slot.timewindow_id, 2, "v1");
  writeFlowDraft("draft", { ...d, notes: "Allergy note" });
  let body: Record<string, unknown> | undefined;
  let redirected = false;
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({
        success: true,
        order_id: "o",
        order_number: "R1",
        status: "pending",
        checkout_url: "https://checkout.stripe.com/c/pay/example",
      });
    },
  });
  render(
    <BookingFlow
      client={client}
      data={data}
      draftKey="draft"
      step={3}
      onStep={() => {}}
      calendarUrl="/dates"
      loginUrl="/login"
      successUrl="/success"
      termsUrl="/terms"
      privacyUrl="/privacy"
      texts={texts}
      profile={{
        id: 1,
        first_name: "Test",
        last_name: "Guest",
        email: "test@example.invalid",
      }}
      onRedirect={() => {
        expect(sessionStorage.getItem("draft:result")).toContain("R1");
        redirected = true;
      }}
    />,
  );
  await screen.findByRole("checkbox");
  expect(screen.getAllByText(/Teilnahme ab 21 Jahren/).length).toBe(1);
  expect(screen.queryByText(/Teilnahme ab 18 Jahren/)).toBeNull();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Zahlungspflichtig buchen" }),
  );
  await waitFor(() => expect(redirected).toBe(true));
  expect(body?.notes).toBe("Allergy note");
  expect(readFlowDraft("draft")?.notes).toBe("Allergy note");
});
test("calendar file carries Berlin DST rules, valid seconds and escaped event values", () => {
  const text = bookingCalendarFile(slot, "A,B;C\nD", "R1", data.locations[0]);
  expect(text).toContain("TZID:Europe/Berlin\r\n");
  expect(text).toContain("DTSTART;TZID=Europe/Berlin:20991025T190000");
  expect(text).toContain("SUMMARY:A\\,B\\;C\\nD");
  expect(text).toEndWith("END:VCALENDAR\r\n");
});

test("mixed variants keep per-seat allocation while quantities change", async () => {
  const mixed = {
    ...data,
    events: [
      ...data.events,
      {
        ...data.events[0],
        variant_id: "v2",
        variant_name: "Second",
        price: 5400,
      },
    ],
  };
  mixed.events[0] = { ...mixed.events[0], variant_name: "First" };
  startFlowDraft("mixed", slot.timewindow_id, 2, "v1");
  render(
    <BookingFlow
      client={createBookingClient({ baseUrl: "https://example.invalid" })}
      data={mixed}
      draftKey="mixed"
      step={1}
      onStep={() => {}}
      calendarUrl="/dates"
      loginUrl="/login"
      successUrl="/success"
      termsUrl="/terms"
      privacyUrl="/privacy"
      texts={texts}
    />,
  );
  await screen.findByRole("button", { name: "Einen Platz mehr: Second" });
  fireEvent.click(
    screen.getByRole("button", { name: "Einen Platz mehr: Second" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Einen Platz weniger: First" }),
  );
  await waitFor(() =>
    expect(readFlowDraft("mixed")?.seats).toEqual([
      { variant_id: "v2" },
      { variant_id: "v1" },
    ]),
  );
  expect(screen.getAllByText("103,00 €").length).toBeGreaterThan(0);
});

test("a mismatched success reference preserves the current draft", async () => {
  const draft = startFlowDraft("return", slot.timewindow_id, 2, "v1");
  sessionStorage.setItem(
    "return:result",
    JSON.stringify({
      draft,
      window: slot,
      title: "Example",
      response: { order_number: "OLD", success: true },
    }),
  );
  render(
    <BookingOutcome
      draftKey="return"
      bookingUrl="/book"
      calendarUrl="/dates"
      reference="OTHER"
    />,
  );
  await screen.findByText("Buchungsnummer: OTHER");
  expect(readFlowDraft("return")?.windowId).toBe(slot.timewindow_id);
  expect(screen.queryByRole("button", { name: "In den Kalender" })).toBeNull();
});

test("phone normalization accepts national punctuation and international prefixes", async () => {
  const { normalizeBookingPhone } = await import("../src/booking-flow");
  for (const value of [
    " 030 123 456 78",
    "(030) 123-456.78",
    "0049 30 12345678",
    "+49 30 12345678",
    "+49 (0)30 12345678",
  ])
    expect(normalizeBookingPhone(value, "+49")).toBe("+493012345678");
});

test("booking modes preserve voucher booking when direct and guest modules are off", async () => {
  const { bookingMode } = await import("../src/calendar");
  expect(bookingMode()).toBe("paused");
  expect(
    bookingMode({
      countries: [],
      installation_country: "DE",
      direct_booking_enabled: false,
      guest_booking_enabled: false,
    }),
  ).toBe("voucher");
  expect(
    bookingMode({
      countries: [],
      installation_country: "DE",
      direct_booking_enabled: false,
      guest_booking_enabled: true,
    }),
  ).toBe("voucher");
  expect(
    bookingMode({
      countries: [],
      installation_country: "DE",
      direct_booking_enabled: true,
      guest_booking_enabled: false,
    }),
  ).toBe("account");
  expect(bookingMode(data.settings)).toBe("full");
});

test("return snapshot is minimal, bounded and requires a matching reference", async () => {
  const { writeBookingResult, readBookingResult } = await import(
    "../src/booking-storage"
  );
  const snapshot = {
    window: slot,
    title: "Example",
    location: data.locations[0],
    order_number: "R1",
    seatCount: 2,
    updated: Date.now(),
  };
  writeBookingResult("private", {
    ...snapshot,
    contact: { email: "private@example.invalid" },
    notes: "health",
    codes: ["secret"],
    checkout_url: "https://checkout.stripe.com",
  } as typeof snapshot);
  const stored = sessionStorage.getItem("private:result") ?? "";
  for (const field of [
    "private@example.invalid",
    "health",
    "secret",
    "checkout",
    "free_spots",
    "franchise_location_id",
  ])
    expect(stored).not.toContain(field);
  expect(readBookingResult("private", "R1")?.seatCount).toBe(2);
  expect(readBookingResult("private")).toBeNull();
  expect(readBookingResult("private", "OTHER")).toBeNull();
  for (const patch of [
    { updated: Date.now() - 86400001 },
    { seatCount: "2" },
    { seatCount: 0 },
    { window: {} },
    { window: { ...slot, date: [slot.date] } },
    { window: { ...slot, start_time: [slot.start_time] } },
    { window: { ...slot, end_time: [slot.end_time] } },
    { title: null },
    { location: { location_name: 123 } },
  ]) {
    sessionStorage.setItem(
      "private:result",
      JSON.stringify({ ...snapshot, ...patch }),
    );
    expect(readBookingResult("private", "R1")).toBeNull();
  }
});

test("successful return removes both snapshot and matching draft after rendering", async () => {
  const { writeBookingResult } = await import("../src/booking-storage");
  startFlowDraft("done", slot.timewindow_id, 2, "v1");
  writeBookingResult("done", {
    window: slot,
    title: "Example",
    order_number: "R1",
    seatCount: 2,
    updated: Date.now(),
  });
  render(
    <BookingOutcome
      draftKey="done"
      bookingUrl="/book"
      calendarUrl="/dates"
      reference="R1"
    />,
  );
  await screen.findByRole("button", { name: "In den Kalender" });
  expect(sessionStorage.getItem("done")).toBeNull();
  expect(sessionStorage.getItem("done:result")).toBeNull();
});

test("untrusted checkout hosts cannot leave a result snapshot", async () => {
  startFlowDraft("unsafe", slot.timewindow_id, 2, "v1");
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () =>
      Response.json({
        success: true,
        order_number: "R1",
        checkout_url: "https://evil.invalid/pay",
      }),
  });
  render(
    <BookingFlow
      client={client}
      data={data}
      draftKey="unsafe"
      step={3}
      onStep={() => {}}
      calendarUrl="/dates"
      loginUrl="/login"
      successUrl="/success"
      termsUrl="/terms"
      privacyUrl="/privacy"
      texts={texts}
      profile={{ id: 1 }}
      onRedirect={() => {
        throw new Error("Must not redirect");
      }}
    />,
  );
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Zahlungspflichtig buchen" }),
  );
  await screen.findByRole("heading", { name: "Bitte prüfe Deine Buchung" });
  expect(sessionStorage.getItem("unsafe:result")).toBeNull();
});

test("ICS folds unicode lines by octets and escapes standalone carriage returns", () => {
  const text = bookingCalendarFile(slot, `${"Ü".repeat(90)}\rText`, "R1");
  for (const line of text.split("\r\n"))
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(text.replace(/\r\n /g, "")).toContain("\\nText");
});

test("availability conflict reloads the calendar and keeps customer input", async () => {
  const d = startFlowDraft("conflict", slot.timewindow_id, 2, "v1");
  writeFlowDraft("conflict", { ...d, notes: "Keep this note" });
  let reloads = 0;
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () =>
      Response.json(
        { detail: "Für diesen Termin ist nur noch 1 Platz frei." },
        { status: 409 },
      ),
  });
  render(
    <BookingFlow
      client={client}
      data={data}
      draftKey="conflict"
      step={3}
      onStep={() => {}}
      calendarUrl="/dates"
      loginUrl="/login"
      successUrl="/success"
      termsUrl="/terms"
      privacyUrl="/privacy"
      texts={texts}
      profile={{ id: 1 }}
      onReloadAvailability={() => {
        reloads++;
      }}
    />,
  );
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Zahlungspflichtig buchen" }),
  );
  await screen.findByText("Gerade war jemand schneller.");
  expect(reloads).toBe(1);
  expect(readFlowDraft("conflict")?.notes).toBe("Keep this note");
  expect(screen.getByRole("button", { name: "Plätze anpassen" })).toBeTruthy();
});

test("voucher validation rejects zero credit and wrong location without location metadata", async () => {
  const { voucherProblem } = await import("../src/booking-flow");
  expect(
    voucherProblem({ voucher_code: "ZERO", remaining_value: 0 }, 5, 1),
  ).toContain("kein Guthaben");
  expect(
    voucherProblem(
      { voucher_code: "LOCAL", redeemable_location_ids: [2] },
      5,
      1,
    ),
  ).toContain("Standort");
  expect(
    voucherProblem(
      { voucher_code: "LOCAL", redeemable_location_ids: [1] },
      5,
      1,
    ),
  ).toBeNull();
});

test("unlicensed direct and guest booking still allow voucher progress", async () => {
  startFlowDraft("voucher-only", slot.timewindow_id, 1, "v1");
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () =>
      Response.json({
        voucher_code: "CODE",
        remaining_value: 4900,
        kind: "SINGLE_PURPOSE",
      }),
  });
  let step = 1;
  render(
    <BookingFlow
      client={client}
      data={{
        ...data,
        settings: {
          ...data.settings,
          direct_booking_enabled: false,
          guest_booking_enabled: false,
        },
      }}
      draftKey="voucher-only"
      step={1}
      onStep={(n) => {
        step = n;
      }}
      calendarUrl="/dates"
      loginUrl="/login"
      successUrl="/success"
      termsUrl="/terms"
      privacyUrl="/privacy"
      texts={texts}
    />,
  );
  fireEvent.change(await screen.findByLabelText("Gutscheincode"), {
    target: { value: "CODE" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Einlösen" }));
  await waitFor(() =>
    expect(readFlowDraft("voucher-only")?.codes).toEqual(["CODE"]),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Weiter zu Deinen Daten" }),
  );
  await waitFor(() => expect(step).toBe(2));
});

for (const guestAllowed of [true, false]) {
  test(`account step reports only actionable errors when guest booking is ${guestAllowed}`, async () => {
    startFlowDraft("account-errors", slot.timewindow_id, 1, "v1");
    render(
      <BookingFlow
        client={createBookingClient({ baseUrl: "https://example.invalid" })}
        data={{
          ...data,
          settings: { ...data.settings, guest_booking_enabled: guestAllowed },
        }}
        draftKey="account-errors"
        step={2}
        onStep={() => {}}
        calendarUrl="/dates"
        loginUrl="/login"
        successUrl="/success"
        termsUrl="/terms"
        privacyUrl="/privacy"
        texts={texts}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Weiter zur Übersicht" }),
    );
    const summary = screen.getByRole("alert");
    expect(summary.querySelectorAll("li").length).toBe(1);
    const link = summary.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("#f-account");
    fireEvent.click(link);
    expect(document.getElementById("f-account")).toBeTruthy();
    expect(screen.queryByLabelText("Vorname")).toBeNull();
    if (!guestAllowed) expect(summary.textContent).not.toContain("Gast");
  });
}

test("voucher link prefills the first step without accepting injected markup", async () => {
  startFlowDraft("draft", slot.timewindow_id, 1, "v1");
  const props = {
    client: createBookingClient({ baseUrl: "https://example.invalid" }),
    data,
    draftKey: "draft",
    step: 1,
    onStep: () => {},
    calendarUrl: "/dates",
    loginUrl: "/login",
    successUrl: "/success",
    termsUrl: "/terms",
    privacyUrl: "/privacy",
    texts,
  };
  const view = render(
    <BookingFlow {...props} initialVoucherCode="AB1234-CD" />,
  );
  expect(
    ((await screen.findByLabelText("Gutscheincode")) as HTMLInputElement).value,
  ).toBe("AB1234-CD");
  view.unmount();
  render(
    <BookingFlow {...props} initialVoucherCode={"<script>alert(1)</script>"} />,
  );
  expect(
    ((await screen.findByLabelText("Gutscheincode")) as HTMLInputElement).value,
  ).toBe("");
});

test("voucher query values are bounded and reject markup, URLs and control characters", () => {
  for (const value of [
    null,
    "",
    "x".repeat(101),
    "javascript:alert(1)",
    "<img src=x onerror=alert(1)>",
    "ABC\nDEF",
    "ABC\n",
  ]) {
    expect(voucherCodeFromQuery(value)).toBe("");
  }
  expect(voucherCodeFromQuery("AB C/+?&")).toBe("AB C/+?&");
});

test("direct booking blocks an unapplied prefilled voucher until the field is cleared", async () => {
  startFlowDraft("draft", slot.timewindow_id, 1, "v1");
  const steps: number[] = [];
  render(
    <BookingFlow
      client={createBookingClient({ baseUrl: "https://example.invalid" })}
      data={data}
      draftKey="draft"
      step={1}
      onStep={(step) => steps.push(step)}
      initialVoucherCode="AB1234-CD"
      calendarUrl="/dates"
      loginUrl="/login"
      successUrl="/success"
      termsUrl="/terms"
      privacyUrl="/privacy"
      texts={texts}
    />,
  );
  const input = await screen.findByLabelText("Gutscheincode");
  fireEvent.click(
    screen.getByRole("button", { name: "Weiter zu Deinen Daten" }),
  );
  expect(steps).toEqual([]);
  expect(
    screen.getAllByText(
      "Bitte löse den eingetragenen Gutschein ein oder leere das Feld.",
    ).length,
  ).toBeGreaterThan(0);
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Weiter zu Deinen Daten" }),
  );
  expect(steps).toEqual([2]);
});

test("guest outcome invites with an email fragment and installation copy only", async () => {
  const key = "guest-claim";
  writeBookingResult(key, {
    window: slot,
    title: "Example",
    order_number: "CLAIM1",
    seatCount: 1,
    updated: Date.now(),
    guestEmail: "guest+one@example.com",
  });
  const { unmount } = render(
    <BookingOutcome
      draftKey={key}
      bookingUrl="/book"
      calendarUrl="/dates"
      reference="CLAIM1"
      registerUrl="/register"
      registerHint="Deine Buchungen im Blick."
    />,
  );
  const link = await screen.findByRole("link", { name: "Konto anlegen" });
  expect(link.getAttribute("href")).toBe(
    "/register#email=guest%2Bone%40example.com",
  );
  expect(link.getAttribute("href")).not.toContain("?");
  unmount();
  render(
    <BookingOutcome
      draftKey={key}
      bookingUrl="/book"
      calendarUrl="/dates"
      reference="CLAIM1"
      registerHint="Deine Buchungen im Blick."
    />,
  );
  expect(screen.queryByRole("link", { name: "Konto anlegen" })).toBeNull();
});
