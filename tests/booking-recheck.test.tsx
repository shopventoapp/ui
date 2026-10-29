import { afterEach, expect, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import {
  BookingFlow,
  readFlowDraft,
  startFlowDraft,
  writeFlowDraft,
} from "../src/booking-flow";
import { bookingMoney, type CalendarInput, useCalendar } from "../src/calendar";
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
const slot2: Timewindow = {
  ...slot,
  id: "slot2",
  timewindow_id: "second_slot",
  date: "2099-11-01",
};
const data = {
  windows: [slot, slot2],
  tastings: [
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
const base = {
  calendarUrl: "/dates",
  loginUrl: "/login",
  successUrl: "/success",
  termsUrl: "/terms",
  privacyUrl: "/privacy",
  texts,
  onStep: () => {},
};
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

test("summary and review deduct a value voucher and hide the pending hint", async () => {
  const draft = startFlowDraft("summary", slot.timewindow_id, 2, "v1");
  writeFlowDraft("summary", { ...draft, codes: ["D78Z5RXVAD"] });
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () =>
      Response.json({
        voucher_code: "D78Z5RXVAD",
        kind: "MULTI_PURPOSE",
        value: 8900,
        remaining_value: 8900,
      }),
  });
  const props = { ...base, client, data, draftKey: "summary" };
  const view = render(<BookingFlow {...props} step={1} />);
  const assertSummary = () => {
    const summaries = view.container.querySelectorAll(".lines");
    expect(summaries.length).toBeGreaterThan(0);
    for (const summary of Array.from(summaries)) {
      const voucher = within(summary as HTMLElement).getByText(
        "Gutschein D78Z5RXVAD",
      ).parentElement;
      expect(voucher?.textContent).toBe(
        `Gutschein D78Z5RXVAD−${bookingMoney(8900)}`,
      );
      expect(summary.querySelector(".grand")?.textContent).toBe(
        `Zu zahlen${bookingMoney(900)}`,
      );
    }
    expect(screen.queryByText("Höchstens zu zahlen")).toBeNull();
    expect(screen.queryByText(/Restbetrag bestätigt Stripe/)).toBeNull();
  };
  await waitFor(assertSummary);
  expect(view.container.querySelector(".code-item small")?.textContent).toBe(
    `Wertgutschein, ${bookingMoney(8900)} von ${bookingMoney(8900)} Guthaben`,
  );
  expect(
    view.container.querySelector(".summary-toggle strong")?.textContent,
  ).toBe(bookingMoney(900));
  fireEvent.click(
    screen.getByRole("button", { name: "Deine Auswahl anzeigen" }),
  );
  assertSummary();
  fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
  view.rerender(<BookingFlow {...props} step={3} />);
  assertSummary();
  expect(view.container.querySelectorAll(".lines").length).toBe(2);
});

for (const status of [404, 429]) {
  test(`a ${status} code keeps only the remaining amount as an upper bound`, async () => {
    const draft = startFlowDraft("pendingSummary", slot.timewindow_id, 2, "v1");
    writeFlowDraft("pendingSummary", {
      ...draft,
      codes: ["WAIT", "VALUE"],
    });
    const client = createBookingClient({
      baseUrl: "https://example.invalid",
      fetch: async (input) =>
        String(input).endsWith("/WAIT")
          ? Response.json({ detail: "Pending" }, { status })
          : Response.json({
              voucher_code: "VALUE",
              kind: "MULTI_PURPOSE",
              remaining_value: 8900,
            }),
    });
    const props = { ...base, client, data, draftKey: "pendingSummary" };
    const view = render(<BookingFlow {...props} step={1} />);
    const assertPendingSummary = () => {
      const summaries = view.container.querySelectorAll(".lines");
      expect(summaries.length).toBeGreaterThan(0);
      for (const summary of Array.from(summaries)) {
        expect(summary.querySelector(".grand")?.textContent).toBe(
          `Höchstens zu zahlen${bookingMoney(900)}`,
        );
        expect(
          within(summary as HTMLElement).getByText("Gutschein WAIT")
            .parentElement?.textContent,
        ).toBe("Gutschein WAITWird bei der Buchung geprüft");
      }
      expect(screen.queryByText("Für diese Buchung nicht benötigt")).toBeNull();
    };
    await waitFor(assertPendingSummary);
    expect(
      view.container.querySelector(".summary-toggle strong")?.textContent,
    ).toBe(`Höchstens ${bookingMoney(900)}`);
    fireEvent.click(
      screen.getByRole("button", { name: "Deine Auswahl anzeigen" }),
    );
    assertPendingSummary();
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    view.rerender(<BookingFlow {...props} step={3} />);
    assertPendingSummary();
    expect(screen.getAllByText(/Restbetrag bestätigt Stripe/).length).toBe(2);
  });
}

test("an unchecked restored code stays pending until its check finishes", async () => {
  const draft = startFlowDraft("uncheckedSummary", slot.timewindow_id, 2, "v1");
  writeFlowDraft("uncheckedSummary", { ...draft, codes: ["RESTORED"] });
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () => {
      await gate;
      return Response.json({
        voucher_code: "RESTORED",
        kind: "MULTI_PURPOSE",
        remaining_value: 9770,
      });
    },
  });
  const props = { ...base, client, data, draftKey: "uncheckedSummary" };
  const view = render(<BookingFlow {...props} step={1} />);
  try {
    await screen.findByText("Wird bei der Buchung geprüft");
    expect(screen.queryByText("Für diese Buchung nicht benötigt")).toBeNull();
    expect(
      view.container.querySelector(".summary-toggle strong")?.textContent,
    ).toBe(`Höchstens ${bookingMoney(9800)}`);
  } finally {
    await act(async () => {
      release();
      await gate;
    });
  }
  const assertMinimumSummary = () => {
    for (const summary of Array.from(
      view.container.querySelectorAll(".lines"),
    )) {
      expect(summary.querySelector(".grand")?.textContent).toBe(
        `Zu zahlen${bookingMoney(50)}`,
      );
      expect(
        within(summary as HTMLElement).getByText("Gutschein RESTORED")
          .parentElement?.textContent,
      ).toBe(`Gutschein RESTORED−${bookingMoney(9750)}`);
    }
    expect(screen.queryByText("Wird bei der Buchung geprüft")).toBeNull();
  };
  await waitFor(assertMinimumSummary);
  expect(
    view.container.querySelector(".summary-toggle strong")?.textContent,
  ).toBe(bookingMoney(50));
  view.rerender(<BookingFlow {...props} step={3} />);
  assertMinimumSummary();
  expect(view.container.querySelectorAll(".lines").length).toBe(2);
});

