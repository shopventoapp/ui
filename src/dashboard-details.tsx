"use client";
import { useState } from "react";
import { accountErrorMessage } from "./account-client";
import { bookingCalendarFile } from "./booking-result";
import { bookingMoney, bookingTime } from "./calendar";
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
import {
  getMessages,
  type LocaleOptions,
  localeTime,
  useMessages,
  useShopventoLocale,
} from "./locale";
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
  options: LocaleOptions = {},
) {
  const text = getMessages("account", options);
  const file = bookingCalendarFile(
    { ...booking, timewindow_id: booking.order_id },
    booking.event_name,
    booking.order_id,
    booking.franchise_location,
    options,
  ).replace(
    "END:VEVENT",
    `BEGIN:VALARM\r\nTRIGGER:-PT3H\r\nACTION:DISPLAY\r\nDESCRIPTION:${text("Dein Termin")}\r\nEND:VALARM\r\nEND:VEVENT`,
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
  const localeOptions = useShopventoLocale();

  const text = useMessages("account");

  return (
    <dl className="kv">
      {payments.map((p) => (
        <div className="payment-line" key={p.id}>
          <dt>
            {p.type === "VOUCHER"
              ? text("Gutschein {0}", p.voucher_code ?? "")
              : p.type === "STRIPE"
                ? text("Kartenzahlung")
                : text("Weitere Zahlung")}
            <span className="small muted">
              {" "}
              (
              {p.payment_status === "PAID"
                ? text("bezahlt")
                : p.payment_status === "REFUND_FAILED"
                  ? text("fehlgeschlagen")
                  : text("in Bearbeitung")}
              )
            </span>
          </dt>
          <dd>{bookingMoney(p.amount, localeOptions)}</dd>
          {(p.refunded_amount ?? 0) > 0 && (
            <>
              <dt>{text("Erstattet")}</dt>
              <dd>{bookingMoney(p.refunded_amount ?? 0, localeOptions)}</dd>
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
  const localeOptions = useShopventoLocale();

  const text = useMessages("account");

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
      setMessage(text("Dein Termin wurde verschoben."));
      onChanged();
    } catch (e) {
      setError(accountErrorMessage(e, false, undefined, localeOptions));
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
                label={text("Ticket {0}", i + 1)}
              />
            </div>
            <div className="stack">
              <span className="code-big">{t.check_in_code}</span>
              <p>
                {t.seats} {t.seats === 1 ? text("Platz") : text("Plätze")}{" "}
                {text(" · Einfach beim Ankommen zeigen.")}
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
        back={[routes.bookings, text("Bestellungen & Buchungen")]}
        eyebrow={`${labels.event} · ${b.order_number ?? ""}`}
      />
      <div className="detail-grid">
        <div className="stack">
          <section className="card ticket-card">
            <div className="t-top">
              <p className="eyebrow">{text("Ticket")}</p>
              <h2 className="display h3">
                {b.participants}{" "}
                {b.participants === 1 ? text("Platz") : text("Plätze")} ·{" "}
                {accountDate(b.date, localeOptions)}
              </h2>
              <p>{bookingTime(b, localeOptions)}</p>
              <span
                className={`pill ${b.customer_status === "CONFIRMED" ? "ok" : b.customer_status === "PAYMENT_FAILED" ? "err" : "neutral"}`}
              >
                {text(
                  b.customer_status_label ?? text("Status nicht verfügbar"),
                )}
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
                    {text("Ticket zeigen")}
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    downloadAccountCalendar(b, localeOptions);
                    setMessage(
                      text(
                        "Kalenderdatei gespeichert. Öffnen, um den Termin zu übernehmen.",
                      ),
                    );
                  }}
                >
                  {text("In den Kalender")}
                </button>
                <a
                  className="btn btn-ghost"
                  href={help.routeUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {text("Route")}
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
                    {text("Termin verschieben")}
                  </button>
                  <p className="small muted">
                    {alreadyMoved
                      ? text("Du hast diese Buchung bereits einmal umgebucht.")
                      : movable
                        ? text(
                            "Verschieben ist bis {0}, {1} Uhr möglich.",
                            accountDate(
                              b.reschedulable_until ?? "",
                              localeOptions,
                            ),
                            new Intl.DateTimeFormat(localeOptions.locale, {
                              timeZone: "Europe/Berlin",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(b.reschedulable_until ?? "")),
                          )
                        : text(
                            "Weniger als 48 Stunden bis zum Termin oder aktuell nicht verschiebbar: Verschieben geht jetzt nur noch telefonisch.",
                          )}
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
          <AccountCard title={text("Ort")}>
            <address>
              {b.franchise_location.location_name}
              <br />
              {b.franchise_location.location_street}
              <br />
              {b.franchise_location.location_postal_code}{" "}
              {b.franchise_location.location_city}
            </address>
            <p>{text("Bitte komm 10 Minuten vor Beginn.")}</p>
          </AccountCard>
          <AccountCard title={text("Bezahlung")}>
            {b.order_number && (
              <p className="small muted">
                {text("Bestellung ")}
                {b.order_number}
              </p>
            )}
            <Payments payments={b.payments ?? []} />
            {b.has_invoice ? (
              <a
                className="doc-link"
                href={`/api/shop/stripe/invoice/${encodeURIComponent(b.order_id)}`}
                target="_blank"
                rel="noreferrer"
              >
                {text("Rechnung ")}
                {b.invoice_number ? `${b.invoice_number} ` : ""}
                {text("herunterladen")}
                {b.invoice_date && (
                  <span>{accountDate(b.invoice_date, localeOptions)}</span>
                )}
              </a>
            ) : (
              <p className="small muted">
                {text(
                  "Deine Rechnung findest Du hier, sobald sie erstellt ist.",
                )}
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
                {text("Stornorechnung")}{" "}
                {n.credit_note_number ? `${n.credit_note_number} ` : ""}
                {text("herunterladen")}
              </a>
            ))}
          </AccountCard>
          <AccountHelpCard help={help} />
        </div>
      </div>
      {sheet && (
        <AccountSheet
          title={
            sheet === "ticket"
              ? text("Dein Ticket")
              : text("Termin verschieben")
          }
          onClose={() => setSheet(null)}
        >
          {sheet === "ticket" ? (
            <>
              <p>
                {text(
                  "Zeig den Code beim Ankommen. Tipp: Bildschirm etwas heller stellen.",
                )}
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
                {text(
                  "Wähle einen freien Termin am selben Standort. Alle Plätze werden mit verschoben.",
                )}
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
              {!windows.length && (
                <p>{text("Gerade keine neuen Termine verfügbar.")}</p>
              )}
              {error && <p role="alert">{error}</p>}
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy || !slot || !movable}
              >
                {busy
                  ? text("Wird gespeichert...")
                  : text("Termin verbindlich verschieben")}
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
  const localeOptions = useShopventoLocale();

  const text = useMessages("account");

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
          text(
            "Dein Widerruf konnte nicht bestätigt werden. Bitte kontaktiere uns.",
          ),
        );
        return;
      }
      onDone();
    } catch (e) {
      setError(accountErrorMessage(e, false, undefined, localeOptions));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AccountSheet title={text("Was möchtest Du widerrufen?")} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p>
          {text(
            "Wähl die Artikel und die Menge. Einen Grund brauchst Du nicht.",
          )}
        </p>
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
                    ? text(withdrawalReasons[o.reason] ?? "") ||
                      text("Für diesen Artikel ist kein Widerruf möglich")
                    : o.return_deadline
                      ? text(
                          "Frist für diesen Artikel: {0}",
                          accountDate(o.return_deadline, localeOptions),
                        )
                      : o.is_voucher
                        ? text("Gutschein")
                        : text("Die Frist beginnt nach Erhalt.")}
                </span>
              </span>
            </label>
            {!o.reason && o.quantity > 1 && (
              <label className="field wd-quantity">
                {text("Menge")}
                <input
                  className="input"
                  type="number"
                  aria-label={text("Menge für {0}", o.title)}
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
          {text("Wert Deiner Auswahl: ")}
          {bookingMoney(total, localeOptions)}
          <p className="small muted">
            {text(
              "Den genauen Erstattungsbetrag bestätigen wir Dir nach der Prüfung. Rabatte und bereits erstattete Beträge rechnen wir dabei ab.",
            )}
          </p>
        </div>
        <p className="tiny muted">
          {text(
            "Mit „Widerruf bestätigen“ erklärst Du den Widerruf für die gewählten Artikel. Du erhältst eine Eingangsbestätigung per E-Mail.",
          )}
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !selected.length}
        >
          {busy ? text("Wird gesendet...") : text("Widerruf bestätigen")}
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
  const localeOptions = useShopventoLocale();

  const text = useMessages("account");

  const { client, labels, routes, help } = props;
  const options = useAccountResource(
    (s) => client.withdrawalItems(o.id, s),
    [client, o.id],
  );
  const [sheet, setSheet] = useState(false),
    [message, setMessage] = useState("");
  const [status, tone] = orderStatus(o, localeOptions);
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
              ? text("Lieferung nach Hause")
              : text("Deine Bestellung")
        }
        eyebrow={text("Bestellung {0}", o.order_number)}
        back={[routes.bookings, text("Bestellungen & Buchungen")]}
      />
      <p className={`pill ${tone}`}>{status}</p>
      <p className="small muted">
        {text("bestellt am ")}
        {accountDate(o.created_at, localeOptions)}
      </p>
      <div className="detail-grid">
        <div className="stack">
          {o.fulfillments
            .filter((f) => f.type === "PICKUP")
            .map((f) => (
              <AccountCard key={f.id} title={text("Abholung")}>
                {f.status === "PICKUP_READY" && (
                  <>
                    <div className="pickup-code">
                      <div className="qr-box">
                        <AccountQr code={f.code} label={text("Abholcode")} />
                      </div>
                      <span className="code-big">{f.code}</span>
                    </div>
                    <p>
                      {text(
                        "Zeig den Code an der Theke. Auch jemand anderes kann damit abholen.",
                      )}
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
                  <p>
                    {text("Abholbar bis ")}
                    {accountDate(f.pickup_deadline_at, localeOptions)}.
                  </p>
                )}
                <a className="btn btn-ghost" href={help.routeUrl}>
                  {text("Route planen")}
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
                      {i.quantity} ×{" "}
                      {bookingMoney(i.gross_price_per_item, localeOptions)}
                      {i.cancelled_at
                        ? text(" · storniert")
                        : (i.returned_quantity ?? 0) > 0
                          ? text(" · {0} retourniert", i.returned_quantity)
                          : ""}
                    </span>
                  </span>
                  <span>
                    {bookingMoney(
                      i.quantity * i.gross_price_per_item,
                      localeOptions,
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="totals">
              <div>
                <span>{text("Zwischensumme")}</span>
                <span>
                  {bookingMoney(orderBreakdown(o).subtotal, localeOptions)}
                </span>
              </div>
              {o.fulfillments.map((f) => (
                <div key={f.id}>
                  <span>
                    {f.type === "PICKUP"
                      ? labels.pickup
                      : f.type === "DIGITAL"
                        ? text("Versand per E-Mail")
                        : f.name}
                  </span>
                  <span>{bookingMoney(f.price, localeOptions)}</span>
                </div>
              ))}
              {orderBreakdown(o).discount > 0 && (
                <div>
                  <span>{text("Rabatt")}</span>
                  <span>
                    -{bookingMoney(orderBreakdown(o).discount, localeOptions)}
                  </span>
                </div>
              )}
              {orderBreakdown(o).refunded > 0 && (
                <div>
                  <span>{text("Erstattet")}</span>
                  <span>
                    -{bookingMoney(orderBreakdown(o).refunded, localeOptions)}
                  </span>
                </div>
              )}
              <div className="grand">
                <span>{text("Gesamt")}</span>
                <span>{bookingMoney(orderTotal(o), localeOptions)}</span>
              </div>
              <p className="vat">{text("inkl. gesetzlicher MwSt.")}</p>
            </div>
          </AccountCard>
          <AccountCard title={text("Widerruf")}>
            <p>
              {o.withdrawal?.state === "REQUESTED"
                ? text("Dein Widerruf ist eingegangen und wird geprüft.")
                : o.withdrawal?.state === "EXPIRED"
                  ? text(
                      "Die Widerrufsfrist ist abgelaufen. Bei Mängeln hilft Dir unser Team weiter.",
                    )
                  : o.withdrawal?.state === "ACCEPTED"
                    ? text(
                        "Dein Widerruf wurde angenommen. Die Erstattung folgt.",
                      )
                    : o.withdrawal?.state === "ACCEPTED_REFUNDED"
                      ? text("Dein Widerruf wurde angenommen und erstattet.")
                      : o.withdrawal?.state === "DECLINED" ||
                          (o.withdrawal?.state === "AVAILABLE" &&
                            o.withdrawal.request?.status === "DECLINED")
                        ? text(
                            "Dein Widerruf wurde abgelehnt. Die Begründung haben wir Dir per E-Mail geschickt.",
                          )
                        : o.withdrawal?.state === "DECIDED"
                          ? text("Deine Widerrufsanfrage wurde bearbeitet.")
                          : text(
                              "Die zulässigen Artikel und ihre jeweiligen Fristen findest Du hier.",
                            )}
            </p>
            {o.withdrawal?.state === "AVAILABLE" &&
              o.withdrawal.request?.status === "DECLINED" && (
                <p>
                  {text(
                    "Die zulässigen Artikel und ihre jeweiligen Fristen findest Du hier.",
                  )}
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
                      ? text(withdrawalReasons[i.reason] ?? "") ||
                        text("Für diesen Artikel ist kein Widerruf möglich")
                      : i.return_deadline
                        ? text(
                            "bis {0}",
                            accountDate(i.return_deadline, localeOptions),
                          )
                        : i.is_voucher
                          ? text("Gutschein")
                          : text("Frist beginnt nach Erhalt")}
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
                {text("Vertrag widerrufen")}
              </button>
            )}
            <p role="status">{message}</p>
          </AccountCard>
        </div>
        <div className="stack">
          {o.fulfillments
            .filter((f) => f.type === "SHIPPING")
            .map((f) => (
              <AccountCard title={text("Lieferung")} key={f.id}>
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
                      {text("Sendung verfolgen")}
                    </a>
                  )}
              </AccountCard>
            ))}
          <AccountCard title={text("Bezahlung")}>
            <Payments payments={o.payments} />
          </AccountCard>
          <AccountCard title={text("Dokumente")}>
            {o.has_invoice ? (
              <a
                className="doc-link"
                href={`/api/shop/stripe/invoice/${encodeURIComponent(o.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                {text("Rechnung ")}
                {o.invoice_number ?? ""} {text(" herunterladen")}
                {o.invoice_date && (
                  <span>{accountDate(o.invoice_date, localeOptions)}</span>
                )}
              </a>
            ) : (
              <p>{text("Noch keine Rechnung verfügbar.")}</p>
            )}
            {o.credit_notes?.map((n) => (
              <a
                key={n.id}
                className="doc-link"
                href={`/api/shop/stripe/credit-note/${encodeURIComponent(n.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                {text("Stornorechnung")}{" "}
                {n.credit_note_number ? `${n.credit_note_number} ` : ""}
                {text("herunterladen")}
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
            setMessage(text("Dein Widerruf ist eingegangen."));
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
  onChanged = () => {},
  readOnly = false,
  ...props
}: DashboardProps & {
  /** Authoritative customer table reservation. */
  reservation: AccountReservation;
  /** Host reservation limits, policy and available times. */
  rules?: ReservationRules;
  /** Always suppress changes and cancellation, even when rules are supplied. */
  readOnly?: boolean;
  /** Refresh authoritative host data after a successful mutation. */
  onChanged?: () => void;
}) {
  const localeOptions = useShopventoLocale();

  const text = useMessages("account");

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
    !readOnly &&
    !!rules &&
    Number.isFinite(rules.changeHours) &&
    rules.changeHours >= 0 &&
    r.status === "confirmed" &&
    reservationStartInstant(r.date, r.time) - Date.now() >=
      rules.changeHours * 3600000;
  const hasChanges =
    date !== r.date ||
    time !== r.time ||
    guests !== r.num_guests ||
    notes !== (r.notes ?? "");
  const submit = async () => {
    if (!editable || (sheet === "change" && !hasChanges)) return;
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
          ? text("Deine Reservierung wurde storniert.")
          : text("Deine Reservierung wurde geändert."),
      );
      onChanged();
    } catch (e) {
      setError(accountErrorMessage(e, false, undefined, localeOptions));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AccountHead
        title={text("Tisch für")}
        accent={`${r.num_guests} ${r.num_guests === 1 ? text("Person") : text("Personen")}`}
        eyebrow="Tischreservierung"
        back={[routes.bookings, text("Bestellungen & Buchungen")]}
      />
      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            {rules?.image && (
              <img
                className="event-photo"
                src={rules.image}
                alt={text("Dein reservierter Tisch")}
              />
            )}
            <div className="card-pad stack">
              <span className="pill">
                {r.status === "confirmed"
                  ? text("Bestätigt")
                  : r.status === "cancelled"
                    ? text("Storniert")
                    : r.status === "seated"
                      ? text("Angekommen")
                      : r.status === "no_show"
                        ? text("Nicht erschienen")
                        : text("Vergangen")}
              </span>
              {editable && (
                <AccountCountdown
                  target={reservationStartInstant(r.date, r.time)}
                />
              )}
              <dl className="kv">
                <dt>{text("Datum")}</dt>
                <dd>{accountDate(r.date, localeOptions)}</dd>
                <dt>{text("Uhrzeit")}</dt>
                <dd>
                  {/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(r.time)
                    ? localeTime(r.time, localeOptions.locale, {
                        messages: localeOptions.messages,
                      })
                    : r.time}
                </dd>
                <dt>{text("Personen")}</dt>
                <dd>{r.num_guests}</dd>
                <dt>{text("Dein Hinweis")}</dt>
                <dd>{r.notes ?? text("Kein Hinweis")}</dd>
                <dt>{text("Reserviert am")}</dt>
                <dd>{accountDate(r.created_at, localeOptions)}</dd>
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
                    {text("Ändern")}
                  </button>
                )}
                <a className="btn btn-ghost" href={help.routeUrl}>
                  {text("Route")}
                </a>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    downloadAccountCalendar(
                      {
                        date: r.date,
                        start_time: r.time,
                        end_time: "",
                        event_name: text(
                          "Tisch für {0} {1}",
                          r.num_guests,
                          r.num_guests === 1
                            ? text("Person")
                            : text("Personen"),
                        ),
                        order_id: `reservation-${r.id}`,
                        franchise_location: {
                          id: r.franchise_location_id,
                          location_name: r.location_name ?? "",
                          location_street: help.address,
                        },
                      },
                      localeOptions,
                    )
                  }
                >
                  {text("In den Kalender")}
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
                  {text("Reservierung stornieren")}
                </button>
              ) : rules && !readOnly && r.status === "confirmed" ? (
                <p className="notice">
                  {text(
                    "Ändern und Stornieren geht jetzt nur noch telefonisch.",
                  )}
                </p>
              ) : r.status !== "confirmed" ? (
                <a className="btn" href={routes.reserve}>
                  {text("Wieder reservieren")}
                </a>
              ) : null}
              <p role="status">{message}</p>
            </div>
          </section>
        </div>
        <div className="stack">
          {rules && (
            <AccountCard title={text("Gut zu wissen")}>
              <p>{rules.policy}</p>
              <p>
                {text("Mehr als ")}
                {rules.maxGuests} {text(" Personen? Ruf uns bitte an.")}
              </p>
            </AccountCard>
          )}
          <AccountCard title={text("Ort")}>
            <address>
              {r.location_name}
              <br />
              {help.address}
            </address>
          </AccountCard>
          <AccountHelpCard help={help} />
        </div>
      </div>
      {sheet && editable && rules && (
        <AccountSheet
          title={
            sheet === "change"
              ? text("Reservierung ändern")
              : text("Reservierung stornieren?")
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
                {text(
                  "Schade, dass es nicht klappt. Wir geben den Tisch sofort wieder frei. Das kostet nichts.",
                )}
              </p>
            ) : (
              <div className="form-grid two">
                <label className="field">
                  {text("Datum")}
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
                  {text("Uhrzeit")}
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
                      <option value="">{text("Bitte wählen")}</option>
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
                  {text("Personen")}
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
                  {text("Wünsche, besondere Hinweise")}
                  <textarea
                    className="textarea"
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <p className="small muted">
                  {text(
                    "Beim Speichern prüfen wir, ob der Tisch verfügbar ist.",
                  )}
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
                ? text("Wird gespeichert...")
                : sheet === "cancel"
                  ? text("Ja, stornieren")
                  : text("Änderung speichern")}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => setSheet(null)}
            >
              {text("Abbrechen")}
            </button>
          </form>
        </AccountSheet>
      )}
    </>
  );
}
