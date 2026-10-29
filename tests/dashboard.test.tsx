import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import {
  type AccountBooking,
  type AccountOrder,
  createDashboardClient,
  profileNewsletterAdapter,
} from "../src/dashboard-client";
import {
  AccountOrderDetail,
  AccountTastingDetail,
} from "../src/dashboard-details";
import { normalizeAccountPhone } from "../src/dashboard-settings";
import {
  accountEntries,
  accountFilters,
  berlinStartInstant,
  bookingAlreadyMoved,
  canReschedule,
  filterEntries,
  historyMoney,
  orderStatus,
  orderTotal,
  overviewPriorities,
  withdrawalSelection,
} from "../src/dashboard-state";

const order = (extra: Partial<AccountOrder> = {}): AccountOrder => ({
  id: "a",
  order_number: "1",
  created_at: "2026-10-01T12:00:00+02:00",
  status: "PAID",
  items: [],
  payments: [],
  fulfillments: [],
  ...extra,
});
const booking = (extra: Partial<AccountBooking> = {}): AccountBooking => ({
  order_id: "b",
  tasting_id: 1,
  date: "2026-10-20",
  start_time: "19:00:00",
  end_time: "21:00:00",
  event_name: "Event",
  franchise_location: { id: 1, location_name: "Place" },
  customer_status: "CONFIRMED",
  customer_status_label: "Bestätigt",
  ...extra,
});
const now = Date.parse("2026-10-08T12:00:00Z");
describe("account state", () => {
  test("status precedence retains terminal states and splits shipping from completion", () => {
    expect(orderStatus(order({ status: "CANCELLED" }))[0]).toBe("Storniert");
    expect(orderStatus(order({ status: "FAILED" }))[0]).toBe(
      "Zahlung fehlgeschlagen",
    );
    expect(
      orderStatus(
        order({
          status: "COMPLETED",
          fulfillments: [
            {
              id: "f",
              code: "code",
              name: "Delivery",
              type: "SHIPPING",
              price: 0,
              status: "SHIPPING_IN_PROGRESS",
            },
          ],
        }),
      )[0],
    ).toBe("Unterwegs");
    expect(orderStatus(order({ withdrawal: { state: "REQUESTED" } }))[0]).toBe(
      "Widerruf erklärt",
    );
  });
  test("paid voucher-only orders show paid in list and detail without changing terminal precedence", () => {
    const voucherOrder = order({ voucher_only: true });
    expect(orderStatus(voucherOrder)[0]).toBe("Bezahlt");
    expect(accountEntries([voucherOrder], [], [], now)[0].status).toBe(
      "Bezahlt",
    );
    expect(orderStatus(order())[0]).toBe("In Vorbereitung");
    expect(
      orderStatus(order({ voucher_only: true, status: "CANCELLED" }))[0],
    ).toBe("Storniert");
    expect(
      orderStatus(
        order({ voucher_only: true, withdrawal: { state: "REQUESTED" } }),
      )[0],
    ).toBe("Widerruf erklärt");
  });
  test("bookings do not appear twice and current filters exclude cancelled events", () => {
    const entries = accountEntries(
      [order({ id: "b", order_source: "SHOP_BOOKING" })],
      [booking(), booking({ order_id: "c", customer_status: "CANCELLED" })],
      [],
      now,
    );
    expect(entries).toHaveLength(2);
    expect(filterEntries(entries, "aktuell", "tastings")).toHaveLength(1);
    expect(filterEntries(entries, "vergangen", "alle")[0].id).toBe("t-c");
    expect(accountFilters("?zeit=vergangen&typ=unknown")).toEqual({
      zeit: "vergangen",
      typ: "alle",
    });
  });
  test("overview priority puts failed payment before pickup before upcoming event", () => {
    const entries = accountEntries(
      [
        order({ id: "failed", status: "FAILED" }),
        order({
          id: "pickup",
          fulfillments: [
            {
              id: "f",
              code: "x",
              name: "Pickup",
              type: "PICKUP",
              price: 0,
              status: "PICKUP_READY",
            },
          ],
        }),
      ],
      [booking({ date: "2026-10-09" })],
      [],
      now,
    );
    expect(overviewPriorities(entries, now).map((x) => x.priority)).toEqual([
      1, 2, 3,
    ]);
  });
  test("48-hour rule trusts the server cutoff and rejects absent or elapsed cutoffs", () => {
    expect(
      canReschedule(
        booking({ reschedulable_until: "2026-10-18T19:00:00+02:00" }),
        now,
      ),
    ).toBe(true);
    expect(canReschedule(booking(), now)).toBe(false);
    expect(
      canReschedule(
        booking({ reschedulable_until: "2026-10-08T14:00:00+02:00" }),
        now,
      ),
    ).toBe(false);
    expect(
      canReschedule(
        booking({
          customer_status: "CANCELLED",
          reschedulable_until: "2026-10-18T19:00:00+02:00",
        }),
        now,
      ),
    ).toBe(false);
  });
  test("one rebooking is reflected when supplied by the API", () => {
    expect(bookingAlreadyMoved(booking())).toBe(false);
    expect(
      canReschedule(
        {
          ...booking({ reschedulable_until: "2030-10-18T19:00:00+02:00" }),
          has_been_moved: true,
        },
        now,
      ),
    ).toBe(false);
  });
  test("completed totals follow paid amounts minus refunds", () => {
    expect(
      orderTotal(
        order({
          payments: [
            {
              id: "p",
              type: "STRIPE",
              payment_status: "PAID",
              amount: 5000,
              amount_subtotal: 5000,
              amount_discount: 0,
              refunded_amount: 1000,
            },
          ],
        }),
      ),
    ).toBe(4000);
  });
  test("Berlin date uses DST independently of browser time zone", () => {
    expect(
      new Date(berlinStartInstant("2026-10-20", "19:00")).toISOString(),
    ).toBe("2026-10-20T17:00:00.000Z");
    expect(
      new Date(berlinStartInstant("2026-11-20", "19:00")).toISOString(),
    ).toBe("2026-11-20T18:00:00.000Z");
  });
  test("withdrawal excludes blocked, excess, fractional and zero quantities", () => {
    const options = [
      { order_item_id: "a", title: "A", quantity: 3 },
      {
        order_item_id: "b",
        title: "B",
        quantity: 1,
        reason: "BOOKING_ORDER" as const,
      },
    ];
    expect(withdrawalSelection(options, { a: 2, b: 1 })).toEqual([
      { order_item_id: "a", quantity: 2 },
    ]);
    for (const a of [0, -1, 4, 1.5])
      expect(withdrawalSelection(options, { a })).toEqual([]);
  });
  test("history preserves debits, credits and zero signs", () => {
    expect(historyMoney(-2450)).toStartWith("-24,50");
    expect(historyMoney(10000)).toStartWith("+100,00");
    expect(historyMoney(0)).toStartWith("0,00");
  });
  test("phone normalization preserves international numbers and optional empty state", () => {
    expect(normalizeAccountPhone("0151 / 23456789", "+49")).toBe(
      "+4915123456789",
    );
    expect(normalizeAccountPhone("+43 660 1234567", "+49")).toBe(
      "+436601234567",
    );
    expect(normalizeAccountPhone("", "+49")).toBe("");
    expect(normalizeAccountPhone("abc", "+49")).toBeNull();
  });
  test("client uses fixed relative routes, same-origin credentials and session expiry", async () => {
    let expired = false;
    const calls: RequestInit[] = [];
    const client = createDashboardClient({
      fetch: async (url, init) => {
        expect(String(url)).toBe("/api/shop/orders/");
        calls.push(init ?? {});
        return Response.json({ detail: "expired" }, { status: 401 });
      },
      onUnauthorized: () => {
        expired = true;
      },
    });
    await expect(client.orders()).rejects.toThrow();
    expect(expired).toBe(true);
    expect(calls[0]).toMatchObject({
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    });
  });
  test("newsletter adapter writes only the consent field", async () => {
    const bodies: unknown[] = [];
    const client = createDashboardClient({
      fetch: async (_, init) => {
        bodies.push(init?.body ? JSON.parse(String(init.body)) : undefined);
        return Response.json({ id: 1 });
      },
    });
    const adapter = profileNewsletterAdapter(client, async () => ({
      newsletter_consent: false,
    }));
    expect(await adapter.status()).toBe(false);
    await adapter.subscribe();
    await adapter.unsubscribe();
    expect(bodies).toEqual([{ newsletter_consent: true }, undefined]);
  });
  test("booking detail shows order number, payments (card and voucher), and document links", () => {
    const detailProps = {
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
      client: createDashboardClient(),
      onChanged: () => {},
    };

    // Case 1: Without invoice
    const bNoInvoice = booking({
      order_id: "ord-1",
      order_number: "ORD-12345",
      has_invoice: false,
      payments: [
        {
          id: "p1",
          amount: 4500,
          amount_subtotal: 4500,
          amount_discount: 0,
          payment_status: "PAID",
          type: "STRIPE",
        },
      ],
    });
    const { unmount: unmount1 } = render(
      <AccountTastingDetail {...detailProps} booking={bNoInvoice} />,
    );
    expect(screen.getByText("Bestellung ORD-12345")).toBeDefined();
    expect(screen.getByText("Kartenzahlung")).toBeDefined();
    expect(screen.getByText("45,00 €")).toBeDefined();
    expect(
      screen.getByText(
        "Deine Rechnung findest Du hier, sobald sie erstellt ist.",
      ),
    ).toBeDefined();
    expect(screen.queryByText("Rechnung folgt nach dem Termin.")).toBeNull();
    unmount1();

    // Case 2: With invoice and voucher + card payments and credit note
    const bWithDocs = booking({
      order_id: "ord-2",
      order_number: "ORD-67890",
      has_invoice: true,
      invoice_number: "RE-2026-0042",
      invoice_date: "2026-10-09T10:00:00Z",
      payments: [
        {
          id: "p2",
          amount: 2500,
          amount_subtotal: 2500,
          amount_discount: 0,
          payment_status: "PAID",
          type: "VOUCHER",
          voucher_code: "VOUCH-ABC",
        },
        {
          id: "p3",
          amount: 3500,
          amount_subtotal: 3500,
          amount_discount: 0,
          payment_status: "PAID",
          type: "STRIPE",
        },
      ],
      credit_notes: [
        {
          id: "cn-100",
          credit_note_number: "STORNO-99",
          created_at: "2026-10-09T11:00:00Z",
        },
      ],
    });
    const { unmount: unmount2 } = render(
      <AccountTastingDetail {...detailProps} booking={bWithDocs} />,
    );
    expect(screen.getByText("Bestellung ORD-67890")).toBeDefined();
    expect(screen.getByText("Gutschein VOUCH-ABC")).toBeDefined();
    expect(screen.getByText("25,00 €")).toBeDefined();
    expect(screen.getByText("Kartenzahlung")).toBeDefined();
    expect(screen.getByText("35,00 €")).toBeDefined();
    const invoiceLink = screen.getByRole("link", {
      name: /Rechnung RE-2026-0042 herunterladen/,
    });
    expect(invoiceLink.getAttribute("href")).toBe(
      "/api/shop/stripe/invoice/ord-2",
    );
    const creditNoteLink = screen.getByRole("link", {
      name: /Stornorechnung STORNO-99 herunterladen/,
    });
    expect(creditNoteLink.getAttribute("href")).toBe(
      "/api/shop/stripe/credit-note/cn-100",
    );
    unmount2();

    // Case 3: Order detail with credit note renders Stornorechnung
    const oWithDocs = order({
      id: "ord-order-1",
      order_number: "ORD-99999",
      invoice_number: "RE-2026-0099",
      invoice_date: "2026-10-09T10:00:00Z",
      credit_notes: [
        {
          id: "cn-200",
          credit_note_number: "STORNO-101",
          created_at: "2026-10-09T11:00:00Z",
        },
      ],
    });
    const { unmount: unmount3 } = render(
      <AccountOrderDetail {...detailProps} order={oWithDocs} />,
    );
    const orderCreditNoteLink = screen.getByRole("link", {
      name: /Stornorechnung STORNO-101 herunterladen/,
    });
    expect(orderCreditNoteLink.getAttribute("href")).toBe(
      "/api/shop/stripe/credit-note/cn-200",
    );
    unmount3();
  });
});