test("summary explains an unneeded voucher without a zero amount", async () => {
  const draft = startFlowDraft("unusedSummary", slot.timewindow_id, 2, "v1");
  writeFlowDraft("unusedSummary", { ...draft, codes: ["FIRST", "UNUSED"] });
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async (input) =>
      Response.json({
        voucher_code: String(input).endsWith("/FIRST") ? "FIRST" : "UNUSED",
        kind: "MULTI_PURPOSE",
        remaining_value: 12000,
      }),
  });
  const view = render(
    <BookingFlow
      {...base}
      client={client}
      data={data}
      draftKey="unusedSummary"
      step={1}
    />,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => {
    expect(screen.queryByText("Höchstens zu zahlen")).toBeNull();
    expect(
      within(view.container.querySelector(".lines") as HTMLElement).getByText(
        "Gutschein UNUSED",
      ).parentElement?.textContent,
    ).toBe("Gutschein UNUSEDFür diese Buchung nicht benötigt");
    expect(view.container.querySelector(".grand")?.textContent).toBe(
      `Zu zahlen${bookingMoney(0)}`,
    );
  });
});

test("a voucher booking rejection shows its real cause and no seat conflict", async () => {
  startFlowDraft("v400", slot.timewindow_id, 2, "v1");
  let reloads = 0;
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () =>
      Response.json(
        { detail: "Der Gutscheincode „X“ wurde bereits eingelöst." },
        { status: 400 },
      ),
  });
  render(
    <BookingFlow
      {...base}
      client={client}
      data={data}
      draftKey="v400"
      step={3}
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
  await screen.findByText("Der Gutscheincode „X“ wurde bereits eingelöst.");
  expect(screen.queryByText("Gerade war jemand schneller.")).toBeNull();
  expect(reloads).toBe(1);
});

