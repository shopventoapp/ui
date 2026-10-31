import { afterEach, describe, expect, test } from "bun:test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountApiError, accountErrorMessage } from "../src/account-client";
import {
  type AccountReservation,
  createDashboardClient,
} from "../src/dashboard-client";
import type { DashboardProps } from "../src/dashboard-components";
import {
  AccountOrderDetail,
  AccountReservationDetail,
} from "../src/dashboard-details";
import {
  accountEntries,
  berlinStartInstant,
  reservationStartInstant,
} from "../src/dashboard-state";
import { AccountCountdown } from "../src/dashboard-ui";

afterEach(cleanup);
const reservation: AccountReservation = {
  id: 22,
  date: "2030-10-20",
  time: "19:00",
  num_guests: 1,
  notes: "Old note",
  status: "confirmed",
  created_at: "2026-10-01T12:00:00",
  franchise_location_id: 1,
  location_name: "Test",
  updated_at: "2026-10-01T12:00:00",
};
const props = {
  profile: { id: 1 },
  labels: {
    event: "Tasting",
    events: "Tastings",
    eventVoucher: "Tasting-Gutscheine",
    product: "Artikel",
    products: "Artikel",
    pickup: "Abholung",
    voucherUse: "",
    newsletter: "",
  },
  routes: {
    overview: "/konto",
    bookings: "/konto/buchungen",
    vouchers: "/konto/gutscheine",
    settings: "/konto/einstellungen",
    events: "/termine",
    shop: "/shop",
    reserve: "/reservierung",
    passwordSet: "/passwort",
  },
  help: {
    phone: "123",
    phoneLabel: "123",
    email: "test@example.com",
    address: "Test",
    routeUrl: "/route",
  },
} satisfies Omit<DashboardProps, "client">;

