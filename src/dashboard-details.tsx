"use client";
import { useState } from "react";
import { accountErrorMessage } from "./account-client";
import { bookingCalendarFile } from "./booking-result";
import { bookingMoney } from "./calendar";
import type { Location, Timewindow } from "./client";
import { DateTimePicker } from "./components";
import type {
  AccountBooking,
  AccountOrder,
  AccountReservation,
  WithdrawalOption,
} from "./dashboard-client";
import type { DashboardProps } from "./dashboard-components";
import {
  berlinStartInstant,
  bookingAlreadyMoved,
  canReschedule,
  orderBreakdown,
  orderStatus,
  orderTotal,
  reservationStartInstant,
  withdrawalSelection,
} from "./dashboard-state";
import {
  AccountCard,
  AccountCountdown,
  AccountHead,
  AccountHelpCard,
  AccountQr,
  AccountSheet,
  AccountState,
  accountDate,
  useAccountResource,
} from "./dashboard-ui";
/** Download a customer booking as a local calendar file with a three-hour reminder.
 * @param booking - Authoritative customer booking. */
export function downloadAccountCalendar(
  booking: Pick<
    AccountBooking,
    | "date"
    | "start_time"
    | "end_time"
    | "event_name"
    | "order_id"
    | "franchise_location"
  >,
) {
  const file = bookingCalendarFile(
    { ...booking, timewindow_id: booking.order_id },
    booking.event_name,
    booking.order_id,
    booking.franchise_location,
  ).replace(
    "END:VEVENT",
    "BEGIN:VALARM\r\nTRIGGER:-PT3H\r\nACTION:DISPLAY\r\nDESCRIPTION:Dein Termin\r\nEND:VALARM\r\nEND:VEVENT",
  );
  const url = URL.createObjectURL(
    new Blob([file], { type: "text/calendar;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "buchung.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const withdrawalReasons: Record<string, string> = {
  VOUCHER_REDEEMED: "Gutschein bereits eingelöst",
  WINDOW_EXPIRED: "Widerrufsfrist abgelaufen",
  BOOKING_ORDER: "Termingebundene Buchung",
};
function Payments({
  payments,
}: {
  /** Payments in the payments contract. */
  payments: AccountOrder["payments"];
}) {
  return (
    <dl className="kv">
      {payments.map((p) => (
        <div className="payment-line" key={p.id}>
          <dt>
            {p.type === "VOUCHER"
              ? `Gutschein ${p.voucher_code ?? ""}`
              : p.type === "STRIPE"
                ? "Kartenzahlung"
                : "Weitere Zahlung"}
            <span className="small muted">
              {" "}
              (
              {p.payment_status === "PAID"
                ? "bezahlt"
                : p.payment_status === "REFUND_FAILED"
                  ? "fehlgeschlagen"
                  : "in Bearbeitung"}
              )
            </span>
          </dt>
          <dd>{bookingMoney(p.amount)}</dd>
          {(p.refunded_amount ?? 0) > 0 && (
            <>
              <dt>Erstattet</dt>
              <dd>{bookingMoney(p.refunded_amount ?? 0)}</dd>
            </>
          )}
        </div>
      ))}
    </dl>
  );
}
/** Render a booking detail, ticket download and eligible one-time rescheduling. */
export function AccountEventDetail({
  booking: b,
  windows = [],
  locations = [],
  onChanged,
  ...props
}: DashboardProps & {
  /** Authoritative customer booking. */
  booking: AccountBooking;
  /** Dated availability returned by the API.
   * @defaultValue [] */
  windows?: Timewindow[];
  /** Public installation locations.
   * @defaultValue [] */
  locations?: Location[];
  /** Refresh authoritative host data after a successful mutation. */
  onChanged: () => void;
}) {
  const { client, labels, routes, help, eventImage } = props;
  const [sheet, setSheet] = useState<"ticket" | "move" | null>(null),
    [slot, setSlot] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [movedHere, setMovedHere] = useState(false);
  const alreadyMoved = movedHere || bookingAlreadyMoved(b);
  const movable = !alreadyMoved && canReschedule(b);
  const active =
    b.customer_status === "CONFIRMED" &&
    berlinStartInstant(b.date, b.start_time) > Date.now();
  const move = async () => {
    setBusy(true);
    setError("");
    try {
      await client.moveBooking(b.order_id, { timewindow_id: slot });
      setSheet(null);
      setMovedHere(true);
      setMessage("Dein Termin wurde verschoben.");
      onChanged();
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const tickets = (
    <div className="stack">
      {(b.tickets ?? [])
        .filter((t) => t.check_in_code)
        .map((t, i) => (
          <div className="pickup-code" key={t.check_in_code}>
            <div className="qr-box">
              <AccountQr
                code={t.check_in_code ?? ""}
                label={`Ticket ${i + 1}`}
              />
            </div>
            <div className="stack">
              <span className="code-big">{t.check_in_code}</span>
              <p>
                {t.seats} {t.seats === 1 ? "Platz" : "Plätze"} · Einfach beim
                Ankommen zeigen.
              </p>
            </div>
          </div>
        ))}
    </div>
  );
  return (
    <>
      <AccountHead
        title={b.event_name}
        back={[routes.bookings, "Bestellungen & Buchungen"]}
        eyebrow={`${labels.event} · ${b.order_number ?? ""}`}
      />
      <div className="detail-grid">
        <div className="stack">
          <section className="card ticket-card">
            <div className="t-top">
              <p className="eyebrow">Ticket</p>
              <h2 className="display h3">
                {b.participants} {b.participants === 1 ? "Platz" : "Plätze"} ·{" "}
                {accountDate(b.date)}
              </h2>
              <p>
                {b.start_time.slice(0, 5)} bis {b.end_time?.slice(0, 5)} Uhr
              </p>
              <span
                className={`pill ${b.customer_status === "CONFIRMED" ? "ok" : b.customer_status === "PAYMENT_FAILED" ? "err" : "neutral"}`}
              >
                {b.customer_status_label}
              </span>
              {active && (
                <AccountCountdown
                  target={berlinStartInstant(b.date, b.start_time)}
                />
              )}
            </div>
            <div className="perf" />
            {active && <div className="card-pad">{tickets}</div>}
            <div className="card-split card-pad stack">
              <div className="btn-row">
                {active && (b.tickets ?? []).length > 0 && (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => setSheet("ticket")}
                  >
                    Ticket zeigen
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    downloadAccountCalendar(b);
                    setMessage(
                      "Kalenderdatei gespeichert. Öffnen, um den Termin zu übernehmen.",
                    );
                  }}
                >
                  In den Kalender
                </button>
                <a
                  className="btn btn-ghost"
                  href={help.routeUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Route
                </a>
              </div>
              {active && (
                <>
                  <button
                    className="btn-link"
                    type="button"
                    disabled={!movable}
                    hidden={alreadyMoved}
                    onClick={() => {
                      setError("");
                      setSheet("move");
                    }}
                  >
                    Termin verschieben
                  </button>
                  <p className="small muted">
                    {alreadyMoved
                      ? "Du hast diese Buchung bereits einmal umgebucht."
                      : movable
                        ? `Verschieben ist bis ${accountDate(b.reschedulable_until ?? "")}, ${new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(new Date(b.reschedulable_until ?? ""))} Uhr möglich.`
                        : "Weniger als 48 Stunden bis zum Termin oder aktuell nicht verschiebbar: Verschieben geht jetzt nur noch telefonisch."}
                  </p>
                </>
              )}
            </div>
          </section>
          {eventImage?.(b.tasting_id) && (
            <img
              className="event-photo"
              src={eventImage(b.tasting_id)}
              alt={b.event_name}
            />
          )}
          <p role="status">{message}</p>
        </div>
        <div className="stack">
          <AccountCard title="Ort">
            <address>
              {b.franchise_location.location_name}
              <br />
              {b.franchise_location.location_street}
              <br />
              {b.franchise_location.location_postal_code}{" "}
              {b.franchise_location.location_city}
            </address>
            <p>Bitte komm 10 Minuten vor Beginn.</p>
          </AccountCard>
          <AccountCard title="Bezahlung">
            {b.order_number && (
              <p className="small muted">Bestellung {b.order_number}</p>
            )}
            <Payments payments={b.payments ?? []} />
            {b.has_invoice ? (
              <a
                className="doc-link"
                href={`/api/shop/stripe/invoice/${encodeURIComponent(b.order_id)}`}
                target="_blank"
                rel="noreferrer"
              >
                Rechnung {b.invoice_number ? `${b.invoice_number} ` : ""}
                herunterladen
                {b.invoice_date && <span>{accountDate(b.invoice_date)}</span>}
              </a>
            ) : (
              <p className="small muted">
                Deine Rechnung findest Du hier, sobald sie erstellt ist.
              </p>
            )}
            {b.credit_notes?.map((n) => (
              <a
                key={n.id}
                className="doc-link"
                href={`/api/shop/stripe/credit-note/${encodeURIComponent(n.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                Stornorechnung{" "}
                {n.credit_note_number ? `${n.credit_note_number} ` : ""}
                herunterladen
              </a>
            ))}
          </AccountCard>
          <AccountHelpCard help={help} />
        </div>
      </div>
      {sheet && (
        <AccountSheet
          title={sheet === "ticket" ? "Dein Ticket" : "Termin verschieben"}
          onClose={() => setSheet(null)}
        >
          {sheet === "ticket" ? (
            <>
              <p>
                Zeig den Code beim Ankommen. Tipp: Bildschirm etwas heller
                stellen.
              </p>
              {tickets}
            </>
          ) : (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                void move();
              }}
            >
              <p>
                Wähle einen freien Termin am selben Standort. Alle Plätze werden
                mit verschoben.
              </p>
              <DateTimePicker
                windows={windows.filter(
                  (w) =>
                    w.tasting_id === b.tasting_id &&
                    w.franchise_location_id === b.franchise_location.id,
                )}
                value={slot}
                onChange={setSlot}
                seats={b.participants ?? 1}
                locations={locations}
              />
              {!windows.length && <p>Gerade keine neuen Termine verfügbar.</p>}
              {error && <p role="alert">{error}</p>}
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy || !slot || !movable}
              >
                {busy
                  ? "Wird gespeichert..."
                  : "Termin verbindlich verschieben"}
              </button>
            </form>
          )}
        </AccountSheet>
      )}
    </>
  );
}
function WithdrawalSheet({
  order,
  options,
  onDone,
  onClose,
  client,
}: {
  /** Authoritative account order. */
  order: AccountOrder;
  /** Options in the withdrawal sheet contract. */
  options: WithdrawalOption[];
  /** On done in the withdrawal sheet contract. */
  onDone: () => void;
  /** Close the modal in host state. */
  onClose: () => void;
  /** Stable client instance used for API requests. */
  client: DashboardProps["client"];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selected = withdrawalSelection(options, quantities);
  const total = selected.reduce(
    (sum, s) =>
      sum +
      s.quantity *
        (order.items.find((i) => i.id === s.order_item_id)
          ?.gross_price_per_item ?? 0),
    0,
  );
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await client.withdraw(order.id, { items: selected });
      if (["DECLINED", "ERROR"].includes(result.status ?? "")) {
        setError(
          "Dein Widerruf konnte nicht bestätigt werden. Bitte kontaktiere uns.",
        );
        return;
      }
      onDone();
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AccountSheet title="Was möchtest Du widerrufen?" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p>Wähl die Artikel und die Menge. Einen Grund brauchst Du nicht.</p>
        {options.map((o) => (
          <div className="wd-item" key={o.order_item_id}>
            <label className="check">
              <input
                type="checkbox"
                checked={!!quantities[o.order_item_id]}
                disabled={!!o.reason || o.quantity < 1}
                onChange={(e) =>
                  setQuantities((q) => ({
                    ...q,
                    [o.order_item_id]: e.target.checked ? o.quantity : 0,
                  }))
                }
              />
              <span>
                {o.title}
                <br />
                <span className="small muted">
                  {o.reason
                    ? (withdrawalReasons[o.reason] ??
                      "Für diesen Artikel ist kein Widerruf möglich")
                    : o.return_deadline
                      ? `Frist für diesen Artikel: ${accountDate(o.return_deadline)}`
                      : o.is_voucher
                        ? "Gutschein"
                        : "Die Frist beginnt nach Erhalt."}
                </span>
              </span>
            </label>
            {!o.reason && o.quantity > 1 && (
              <label className="field wd-quantity">
                Menge
                <input
                  className="input"
                  type="number"
                  aria-label={`Menge für ${o.title}`}
                  min={1}
                  max={o.quantity}
                  value={quantities[o.order_item_id] || 1}
                  disabled={!quantities[o.order_item_id]}
                  onChange={(e) =>
                    setQuantities((q) => ({
                      ...q,
                      [o.order_item_id]: Number(e.target.value),
                    }))
                  }
                />
              </label>
            )}
          </div>
        ))}
        <div className="well">
          Wert Deiner Auswahl: {bookingMoney(total)}
          <p className="small muted">
            Den genauen Erstattungsbetrag bestätigen wir Dir nach der Prüfung.
            Rabatte und bereits erstattete Beträge rechnen wir dabei ab.
          </p>
        </div>
        <p className="tiny muted">
          Mit „Widerruf bestätigen“ erklärst Du den Widerruf für die gewählten
          Artikel. Du erhältst eine Eingangsbestätigung per E-Mail.
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !selected.length}
        >
          {busy ? "Wird gesendet..." : "Widerruf bestätigen"}
        </button>
      </form>
    </AccountSheet>
  );
}
/** Render an order detail and backend-authoritative eligible withdrawal quantities. */
export function AccountOrderDetail({
  order: o,
  onChanged,
  ...props
}: DashboardProps & {
  /** Authoritative account order. */
  order: AccountOrder;
  /** Refresh authoritative host data after a successful mutation. */
  onChanged: () => void;
}) {
  const { client, labels, routes, help } = props;
  const options = useAccountResource(
    (s) => client.withdrawalItems(o.id, s),
    [client, o.id],
  );
  const [sheet, setSheet] = useState(false),
    [message, setMessage] = useState("");
  const [status, tone] = orderStatus(o);
  const eligible =
    o.withdrawal?.state === "AVAILABLE" &&
    options.data?.some((i) => !i.reason && i.quantity > 0);
  return (
    <>
      <AccountHead
        title={
          o.fulfillments.some((f) => f.type === "PICKUP")
            ? labels.pickup
            : o.fulfillments.some((f) => f.type === "SHIPPING")
              ? "Lieferung nach Hause"
              : "Deine Bestellung"
        }
        eyebrow={`Bestellung ${o.order_number}`}
        back={[routes.bookings, "Bestellungen & Buchungen"]}
      />
      <p className={`pill ${tone}`}>{status}</p>
      <p className="small muted">bestellt am {accountDate(o.created_at)}</p>
      <div className="detail-grid">
        <div className="stack">
          {o.fulfillments
            .filter((f) => f.type === "PICKUP")
            .map((f) => (
              <AccountCard key={f.id} title="Abholung">
                {f.status === "PICKUP_READY" && (
                  <>
                    <div className="pickup-code">
                      <div className="qr-box">
                        <AccountQr code={f.code} label="Abholcode" />
                      </div>
                      <span className="code-big">{f.code}</span>
                    </div>
                    <p>
                      Zeig den Code an der Theke. Auch jemand anderes kann damit
                      abholen.
                    </p>
                    {labels.ageHint && (
                      <p className="notice warn">{labels.ageHint}</p>
                    )}
                  </>
                )}
                <address>
                  {f.pickup_name}
                  <br />
                  {f.pickup_address}
                  <br />
                  {f.pickup_postal_code} {f.pickup_city}
                </address>
                {f.pickup_deadline_at && (
                  <p>Abholbar bis {accountDate(f.pickup_deadline_at)}.</p>
                )}
                <a className="btn btn-ghost" href={help.routeUrl}>
                  Route planen
                </a>
                {help.hours && <p>{help.hours}</p>}
              </AccountCard>
            ))}
          <AccountCard title={labels.products}>
            <ul className="items">
              {o.items.map((i) => (
                <li key={i.id}>
                  <span className="bottle-thumb">
                    <span aria-hidden="true">▧</span>
                  </span>
                  <span>
                    <span className="it-name">{i.title}</span>
                    <br />
                    <span className="it-sub">
                      {i.quantity} × {bookingMoney(i.gross_price_per_item)}
                      {i.cancelled_at
                        ? " · storniert"
                        : (i.returned_quantity ?? 0) > 0
                          ? ` · ${i.returned_quantity} retourniert`
                          : ""}
                    </span>
                  </span>
                  <span>
                    {bookingMoney(i.quantity * i.gross_price_per_item)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="totals">
              <div>
                <span>Zwischensumme</span>
                <span>{bookingMoney(orderBreakdown(o).subtotal)}</span>
              </div>
              {o.fulfillments.map((f) => (
                <div key={f.id}>
                  <span>
                    {f.type === "PICKUP"
                      ? labels.pickup
                      : f.type === "DIGITAL"
                        ? "Versand per E-Mail"
                        : f.name}
                  </span>
                  <span>{bookingMoney(f.price)}</span>
                </div>
              ))}
              {orderBreakdown(o).discount > 0 && (
                <div>
                  <span>Rabatt</span>
                  <span>-{bookingMoney(orderBreakdown(o).discount)}</span>
                </div>
              )}
              {orderBreakdown(o).refunded > 0 && (
                <div>
                  <span>Erstattet</span>
                  <span>-{bookingMoney(orderBreakdown(o).refunded)}</span>
                </div>
              )}
              <div className="grand">
                <span>Gesamt</span>
                <span>{bookingMoney(orderTotal(o))}</span>
              </div>
              <p className="vat">inkl. gesetzlicher MwSt.</p>
            </div>
          </AccountCard>
          <AccountCard title="Widerruf">
            <p>
              {o.withdrawal?.state === "REQUESTED"
                ? "Dein Widerruf ist eingegangen und wird geprüft."
                : o.withdrawal?.state === "EXPIRED"
                  ? "Die Widerrufsfrist ist abgelaufen. Bei Mängeln hilft Dir unser Team weiter."
                  : o.withdrawal?.state === "ACCEPTED"
                    ? "Dein Widerruf wurde angenommen. Die Erstattung folgt."
                    : o.withdrawal?.state === "ACCEPTED_REFUNDED"
                      ? "Dein Widerruf wurde angenommen und erstattet."
                      : o.withdrawal?.state === "DECLINED" ||
                          (o.withdrawal?.state === "AVAILABLE" &&
                            o.withdrawal.request?.status === "DECLINED")
                        ? "Dein Widerruf wurde abgelehnt. Die Begründung haben wir Dir per E-Mail geschickt."
                        : o.withdrawal?.state === "DECIDED"
                          ? "Deine Widerrufsanfrage wurde bearbeitet."
                          : "Die zulässigen Artikel und ihre jeweiligen Fristen findest Du hier."}
            </p>
            {o.withdrawal?.state === "AVAILABLE" &&
              o.withdrawal.request?.status === "DECLINED" && (
                <p>
                  Die zulässigen Artikel und ihre jeweiligen Fristen findest Du
                  hier.
                </p>
              )}
            <AccountState
              loading={options.loading}
              error={options.error}
              retry={options.reload}
              empty={
                options.data
                  ? "Fristen je Artikel werden bei der Auswahl angezeigt."
                  : undefined
              }
            />
            {options.data && (
              <ul>
                {options.data.map((i) => (
                  <li key={i.order_item_id}>
                    {i.title}:{" "}
                    {i.reason
                      ? (withdrawalReasons[i.reason] ??
                        "Für diesen Artikel ist kein Widerruf möglich")
                      : i.return_deadline
                        ? `bis ${accountDate(i.return_deadline)}`
                        : i.is_voucher
                          ? "Gutschein"
                          : "Frist beginnt nach Erhalt"}
                  </li>
                ))}
              </ul>
            )}
            {eligible && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSheet(true)}
              >
                Vertrag widerrufen
              </button>
            )}
            <p role="status">{message}</p>
          </AccountCard>
        </div>
        <div className="stack">
          {o.fulfillments
            .filter((f) => f.type === "SHIPPING")
            .map((f) => (
              <AccountCard title="Lieferung" key={f.id}>
                <address>
                  {f.shipping_name}
                  <br />
                  {f.shipping_company_name}
                  <br />
                  {f.shipping_address1}
                  <br />
                  {f.shipping_address2}
                  <br />
                  {f.shipping_postal_code} {f.shipping_city}
                </address>
                <p>
                  {f.shipping_carrier_name} · {f.shipping_tracking_number}
                </p>
                {f.shipping_tracking_link &&
                  /^https:\/\//.test(f.shipping_tracking_link) && (
                    <a
                      className="btn btn-ghost"
                      href={f.shipping_tracking_link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Sendung verfolgen
                    </a>
                  )}
              </AccountCard>
            ))}
          <AccountCard title="Bezahlung">
            <Payments payments={o.payments} />
          </AccountCard>
          <AccountCard title="Dokumente">
            {o.has_invoice ? (
              <a
                className="doc-link"
                href={`/api/shop/stripe/invoice/${encodeURIComponent(o.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                Rechnung {o.invoice_number ?? ""} herunterladen
                {o.invoice_date && <span>{accountDate(o.invoice_date)}</span>}
              </a>
            ) : (
              <p>Noch keine Rechnung verfügbar.</p>
            )}
            {o.credit_notes?.map((n) => (
              <a
                key={n.id}
                className="doc-link"
                href={`/api/shop/stripe/credit-note/${encodeURIComponent(n.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                Stornorechnung{" "}
                {n.credit_note_number ? `${n.credit_note_number} ` : ""}
                herunterladen
              </a>
            ))}
          </AccountCard>
          <AccountHelpCard help={help} />
        </div>
      </div>
      {sheet && options.data && (
        <WithdrawalSheet
          order={o}
          options={options.data}
          client={client}
          onClose={() => setSheet(false)}
          onDone={() => {
            setSheet(false);
            setMessage("Dein Widerruf ist eingegangen.");
            options.reload();
            onChanged();
          }}
        />
      )}
    </>
  );
}
/** Host reservation constraints, available times and change policy. */
export interface ReservationRules {
  /** Minimum reservation party size. */
  minGuests: number;
  /** Maximum reservation party size. */
  maxGuests: number;
  /** Return allowed reservation start times for an ISO date. */
  times: (date: string) => string[];
  /** Use free input when explicitly set to free. Optional; omitted unless supplied by the host or backend. */
  timeInput?: "free";
  /** Host image URL. Optional; omitted unless supplied by the host or backend. */
  image?: string;
  /** Host reservation change/cancellation copy. */
  policy: string;
  /** Host reservation change cutoff in hours. */
  changeHours: number;
}
/** Render reservation details and submit changed fields using the host rules. */
export function AccountReservationDetail({
  reservation: r,
  rules,
  onChanged,
  ...props
}: DashboardProps & {
  /** Authoritative customer table reservation. */
  reservation: AccountReservation;
  /** Host reservation limits, policy and available times. */
  rules: ReservationRules;
  /** Refresh authoritative host data after a successful mutation. */
  onChanged: () => void;
}) {
  const { client, routes, help } = props;
  const [sheet, setSheet] = useState<"change" | "cancel" | null>(null),
    [date, setDate] = useState(r.date),
    [time, setTime] = useState(r.time),
    [guests, setGuests] = useState(r.num_guests),
    [notes, setNotes] = useState(r.notes ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const editable =
    r.status === "confirmed" &&
    reservationStartInstant(r.date, r.time) - Date.now() >=
      rules.changeHours * 3600000;
  const hasChanges =
    date !== r.date ||
    time !== r.time ||
    guests !== r.num_guests ||
    notes !== (r.notes ?? "");
  const submit = async () => {
    if (sheet === "change" && !hasChanges) return;
    setBusy(true);
    setError("");
    try {
      if (sheet === "cancel") await client.cancelReservation(r.id);
      else {
        await client.updateReservation(r.id, {
          ...(date !== r.date ? { date } : {}),
          ...(time !== r.time ? { time } : {}),
          ...(guests !== r.num_guests ? { num_guests: guests } : {}),
          ...(notes !== (r.notes ?? "") ? { notes: notes || null } : {}),
        });
      }
      setSheet(null);
      setMessage(
        sheet === "cancel"
          ? "Deine Reservierung wurde storniert."
          : "Deine Reservierung wurde geändert.",
      );
      onChanged();
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AccountHead
        title="Tisch für"
        accent={`${r.num_guests} ${r.num_guests === 1 ? "Person" : "Personen"}`}
        eyebrow="Tischreservierung"
        back={[routes.bookings, "Bestellungen & Buchungen"]}
      />
      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            {rules.image && (
              <img
                className="event-photo"
                src={rules.image}
                alt="Dein reservierter Tisch"
              />
            )}
            <div className="card-pad stack">
              <span className="pill">
                {r.status === "confirmed"
                  ? "Bestätigt"
                  : r.status === "cancelled"
                    ? "Storniert"
                    : r.status === "seated"
                      ? "Angekommen"
                      : r.status === "no_show"
                        ? "Nicht erschienen"
                        : "Vergangen"}
              </span>
              {editable && (
                <AccountCountdown
                  target={reservationStartInstant(r.date, r.time)}
                />
              )}
              <dl className="kv">
                <dt>Datum</dt>
                <dd>{accountDate(r.date)}</dd>
                <dt>Uhrzeit</dt>
                <dd>
                  {/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(r.time)
                    ? `${r.time} Uhr`
                    : r.time}
                </dd>
                <dt>Personen</dt>
                <dd>{r.num_guests}</dd>
                <dt>Dein Hinweis</dt>
                <dd>{r.notes ?? "Kein Hinweis"}</dd>
                <dt>Reserviert am</dt>
                <dd>{accountDate(r.created_at)}</dd>
              </dl>
              <div className="btn-row">
                {editable && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setError("");
                      setSheet("change");
                    }}
                  >
                    Ändern
                  </button>
                )}
                <a className="btn btn-ghost" href={help.routeUrl}>
                  Route
                </a>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    downloadAccountCalendar({
                      date: r.date,
                      start_time: r.time,
                      end_time: "",
                      event_name: `Tisch für ${r.num_guests} ${r.num_guests === 1 ? "Person" : "Personen"}`,
                      order_id: `reservation-${r.id}`,
                      franchise_location: {
                        id: r.franchise_location_id,
                        location_name: r.location_name ?? "",
                        location_street: help.address,
                      },
                    })
                  }
                >
                  In den Kalender
                </button>
              </div>
              {editable ? (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    setError("");
                    setSheet("cancel");
                  }}
                >
                  Reservierung stornieren
                </button>
              ) : r.status === "confirmed" ? (
                <p className="notice">
                  Ändern und Stornieren geht jetzt nur noch telefonisch.
                </p>
              ) : (
                <a className="btn" href={routes.reserve}>
                  Wieder reservieren
                </a>
              )}
              <p role="status">{message}</p>
            </div>
          </section>
        </div>
        <div className="stack">
          <AccountCard title="Gut zu wissen">
            <p>{rules.policy}</p>
            <p>Mehr als {rules.maxGuests} Personen? Ruf uns bitte an.</p>
          </AccountCard>
          <AccountCard title="Ort">
            <address>
              {r.location_name}
              <br />
              {help.address}
            </address>
          </AccountCard>
          <AccountHelpCard help={help} />
        </div>
      </div>
      {sheet && (
        <AccountSheet
          title={
            sheet === "change"
              ? "Reservierung ändern"
              : "Reservierung stornieren?"
          }
          onClose={() => setSheet(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {sheet === "cancel" ? (
              <p>
                Schade, dass es nicht klappt. Wir geben den Tisch sofort wieder
                frei. Das kostet nichts.
              </p>
            ) : (
              <div className="form-grid two">
                <label className="field">
                  Datum
                  <input
                    className="input"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setTime("");
                    }}
                  />
                </label>
                <label className="field" htmlFor="account-reservation-time">
                  Uhrzeit
                  {rules.timeInput === "free" ? (
                    <input
                      id="account-reservation-time"
                      className="input"
                      type={
                        /^\d{2}:\d{2}(:\d{2})?$/.test(time) || !time
                          ? "time"
                          : "text"
                      }
                      required
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  ) : (
                    <select
                      id="account-reservation-time"
                      className="select"
                      required
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    >
                      <option value="">Bitte wählen</option>
                      {time === r.time && !rules.times(date).includes(time) && (
                        <option value={r.time}>{r.time}</option>
                      )}
                      {rules.times(date).map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  )}
                </label>
                <label className="field">
                  Personen
                  <input
                    className="input"
                    type="number"
                    required
                    min={
                      guests === r.num_guests && guests < rules.minGuests
                        ? undefined
                        : rules.minGuests
                    }
                    max={
                      guests === r.num_guests && guests > rules.maxGuests
                        ? undefined
                        : rules.maxGuests
                    }
                    value={guests}
                    onChange={(e) => setGuests(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  Wünsche, besondere Hinweise
                  <textarea
                    className="textarea"
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <p className="small muted">
                  Beim Speichern prüfen wir, ob der Tisch verfügbar ist.
                </p>
              </div>
            )}
            {error && <p role="alert">{error}</p>}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy || (sheet === "change" && !hasChanges)}
            >
              {busy
                ? "Wird gespeichert..."
                : sheet === "cancel"
                  ? "Ja, stornieren"
                  : "Änderung speichern"}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => setSheet(null)}
            >
              Abbrechen
            </button>
          </form>
        </AccountSheet>
      )}
    </>
  );
}

/** @deprecated Use AccountEventDetail. Removed in 1.0. */
export const AccountTastingDetail = AccountEventDetail;