test("choosing another date clears a seat conflict and the submission error", async () => {
  startFlowDraft("cd", slot.timewindow_id, 2, "v1");
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () =>
      Response.json({ detail: "Nur noch 1 Platz frei." }, { status: 409 }),
  });
  render(
    <BookingFlow
      {...base}
      client={client}
      data={data}
      draftKey="cd"
      step={3}
      profile={{ id: 1 }}
    />,
  );
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Zahlungspflichtig buchen" }),
  );
  await screen.findByText("Gerade war jemand schneller.");
  fireEvent.click(
    screen.getByRole("button", { name: "Anderen Termin wählen" }),
  );
  const buttons = await screen.findAllByRole("button");
  const other = buttons.find(
    (b) => b.className === "ag-row" && (b.textContent ?? "").includes("Nov"),
  );
  expect(other).toBeTruthy();
  fireEvent.click(other!);
  await waitFor(() =>
    expect(readFlowDraft("cd")?.windowId).toBe(slot2.timewindow_id),
  );
  // stale conflict copy still shown for the new date?
  expect(screen.queryByText("Gerade war jemand schneller.")).toBeNull();
  expect(screen.queryByText("Nur noch 1 Platz frei.")).toBeNull();
});

test("removing a code aborts its restore check and releases the flow", async () => {
  const d = startFlowDraft("stuck", slot.timewindow_id, 2, "v1");
  writeFlowDraft("stuck", { ...d, codes: ["AAA"] });
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () => {
      await gate;
      return Response.json({
        voucher_code: "AAA",
        kind: "SINGLE_PURPOSE",
        remaining_value: 4900,
      });
    },
  });
  render(
    <BookingFlow
      {...base}
      client={client}
      data={data}
      draftKey="stuck"
      step={1}
    />,
  );
  const remove = await screen.findByRole("button", {
    name: "Gutschein AAA entfernen",
  });
  fireEvent.click(remove);
  await act(async () => {
    release();
    await gate;
    await new Promise((r) => setTimeout(r, 20));
  });
  const einloesen = screen.getByRole("button", { name: /Einlösen|Prüfen/ });
  expect(einloesen.textContent).toBe("Einlösen");
  expect((einloesen as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(
    screen.getAllByRole("button", { name: /Weiter zu Deinen Daten/ })[0],
  );
  expect(
    screen.queryByText("Deine Gutscheine werden gerade geprüft."),
  ).toBeNull();
});

test("removing an invalid restored voucher unblocks step one", async () => {
  const d = startFlowDraft("issue", slot.timewindow_id, 2, "v1");
  writeFlowDraft("issue", { ...d, codes: ["USED"] });
  const steps: number[] = [];
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () =>
      Response.json({
        voucher_code: "USED",
        kind: "SINGLE_PURPOSE",
        value: 4900,
        remaining_value: 0,
        redeemed: true,
      }),
  });
  render(
    <BookingFlow
      {...base}
      client={client}
      data={data}
      draftKey="issue"
      step={1}
      onStep={(n) => steps.push(n)}
    />,
  );
  await screen.findByText("Dieser Gutschein wurde bereits eingelöst.");
  fireEvent.click(
    screen.getByRole("button", { name: "Gutschein USED entfernen" }),
  );
  await waitFor(() => expect(readFlowDraft("issue")?.codes).toEqual([]));
  fireEvent.click(
    screen.getAllByRole("button", { name: /Weiter zu Deinen Daten/ })[0],
  );
  await new Promise((r) => setTimeout(r, 20));
  expect(steps).toEqual([2]);
  expect(screen.queryByText("Bitte prüfe Deine Gutscheine.")).toBeNull();
});

