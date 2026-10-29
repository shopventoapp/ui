/** Resolve a Berlin wall-clock date without using the browser time zone. */
export function berlinStartInstant(date: string, time: string) {
  const wall = Date.parse(
    `${date}T${time.length === 5 ? `${time}:00` : time.slice(0, 8)}Z`,
  );
  if (!Number.isFinite(wall)) return Number.NaN;
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(new Date(instant));
    instant -= Date.parse(`${parts.replace(" ", "T")}Z`) - wall;
  }
  return instant;
}

/** Legacy free-text starts use midnight, matching the backend cutoff. */
export function reservationStartInstant(date: string, time: string) {
  return berlinStartInstant(
    date,
    /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time) ? time : "00:00",
  );
}

import type {
  AccountBooking,
  AccountOrder,
  AccountReservation,
  AccountVoucher,
  WithdrawalOption,
} from "./dashboard-client";
export type EntryType = "bestellungen" | "tastings" | "reservierungen";
export interface AccountEntry {
  id: string;
  type: EntryType;
  title: string;
  number: string;
  date: string;
  next: number;
  current: boolean;
  status: string;
  tone: string;
  amount?: number;
  order?: AccountOrder;
  booking?: AccountBooking;
  reservation?: AccountReservation;
}
export function orderStatus(order: AccountOrder): [string, string] {
  if (order.withdrawal?.state === "REQUESTED")
    return ["Widerruf erklärt", "warn"];
  const terminal: Record<string, string> = {
    CANCELLED: "Storniert",
    PARTIALLY_CANCELLED: "Teilweise storniert",
    RETURNED: "Erstattet",
    PARTIALLY_RETURNED: "Teilweise erstattet",
    REFUNDED: "Erstattet",
    REFUNDED_EXTERNALLY: "Erstattet",
    DISPUTED: "In Klärung",
    DISPUTED_LOST: "In Klärung",
  };
  if (terminal[order.status])
    return [
      terminal[order.status],
      order.status.startsWith("DISPUTED") ? "warn" : "neutral",
    ];
  if (order.status === "FAILED") return ["Zahlung fehlgeschlagen", "err"];
  if (order.status === "PENDING") return ["Zahlung offen", "warn"];
  if (order.status === "PAID" && order.voucher_only)
    return ["Bezahlt", "neutral"];
  const fulfillment =
    order.fulfillments.find((f) => f.status === "PICKUP_READY") ??
    order.fulfillments.find((f) => f.status === "SHIPPING_IN_PROGRESS") ??
    order.fulfillments[0];
  const states: Record<string, [string, string]> = {
    PICKUP_READY: ["Abholbereit", "ok"],
    PICKUP_COMPLETED: ["Abgeholt", "neutral"],
    SHIPPING_IN_PROGRESS: ["Unterwegs", "neutral"],
    SHIPPING_COMPLETED: ["Zugestellt", "ok"],
    DIGITAL_COMPLETED: ["Per E-Mail verschickt", "neutral"],
  };
  return (
    states[fulfillment?.status ?? ""] ?? [
      order.status === "COMPLETED" ? "Abgeschlossen" : "In Vorbereitung",
      "neutral",
    ]
  );
}
export function orderBreakdown(order: AccountOrder) {
  const subtotal = order.items.reduce(
    (sum, item) =>
      sum +
      (item.cancelled_at
        ? 0
        : Math.max(0, item.quantity - (item.returned_quantity ?? 0)) *
          item.gross_price_per_item),
    0,
  );
  const shipping = order.fulfillments.reduce((sum, f) => sum + f.price, 0);
  const discount = order.payments.reduce(
    (sum, p) => sum + (p.promo_discount ?? 0),
    0,
  );
  const paidPayments = order.payments.filter(
    (p) => !["UNPAID", "NO_PAYMENT_REQUIRED"].includes(p.payment_status),
  );
  const paid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
  const refunded = paidPayments.reduce(
    (sum, p) => sum + (p.refunded_amount ?? 0),
    0,
  );
  const pending = ["PENDING", "INCOMPLETE", "FAILED"].includes(order.status);
  return {
    subtotal,
    shipping,
    discount,
    paid,
    refunded,
    total: pending ? subtotal + shipping - discount : paid - refunded,
  };
}
export function orderTotal(order: AccountOrder) {
  return orderBreakdown(order).total;
}
export type RebookedBooking = AccountBooking & {
  has_been_moved?: boolean;
  reschedule_count?: number;
  moved_at?: string | null;
};
export function bookingAlreadyMoved(booking: RebookedBooking) {
  return (
    booking.has_been_moved === true ||
    (booking.reschedule_count ?? 0) > 0 ||
    !!booking.moved_at
  );
}
export function canReschedule(booking: RebookedBooking, now = Date.now()) {
  return (
    !bookingAlreadyMoved(booking) &&
    booking.customer_status === "CONFIRMED" &&
    !!booking.reschedulable_until &&
    Date.parse(booking.reschedulable_until) > now
  );
}
export function accountEntries(
  orders: AccountOrder[],
  bookings: AccountBooking[],
  reservations: AccountReservation[],
  now = Date.now(),
): AccountEntry[] {
  const result: AccountEntry[] = [];
  for (const order of orders.filter(
    (o) =>
      o.order_source !== "SHOP_BOOKING" &&
      !bookings.some((b) => b.order_id === o.id),
  )) {
    const [status, tone] = orderStatus(order);
    const terminal = [
      "CANCELLED",
      "RETURNED",
      "REFUNDED",
      "REFUNDED_EXTERNALLY",
    ].includes(order.status);
    const deadline = order.withdrawal?.deadline_at;
    const pickup = order.fulfillments.find((f) => f.status === "PICKUP_READY");
    const active = order.fulfillments.some((f) =>
      [
        "PENDING",
        "PROCESSING",
        "PICKUP_READY",
        "SHIPPING_IN_PROGRESS",
      ].includes(f.status),
    );
    const current =
      !terminal &&
      (active ||
        [
          "PENDING",
          "FAILED",
          "PAID",
          "PROCESSING",
          "DISPUTED",
          "DISPUTED_LOST",
        ].includes(order.status) ||
        order.withdrawal?.state === "REQUESTED" ||
        (order.withdrawal?.state === "AVAILABLE" &&
          (!deadline || Date.parse(deadline) > now)));
    const next = Date.parse(
      pickup?.pickup_deadline_at ?? deadline ?? order.created_at,
    );
    result.push({
      id: `o-${order.id}`,
      type: "bestellungen",
      title: order.items[0]?.title ?? "Bestellung",
      number: order.order_number,
      date: order.created_at,
      next,
      current,
      status,
      tone,
      amount: orderTotal(order),
      order,
    });
  }
  for (const booking of bookings) {
    const date = `${booking.date}T${booking.start_time}`;
    const next = berlinStartInstant(booking.date, booking.start_time);
    const status = booking.customer_status_label ?? "Status nicht verfügbar";
    result.push({
      id: `t-${booking.order_id}`,
      type: "tastings",
      title: booking.event_name,
      number: booking.order_number ?? "",
      date,
      next,
      current:
        next > now &&
        !["CANCELLED", "VISITED", "PAST"].includes(
          booking.customer_status ?? "",
        ),
      status,
      tone:
        booking.customer_status === "CONFIRMED"
          ? "ok"
          : booking.customer_status === "PAYMENT_FAILED"
            ? "err"
            : "neutral",
      booking,
    });
  }
  for (const reservation of reservations) {
    const next = reservationStartInstant(reservation.date, reservation.time);
    const statuses: Record<string, string> = {
      confirmed: "Bestätigt",
      seated: "Angekommen",
      completed: "Vergangen",
      cancelled: "Storniert",
      no_show: "Nicht erschienen",
    };
    result.push({
      id: `r-${reservation.id}`,
      type: "reservierungen",
      title: `Tisch für ${reservation.num_guests} ${reservation.num_guests === 1 ? "Person" : "Personen"}`,
      number: "",
      date: `${reservation.date}T${reservation.time}`,
      next,
      current: next > now && reservation.status === "confirmed",
      status: statuses[reservation.status] ?? "Angefragt",
      tone: reservation.status === "confirmed" ? "ok" : "neutral",
      reservation,
    });
  }
  return result;
}
export function accountFilters(search: string) {
  const q = new URLSearchParams(search);
  return {
    zeit: q.get("zeit") === "vergangen" ? "vergangen" : "aktuell",
    typ: ["bestellungen", "tastings", "reservierungen"].includes(
      q.get("typ") ?? "",
    )
      ? (q.get("typ") as EntryType)
      : ("alle" as const),
  };
}
export function filterEntries(
  entries: AccountEntry[],
  zeit: string,
  typ: string,
) {
  return entries
    .filter(
      (e) =>
        e.current === (zeit !== "vergangen") &&
        (typ === "alle" || e.type === typ),
    )
    .sort((a, b) =>
      zeit === "vergangen"
        ? Date.parse(b.date) - Date.parse(a.date)
        : a.next - b.next,
    );
}
export function overviewPriorities(entries: AccountEntry[], now = Date.now()) {
  return entries
    .flatMap((e) =>
      e.status === "Zahlung fehlgeschlagen"
        ? [{ entry: e, priority: 1 }]
        : e.status === "Abholbereit"
          ? [{ entry: e, priority: 2 }]
          : e.current &&
              e.type !== "bestellungen" &&
              e.next - now <= 48 * 3600000
            ? [{ entry: e, priority: 3 }]
            : e.order?.withdrawal?.state === "AVAILABLE" &&
                e.order.withdrawal.deadline_at &&
                Date.parse(e.order.withdrawal.deadline_at) > now &&
                Date.parse(e.order.withdrawal.deadline_at) - now <=
                  10 * 86400000
              ? [{ entry: e, priority: 5 }]
              : [],
    )
    .sort((a, b) => a.priority - b.priority || a.entry.next - b.entry.next);
}
export function withdrawalSelection(
  options: WithdrawalOption[],
  quantities: Record<string, number>,
) {
  return options
    .filter(
      (o) =>
        !o.reason &&
        Number.isInteger(quantities[o.order_item_id]) &&
        quantities[o.order_item_id] > 0 &&
        quantities[o.order_item_id] <= o.quantity,
    )
    .map((o) => ({
      order_item_id: o.order_item_id,
      quantity: quantities[o.order_item_id],
    }));
}
export const historyMoney = (amount: number) =>
  `${amount > 0 ? "+" : amount < 0 ? "-" : ""}${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Math.abs(amount) / 100)}`;
export const voucherActive = (v: AccountVoucher) =>
  !v.redeemed && v.remaining_value > 0;