describe("account review regressions", () => {
  test.each([
    ["ACCEPTED", "Dein Widerruf wurde angenommen. Die Erstattung folgt."],
    ["ACCEPTED_REFUNDED", "Dein Widerruf wurde angenommen und erstattet."],
    [
      "DECLINED",
      "Dein Widerruf wurde abgelehnt. Die Begründung haben wir Dir per E-Mail geschickt.",
    ],
    ["DECIDED", "Deine Widerrufsanfrage wurde bearbeitet."],
    ["REQUESTED", "Dein Widerruf ist eingegangen und wird geprüft."],
    [
      "EXPIRED",
      "Die Widerrufsfrist ist abgelaufen. Bei Mängeln hilft Dir unser Team weiter.",
    ],
  ] as const)("withdrawal %s has specific customer wording", (state, text) => {
    const client = createDashboardClient({
      fetch: async () => Response.json([]),
    });
    const markup = renderToStaticMarkup(
      <AccountOrderDetail
        {...props}
        client={client}
        onChanged={() => {}}
        order={{
          id: "order",
          order_number: "123",
          created_at: "2026-10-01T12:00:00Z",
          status: "PAID",
          voucher_only: true,
          items: [],
          fulfillments: [],
          payments: [],
          withdrawal: { state },
        }}
      />,
    );
    expect(markup).toContain(text);
    expect(markup).toContain(
      state === "REQUESTED" ? "Widerruf erklärt" : "Bezahlt",
    );
    expect(markup).not.toContain("In Vorbereitung");
  });
  test.each(["DECLINED", "WAITING"] as const)(
    "available withdrawal with request %s retains the action and appropriate hint",
    async (status) => {
      const client = createDashboardClient({
        fetch: async () =>
          Response.json([
            { order_item_id: "wine", title: "Wine", quantity: 1 },
          ]),
      });
      render(
        <AccountOrderDetail
          {...props}
          client={client}
          onChanged={() => {}}
          order={{
            id: "order",
            order_number: "123",
            created_at: "2026-10-01T12:00:00Z",
            status: "COMPLETED",
            items: [],
            fulfillments: [],
            payments: [],
            withdrawal: {
              state: "AVAILABLE",
              request: {
                id: "request",
                status,
                created_at: "2026-10-01T12:00:00Z",
                updated_at: "2026-10-01T12:00:00Z",
              },
            },
          }}
        />,
      );
      const button = await screen.findByRole("button", {
        name: "Vertrag widerrufen",
      });
      const decline =
        "Dein Widerruf wurde abgelehnt. Die Begründung haben wir Dir per E-Mail geschickt.";
      const intro = screen.getByText(
        "Die zulässigen Artikel und ihre jeweiligen Fristen findest Du hier.",
      );
      expect(
        intro.compareDocumentPosition(button) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      if (status === "DECLINED") {
        const hint = screen.getByText(decline);
        expect(
          hint.compareDocumentPosition(intro) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      } else {
        expect(screen.queryByText(decline)).toBeNull();
      }
    },
  );
  test("withdrawal keeps quantity names accessible and single items checkbox-only", async () => {
    const options = [
      { order_item_id: "two", title: "Two bottles", quantity: 2 },
      { order_item_id: "one", title: "One bottle", quantity: 1 },
      {
        order_item_id: "blocked",
        title: "Blocked article",
        quantity: 3,
        reason: "WINDOW_EXPIRED",
      },
    ];
    const bodies: unknown[] = [];
    const client = createDashboardClient({
      fetch: async (_, init) => {
        if (init?.method === "POST") {
          bodies.push(JSON.parse(String(init.body)));
          return Response.json({ status: "PENDING_REVIEW" });
        }
        return Response.json(options);
      },
    });
    render(
      <AccountOrderDetail
        {...props}
        client={client}
        order={{
          id: "order",
          order_number: "123",
          created_at: "2026-10-01T12:00:00Z",
          status: "COMPLETED",
          items: options.map((item) => ({
            id: item.order_item_id,
            title: item.title,
            quantity: item.quantity,
            gross_price_per_item: 1890,
            net_price_per_item: 1588,
            vat_rate: 19,
          })),
          payments: [],
          fulfillments: [],
          withdrawal: { state: "AVAILABLE" },
        }}
        onChanged={() => {}}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Vertrag widerrufen" }),
    );
    const sheet = within(screen.getByRole("dialog"));
    const quantity = sheet.getByRole("spinbutton", {
      name: "Menge für Two bottles",
    }) as HTMLInputElement;
    expect(sheet.getAllByRole("spinbutton")).toHaveLength(1);
    expect(sheet.queryByText("Menge für Two bottles")).toBeNull();
    expect(quantity.disabled).toBe(true);
    expect(
      (
        sheet.getByRole("checkbox", {
          name: /Blocked article/,
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(sheet.getByRole("checkbox", { name: /One bottle/ }));
    expect(sheet.getByText(/Wert Deiner Auswahl/).textContent).toContain(
      "18,90",
    );
    fireEvent.click(sheet.getByRole("checkbox", { name: /Two bottles/ }));
    expect(quantity.disabled).toBe(false);
    expect(quantity.value).toBe("2");
    fireEvent.change(quantity, { target: { value: "1" } });
    expect(sheet.getByText(/Wert Deiner Auswahl/).textContent).toContain(
      "37,80",
    );
    fireEvent.click(sheet.getByRole("checkbox", { name: /Two bottles/ }));
    expect(quantity.disabled).toBe(true);
    fireEvent.submit(
      sheet
        .getByRole("button", { name: "Widerruf bestätigen" })
        .closest("form") as HTMLFormElement,
    );
    await waitFor(() =>
      expect(bodies).toEqual([
        { items: [{ order_item_id: "one", quantity: 1 }] },
      ]),
    );
  });
  test("unknown business errors use generic copy while token and auth messages remain protected", () => {
    for (const status of [409, 422]) {
      expect(
        accountErrorMessage(new AccountApiError(status, "Nur noch 3 Plätze")),
      ).toBe("Bitte prüfe Deine Eingaben und versuche es erneut.");
    }
    expect(accountErrorMessage(new AccountApiError(422, []))).toContain(
      "Eingaben",
    );
    expect(
      accountErrorMessage(new AccountApiError(422, "secret"), true),
    ).toContain("Link");
    expect(
      accountErrorMessage(new AccountApiError(401, "secret")),
    ).not.toContain("secret");
  });
  test("legacy free-text cutoff matches the conservative midnight policy", () => {
    for (const time of [
      "abends",
      "20:00:00",
      "24:00",
      "19:30:00.000",
      "29:00",
      "19:60",
    ]) {
      expect(reservationStartInstant("2030-10-20", time)).toBe(
        berlinStartInstant("2030-10-20", "00:00"),
      );
    }
    for (const time of ["00:00", "19:30", "23:59"]) {
      expect(reservationStartInstant("2030-10-20", time)).toBe(
        berlinStartInstant("2030-10-20", time),
      );
    }
  });
  for (const legacy of [
    { num_guests: 1, time: "19:00" },
    { num_guests: 12, time: "abends" },
  ]) {
    test(`notes-only PATCH preserves legacy ${legacy.num_guests} guests and ${legacy.time}`, async () => {
      const bodies: unknown[] = [];
      const client = createDashboardClient({
        fetch: async (_, init) => {
          bodies.push(JSON.parse(String(init?.body)));
          return Response.json({ ...reservation, ...legacy });
        },
      });
      render(
        <AccountReservationDetail
          {...props}
          client={client}
          reservation={{ ...reservation, ...legacy }}
          rules={{
            minGuests: 2,
            maxGuests: 8,
            timeInput: "free",
            times: () => [],
            policy: "",
            changeHours: 24,
          }}
          onChanged={() => {}}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Ändern" }));
      const save = screen.getByRole("button", {
        name: "Änderung speichern",
      }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);
      fireEvent.submit(save.closest("form") as HTMLFormElement);
      expect(bodies).toEqual([]);
      const guests = screen.getByLabelText("Personen") as HTMLInputElement;
      expect(guests.checkValidity()).toBe(true);
      const time = screen.getByLabelText("Uhrzeit") as HTMLInputElement;
      expect(time.checkValidity()).toBe(true);
      fireEvent.change(screen.getByLabelText("Wünsche, besondere Hinweise"), {
        target: { value: "New note" },
      });
      expect(save.disabled).toBe(false);
      fireEvent.submit(
        screen
          .getByRole("button", { name: "Änderung speichern" })
          .closest("form") as HTMLFormElement,
      );
      await waitFor(() => expect(bodies).toEqual([{ notes: "New note" }]));
    });
  }
  test("changed guest counts validate and only changed fields enter PATCH", async () => {
    const bodies: unknown[] = [];
    const client = createDashboardClient({
      fetch: async (_, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json(reservation);
      },
    });
    render(
      <AccountReservationDetail
        {...props}
        client={client}
        reservation={reservation}
        rules={{
          minGuests: 2,
          maxGuests: 8,
          timeInput: "free",
          times: () => [],
          policy: "",
          changeHours: 24,
        }}
        onChanged={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ändern" }));
    const guests = screen.getByLabelText("Personen") as HTMLInputElement;
    fireEvent.change(guests, { target: { value: "9" } });
    expect(guests.checkValidity()).toBe(false);
    fireEvent.change(guests, { target: { value: "3" } });
    expect(guests.checkValidity()).toBe(true);
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Änderung speichern" })
        .closest("form") as HTMLFormElement,
    );
    await waitFor(() => expect(bodies).toEqual([{ num_guests: 3 }]));
  });
});

test("reservation titles and free-text times retain correct customer copy", () => {
  const client = createDashboardClient({
    fetch: async () => Response.json(reservation),
  });
  for (const count of [1, 2]) {
    const record = { ...reservation, num_guests: count, time: "abends" };
    expect(accountEntries([], [], [record])[0].title).toBe(
      `Tisch für ${count} ${count === 1 ? "Person" : "Personen"}`,
    );
    const html = renderToStaticMarkup(
      <AccountReservationDetail
        {...props}
        client={client}
        reservation={record}
        rules={{
          minGuests: 2,
          maxGuests: 8,
          timeInput: "free",
          times: () => [],
          policy: "",
          changeHours: 24,
        }}
        onChanged={() => {}}
      />,
    );
    expect(html).toContain(`${count} ${count === 1 ? "Person" : "Personen"}`);
    expect(html).toContain("<dd>abends</dd>");
    expect(html).not.toContain("abend Uhr");
  }
});

test("countdown singularizes the last full day", () => {
  for (const days of [0, 1, 2]) {
    const html = renderToStaticMarkup(
      <AccountCountdown target={Date.now() + (days * 24 + 1) * 3600000} />,
    );
    expect(html).toContain(
      `<span class="cd-unit">${days === 1 ? "Tag" : "Tage"}</span>`,
    );
  }
});