test("double Enter cannot start concurrent voucher checks", async () => {
  startFlowDraft("double", slot.timewindow_id, 2, "v1");
  let checks = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () => {
      checks++;
      await gate;
      return Response.json({ voucher_code: "ONE", kind: "SINGLE_PURPOSE" });
    },
  });
  render(
    <BookingFlow
      {...base}
      client={client}
      data={data}
      draftKey="double"
      step={1}
    />,
  );
  const input = await screen.findByLabelText("Gutscheincode");
  fireEvent.change(input, { target: { value: "ONE" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(checks).toBe(1));
  await act(async () => {
    release();
    await gate;
  });
  await waitFor(() => expect(readFlowDraft("double")?.codes).toEqual(["ONE"]));
});

test("known booking rejection causes retain their distinct German messages", async () => {
  const { BookingApiError, bookingErrorMessage } = await import(
    "../src/client"
  );
  for (const detail of [
    "Der Gutscheincode „X“ wurde bereits eingelöst.",
    "Dieser Gutschein kann gerade nicht eingelöst werden. Bitte wende Dich an uns.",
    "Jeder Gutscheincode darf nur einmal verwendet werden.",
    "Online kannst Du nur Termine buchen, die mindestens 24 Stunden in der Zukunft liegen. Bitte wähle einen späteren Termin.",
    "Online kannst Du höchstens 8 Plätze buchen.",
    "Dieser Termin kann gerade nicht online gebucht werden. Bitte wähle einen anderen Termin oder kontaktiere uns.",
    "Diesen Termin konnten wir nicht finden. Bitte lade die Seite neu und wähle erneut.",
  ])
    expect(bookingErrorMessage(new BookingApiError(400, detail))).toBe(detail);
});

test("calendar clears a changed range but keeps the same range mounted during reload", async () => {
  let release: () => void = () => {};
  let gate: Promise<void> | undefined;
  const requests: string[] = [];
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/timewindows")) {
        requests.push(url.searchParams.get("start_date") ?? "");
        if (gate) await gate;
        return Response.json({ timewindows: [slot], total: 1 });
      }
      if (url.pathname.endsWith("/settings"))
        return Response.json(data.settings);
      if (url.pathname.endsWith("/locations"))
        return Response.json({ locations: data.locations });
      return Response.json(data.tastings);
    },
  });
  function CalendarProbe({ from }: { from: string }) {
    const calendar = useCalendar({ client, locationId: 1, from });
    if (calendar.data) {
      // Loaded data exposes both required keys to old and new TypeScript hosts.
      expect(calendar.data.events.length).toBe(calendar.data.tastings.length);
      expect(calendar.data.events === calendar.data.tastings).toBe(true);
    }
    return (
      <>
        <span>{calendar.data ? "loaded" : "loading"}</span>
        <button type="button" onClick={calendar.reload}>
          Reload
        </button>
      </>
    );
  }
  const view = render(<CalendarProbe from="2099-10-01" />);
  await screen.findByText("loaded");
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(screen.getByText("loaded")).toBeTruthy();
  await act(async () => {
    release();
    await gate;
  });
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  view.rerender(<CalendarProbe from="2099-11-01" />);
  await screen.findByText("loading");
  await act(async () => {
    release();
    await gate;
  });
  await screen.findByText("loaded");
  expect(requests.at(-1)).toBe("2099-11-01");
});

test("an aborted restored voucher cannot overwrite a newly checked code", async () => {
  const draft = startFlowDraft("race", slot.timewindow_id, 1, "v1");
  writeFlowDraft("race", { ...draft, codes: ["OLD"] });
  let release: () => void = () => {};
  let staleSignal: AbortSignal | null | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async (input, init) => {
      if (String(input).endsWith("/OLD")) {
        staleSignal = init?.signal;
        await gate;
        return Response.json({ voucher_code: "OLD", redeemed: true });
      }
      return Response.json({
        voucher_code: "NEW",
        kind: "SINGLE_PURPOSE",
        remaining_value: 4900,
      });
    },
  });
  const steps: number[] = [];
  render(
    <BookingFlow
      {...base}
      client={client}
      data={data}
      draftKey="race"
      step={1}
      onStep={(step) => steps.push(step)}
    />,
  );
  await waitFor(() => expect(staleSignal).toBeTruthy());
  fireEvent.click(
    screen.getByRole("button", { name: "Gutschein OLD entfernen" }),
  );
  expect(staleSignal?.aborted).toBe(true);
  fireEvent.change(screen.getByLabelText("Gutscheincode"), {
    target: { value: "NEW" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Einlösen" }));
  await waitFor(() => expect(readFlowDraft("race")?.codes).toEqual(["NEW"]));
  await act(async () => {
    release();
    await gate;
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Einlösen" })).toBeTruthy(),
  );
  expect(
    screen.queryByText("Dieser Gutschein wurde bereits eingelöst."),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Weiter zu Deinen Daten" }),
  );
  expect(steps).toEqual([2]);
});

test("four sequential adds and removals use four checks under the 12 per minute limit", async () => {
  startFlowDraft("limit", slot.timewindow_id, 4, "v1");
  const calls: string[] = [];
  const steps: number[] = [];
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async (input) => {
      const code = String(input).split("/").at(-1) ?? "";
      calls.push(code);
      return calls.length > 12
        ? Response.json({ detail: "Too many requests" }, { status: 429 })
        : Response.json({
            voucher_code: code,
            kind: "SINGLE_PURPOSE",
            remaining_value: 4900,
          });
    },
  });
  render(
    <BookingFlow
      {...base}
      client={client}
      data={data}
      draftKey="limit"
      step={1}
      onStep={(n) => steps.push(n)}
    />,
  );
  const input = await screen.findByLabelText("Gutscheincode");
  for (const c of ["A", "B", "C", "D"]) {
    fireEvent.change(input, { target: { value: c } });
    fireEvent.click(screen.getByRole("button", { name: "Einlösen" }));
    await screen.findByRole("button", { name: `Gutschein ${c} entfernen` });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Einlösen|Prüfen/ }).textContent,
      ).toBe("Einlösen"),
    );
  }
  expect(calls).toEqual(["A", "B", "C", "D"]);
  for (const c of ["A", "B", "C", "D"])
    fireEvent.click(
      screen.getByRole("button", { name: `Gutschein ${c} entfernen` }),
    );
  await waitFor(() => expect(readFlowDraft("limit")?.codes).toEqual([]));
  expect(calls).toEqual(["A", "B", "C", "D"]);
  fireEvent.click(
    screen.getByRole("button", { name: /Weiter zu Deinen Daten/ }),
  );
  expect(steps).toEqual([2]);
});

test("rate limited restored vouchers allow progress and an explicit retry", async () => {
  const d = startFlowDraft("429", slot.timewindow_id, 1, "v1");
  writeFlowDraft("429", { ...d, codes: ["WAIT"] });
  let calls = 0;
  const steps: number[] = [];
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () => {
      calls++;
      return calls === 1
        ? Response.json({ detail: "Too many requests" }, { status: 429 })
        : Response.json({
            voucher_code: "WAIT",
            kind: "SINGLE_PURPOSE",
            remaining_value: 4900,
          });
    },
  });
  render(
    <BookingFlow
      {...base}
      client={client}
      data={data}
      draftKey="429"
      step={1}
      onStep={(n) => steps.push(n)}
    />,
  );
  await screen.findByText(/Bitte warte kurz/);
  fireEvent.click(
    screen.getByRole("button", { name: /Weiter zu Deinen Daten/ }),
  );
  expect(steps).toEqual([2]);
  fireEvent.click(
    screen.getByRole("button", { name: "In einer Minute erneut prüfen" }),
  );
  await screen.findByText(
    "Veranstaltungsgutschein für 1 Person, deckt 1 Platz",
  );
  expect(calls).toBe(2);
  expect(screen.queryByText(/Bitte warte kurz/)).toBeNull();
});

test("voucher counter uses the missing count and disappears when complete", async () => {
  startFlowDraft("counter", slot.timewindow_id, 2, "v1");
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () =>
      Response.json({ kind: "SINGLE_PURPOSE", remaining_value: 4900 }),
  });
  render(
    <BookingFlow
      {...base}
      client={client}
      data={{
        ...data,
        settings: {
          ...data.settings,
          direct_booking_enabled: false,
        },
      }}
      draftKey="counter"
      step={1}
    />,
  );
  const input = await screen.findByLabelText("Gutscheincode");
  for (const c of ["ONE", "TWO"]) {
    fireEvent.change(input, { target: { value: c } });
    fireEvent.click(screen.getByRole("button", { name: "Einlösen" }));
    await screen.findByRole("button", { name: `Gutschein ${c} entfernen` });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Einlösen|Prüfen/ }).textContent,
      ).toBe("Einlösen"),
    );
    if (c === "ONE")
      expect(
        screen.getByText("1 Platz braucht noch einen Veranstaltungsgutschein."),
      ).toBeTruthy();
  }
  expect(screen.queryByText(/noch einen Veranstaltungsgutschein/)).toBeNull();
});

test("voucher rejection focuses the code after asynchronous navigation and clears on removal", async () => {
  const d = startFlowDraft("focus", slot.timewindow_id, 1, "v1");
  writeFlowDraft("focus", { ...d, codes: ["REJECT"] });
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async (input) =>
      String(input).includes("/vouchers/")
        ? Response.json({ kind: "SINGLE_PURPOSE", remaining_value: 4900 })
        : Response.json(
            { detail: "Der Gutscheincode „REJECT“ wurde bereits eingelöst." },
            { status: 400 },
          ),
  });
  let target = 3;
  const props = {
    ...base,
    client,
    data,
    draftKey: "focus",
    profile: { id: 1 },
    onStep: (n: number) => {
      target = n;
    },
  };
  const view = render(<BookingFlow {...props} step={3} />);
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: /Zahlungspflichtig/ })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /Zahlungspflichtig/ }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Der Gutscheincode „REJECT“ wurde bereits eingelöst.",
    }),
  );
  await new Promise((r) => setTimeout(r, 30));
  expect(target).toBe(1);
  view.rerender(<BookingFlow {...props} step={1} />);
  await waitFor(() => expect(document.activeElement?.id).toBe("f-code"));
  fireEvent.click(
    screen.getByRole("button", { name: "Gutschein REJECT entfernen" }),
  );
  expect(
    screen.queryByText("Der Gutscheincode „REJECT“ wurde bereits eingelöst."),
  ).toBeNull();
});

test("a new rate limited voucher stays pending without automatic retries in voucher mode", async () => {
  startFlowDraft("added429", slot.timewindow_id, 1, "v1");
  let calls = 0;
  const steps: number[] = [];
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () => {
      calls++;
      return Response.json({ detail: "Too many requests" }, { status: 429 });
    },
  });
  render(
    <BookingFlow
      {...base}
      client={client}
      data={{
        ...data,
        settings: {
          ...data.settings,
          direct_booking_enabled: false,
        },
      }}
      draftKey="added429"
      step={1}
      onStep={(n) => steps.push(n)}
    />,
  );
  const input = await screen.findByLabelText("Gutscheincode");
  fireEvent.change(input, { target: { value: "WAIT" } });
  fireEvent.click(screen.getByRole("button", { name: "Einlösen" }));
  await screen.findByText(/Bitte warte kurz/);
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: /Weiter zu Deinen Daten/ })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(
    screen.getByRole("button", { name: /Weiter zu Deinen Daten/ }),
  );
  expect(steps).toEqual([2]);
  expect(calls).toBe(1);
});

test("contact error links focus the field after delayed step navigation", async () => {
  startFlowDraft("contactFocus", slot.timewindow_id, 1, "v1");
  const client = createBookingClient({ baseUrl: "https://example.invalid" });
  let target = 3;
  const props = {
    ...base,
    client,
    data,
    draftKey: "contactFocus",
    onStep: (n: number) => {
      target = n;
    },
  };
  const view = render(<BookingFlow {...props} step={2} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Als Gast fortfahren" }),
  );
  view.rerender(<BookingFlow {...props} step={3} />);
  fireEvent.click(
    await screen.findByRole("button", { name: /Zahlungspflichtig/ }),
  );
  fireEvent.click(
    await screen.findByRole("link", { name: "Bitte gib Deinen Vornamen ein." }),
  );
  await new Promise((r) => setTimeout(r, 30));
  expect(target).toBe(2);
  view.rerender(<BookingFlow {...props} step={2} />);
  await waitFor(() => expect(document.activeElement?.id).toBe("f-first_name"));
});

test("booking flow overrides every event voucher message with host copy", async () => {
  startFlowDraft("labels", slot.timewindow_id, 2, "v1");
  const client = createBookingClient({
    baseUrl: "https://example.invalid",
    fetch: async () =>
      Response.json({ kind: "SINGLE_PURPOSE", remaining_value: 4900 }),
  });
  const props = {
    ...base,
    client,
    data: {
      ...data,
      settings: { ...data.settings, direct_booking_enabled: false },
    },
    draftKey: "labels",
    labels: {
      eventVoucherNotice: "Tastings nur mit Gutschein.",
      eventVoucherRequired: "Bitte gib die Tasting-Gutscheine ein.",
      eventVoucherMissing: (count: number) =>
        `Noch ${count} Tasting-Gutscheine.`,
      eventVoucherDescription: "Tasting-Gutschein für einen Platz",
    },
  };
  const view = render(<BookingFlow {...props} step={1} />);
  const input = await screen.findByLabelText("Gutscheincode");
  expect(screen.getByText("Tastings nur mit Gutschein.")).toBeTruthy();
  expect(screen.getByText("Noch 2 Tasting-Gutscheine.")).toBeTruthy();
  fireEvent.change(input, { target: { value: "ONE" } });
  fireEvent.click(screen.getByRole("button", { name: "Einlösen" }));
  await screen.findByText("Tasting-Gutschein für einen Platz");
  expect(screen.getByText("Noch 1 Tasting-Gutscheine.")).toBeTruthy();
  // Host-owned navigation can open review with an incomplete voucher selection.
  view.rerender(<BookingFlow {...props} step={3} />);
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Zahlungspflichtig buchen" })
      .closest("form") as HTMLFormElement,
  );
  expect(
    screen.getByText("Bitte gib die Tasting-Gutscheine ein."),
  ).toBeTruthy();
});

test("undefined voucher count label renders the booking flow default", async () => {
  startFlowDraft("undefined-label", slot.timewindow_id, 2, "v1");
  render(
    <BookingFlow
      {...base}
      client={createBookingClient({ baseUrl: "https://example.invalid" })}
      data={{
        ...data,
        settings: { ...data.settings, direct_booking_enabled: false },
      }}
      draftKey="undefined-label"
      step={1}
      labels={{ eventVoucherMissing: undefined }}
    />,
  );
  expect(
    await screen.findByText(
      "2 Plätze brauchen noch einen Veranstaltungsgutschein.",
    ),
  ).toBeTruthy();
});
