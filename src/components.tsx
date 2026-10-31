"use client";
import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { type BookingLabels, mergeBookingLabels } from "./booking-labels";
import {
  type BookingClient,
  type ClientOptions,
  createBookingClient,
  deadlinePassed,
  type GuestContact,
  type GuestFieldErrors,
  type Location,
  type Seat,
  type ShopEvent,
  type Timewindow,
  windowBookable,
  windowTooSoon,
} from "./client";
import {
  type BookingDraft,
  useBookingData,
  useBookingDraft,
  useSubmitBooking,
} from "./hooks";
import {
  type LocaleOptions,
  localeMoney,
  localeTime,
  ShopventoProvider,
  useMessages,
  useShopventoLocale,
} from "./locale";
import { Turnstile } from "./turnstile";

function slotLabel(slot: Timewindow, options: LocaleOptions = {}) {
  const date = new Intl.DateTimeFormat(options.locale ?? "de", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${slot.date}T12:00:00`));
  return `${date}, ${localeTime(slot.start_time, options.locale, { messages: options.messages })}`;
}
/** Select an eligible timewindow, respecting capacity, deadlines and the 24-hour lead time. */
export function DateTimePicker({
  windows,
  value,
  onChange,
  seats,
  now = Date.now(),
  locations = [],
}: {
  /** Dated availability returned by the API. */
  windows: Timewindow[];
  /** Current controlled value. */
  value: string;
  /** Receive the updated controlled value. */
  onChange: (value: string) => void;
  /** Booked places, or requested seat count depending on the signature. */
  seats: number;
  /** Current instant as milliseconds since the Unix epoch. Defaults to Date.now().
   * @defaultValue Date.now() */
  now?: number;
  /** Public installation locations.
   * @defaultValue [] */
  locations?: Location[];
}) {
  const options = useShopventoLocale();

  const text = useMessages("booking");

  const id = useId();
  return (
    <div>
      <label htmlFor={id}>
        {text("Termin")}
        <select
          id={id}
          aria-describedby={`${id}-hint`}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{text("Bitte wähle einen Termin")}</option>
          {windows
            .filter((slot) => !windowTooSoon(slot, now))
            .map((slot) => (
              <option
                key={slot.id}
                value={slot.timewindow_id}
                disabled={!windowBookable(slot, seats, now)}
              >
                {slotLabel(slot, options)} ·{" "}
                {locations.find((l) => l.id === slot.franchise_location_id)
                  ?.location_name ??
                  (slot.franchise_location_id
                    ? text("Standort {0}", slot.franchise_location_id)
                    : text("Standort bitte erfragen"))}{" "}
                ·{" "}
                {deadlinePassed(slot, now)
                  ? text("Buchungsfrist abgelaufen")
                  : text("{0} freie Plätze", slot.free_spots ?? 0)}
              </option>
            ))}
        </select>
      </label>
      <small id={`${id}-hint`}>
        {text(
          "Online kannst Du Termine mindestens 24 Stunden im Voraus buchen.",
        )}
      </small>
    </div>
  );
}
/** Edit the seat list and assign variants or a voucher to each seat. */
export function SeatSelector({
  seats,
  variants,
  onChange,
  directBookingEnabled,
  maxSeats = Math.max(20, seats.length),
}: {
  /** Booked places, or requested seat count depending on the signature. */
  seats: Seat[];
  /** Public event variants with backend prices. */
  variants: ShopEvent[];
  /** Receive the updated controlled value. */
  onChange: (seats: Seat[]) => void;
  /** Whether the installation allows bookings without a voucher for every seat. */
  directBookingEnabled: boolean;
  /** Maximum number of selectable seats.
   * @defaultValue Math.max(20, seats.length) */
  maxSeats?: number;
}) {
  const options = useShopventoLocale();
  const money = (cents: number) => localeMoney(cents, options.locale);

  const text = useMessages("booking");

  const id = useId();
  function update(index: number, change: Partial<Seat>) {
    onChange(
      seats.map((seat, i) => (i === index ? { ...seat, ...change } : seat)),
    );
  }
  return (
    <fieldset>
      <legend>{text("Deine Plätze")}</legend>
      <label htmlFor={`${id}-count`}>
        {text("Anzahl Plätze")}
        <select
          id={`${id}-count`}
          value={seats.length}
          onChange={(e) => {
            const count = Number(e.target.value);
            onChange(
              Array.from(
                { length: count },
                (_, i) =>
                  seats[i] ?? {
                    variant_id: variants[0]?.variant_id ?? undefined,
                  },
              ),
            );
          }}
        >
          {Array.from({ length: maxSeats }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Numeric options have fixed identity and order.
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
      {seats.map((seat, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Seats are only appended or removed from the end.
        <fieldset key={`${id}-${index}`}>
          <legend>
            {text("Platz ")}
            {index + 1}
          </legend>
          <label htmlFor={`${id}-variant-${index}`}>
            {text("Variante")}
            <select
              id={`${id}-variant-${index}`}
              required={variants.every((v) => Boolean(v.variant_id))}
              value={seat.variant_id ?? ""}
              onChange={(e) =>
                update(index, { variant_id: e.target.value || undefined })
              }
            >
              {variants.map((variant) => (
                <option
                  key={variant.variant_id ?? "base"}
                  value={variant.variant_id ?? ""}
                >
                  {variant.variant_name ?? variant.tasting_name} ·{" "}
                  {money(variant.price)}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-voucher-${index}`}>
            {text("Gutscheincode ")}
            {directBookingEnabled ? text("(optional)") : ""}
            <input
              id={`${id}-voucher-${index}`}
              value={seat.voucher_code ?? ""}
              maxLength={255}
              required={!directBookingEnabled}
              onChange={(e) => update(index, { voucher_code: e.target.value })}
              autoComplete="off"
            />
          </label>
        </fieldset>
      ))}
    </fieldset>
  );
}
/** Edit guest contact details and show field-level validation errors. */
export function GuestFields({
  contact,
  onChange,
  errors = {},
}: {
  /** Guest contact fields. */
  contact: GuestContact;
  /** Field validation messages.
   * @defaultValue {} */
  errors?: GuestFieldErrors;
  /** Receive the updated controlled value. */
  onChange: (value: GuestContact) => void;
}) {
  const text = useMessages("booking");

  const id = useId();
  const [dismissed, setDismissed] = useState<{
    errors: GuestFieldErrors;
    fields: GuestFieldErrors;
  }>({ errors, fields: {} });
  const visibleErrors = { ...errors };
  if (dismissed.errors === errors)
    for (const key of Object.keys(dismissed.fields) as Array<
      keyof GuestContact
    >)
      delete visibleErrors[key];
  return (
    <fieldset>
      <legend>{text("Deine Kontaktdaten")}</legend>
      {(
        [
          ["first_name", text("Vorname"), "text", "given-name"],
          ["last_name", text("Nachname"), "text", "family-name"],
          ["email", text("E-Mail-Adresse"), "email", "email"],
          ["phone", text("Telefon (optional)"), "tel", "tel"],
        ] as const
      ).map(([key, label, type, complete]) => (
        <div key={key}>
          <label htmlFor={`${id}-${key}`}>
            {label}
            <input
              id={`${id}-${key}`}
              type={type}
              aria-invalid={Boolean(visibleErrors[key])}
              aria-describedby={
                key === "phone" || visibleErrors[key]
                  ? `${id}-${key}-hint`
                  : undefined
              }
              autoComplete={complete}
              maxLength={key === "phone" ? 60 : 200}
              required={key !== "phone"}
              value={contact[key] ?? ""}
              onChange={(e) => {
                setDismissed((previous) => ({
                  errors,
                  fields: {
                    ...(previous.errors === errors ? previous.fields : {}),
                    [key]: "dismissed",
                  },
                }));
                onChange({ ...contact, [key]: e.target.value });
              }}
            />
          </label>
          {(key === "phone" || visibleErrors[key]) && (
            <small
              id={`${id}-${key}-hint`}
              className={visibleErrors[key] ? "sv-field-error" : undefined}
            >
              {visibleErrors[key] ??
                text(
                  "Bitte gib Deine Telefonnummer mit internationaler Vorwahl an, z. B. +49 151 23456789.",
                )}
            </small>
          )}
        </div>
      ))}
    </fieldset>
  );
}
/** Display the selected date, seats and undiscounted variant prices before backend validation. */
export function BookingSummary({
  draft,
  variants,
  window,
  location,
}: {
  /** Draft in the booking summary contract. */
  draft: BookingDraft;
  /** Public event variants with backend prices. */
  variants: ShopEvent[];
  /** Selected dated timewindow. Optional; omitted unless supplied by the host or backend. */
  window?: Timewindow;
  /** Selected installation location. Optional; omitted unless supplied by the host or backend. */
  location?: Location;
}) {
  const options = useShopventoLocale();
  const money = (cents: number) => localeMoney(cents, options.locale);

  const text = useMessages("booking");

  const prices = draft.seats.map(
    (seat) =>
      variants.find((v) => (v.variant_id ?? undefined) === seat.variant_id)
        ?.price,
  );
  const complete = prices.every((p): p is number => p !== undefined);
  return (
    <section className="sv-summary" aria-label={text("Zusammenfassung")}>
      <h3>{text("Deine Buchung")}</h3>
      {window && (
        <p>
          {slotLabel(window, options)}
          {location ? ` · ${location.location_name}` : ""}
        </p>
      )}
      <p>
        {draft.seats.length}{" "}
        {draft.seats.length === 1 ? text("Platz") : text("Plätze")}
      </p>
      {complete && (
        <p>
          {text("Gesamtpreis vor Gutscheinanrechnung:")}{" "}
          <strong>{money(prices.reduce((sum, p) => sum + p, 0))}</strong>
        </p>
      )}
      {draft.seats.some((s) => s.voucher_code?.trim()) && (
        <p>
          {text(
            "Deine Gutscheine werden bei der Buchung geprüft. Der verbleibende Zahlbetrag wird Dir im Checkout angezeigt.",
          )}
        </p>
      )}
    </section>
  );
}
/** Host configuration for the compact booking form. */
export interface EventBookingOptions extends ClientOptions, LocaleOptions {
  /** Host-owned copy overrides or account terminology. Optional; omitted unless supplied by the host or backend. */
  labels?: Partial<BookingLabels>;
  /** Positive installation location identifier used to filter availability. Optional; omitted unless supplied by the host or backend. */
  locationId?: number;
  /** Allowed HTTPS checkout hostnames. Defaults to checkout.stripe.com. Optional; omitted unless supplied by the host or backend. */
  checkoutHosts?: readonly string[];
  /** Override the disabled guest booking notice; takes precedence over labels. Optional; omitted unless supplied by the host or backend. */
  guestDisabledMessage?: string;
  /** Host terms and conditions URL. */
  termsUrl: string;
  /** Host privacy policy URL. */
  privacyUrl: string;
  /** Public Turnstile site key required for guest submission. Optional; omitted unless supplied by the host or backend. */
  turnstileSiteKey?: string;
  /** Guest is the default. Account consumers supply authentication through ClientOptions. */
  mode?: "guest" | "account";
  /** Stable client instance used for API requests. Optional; omitted unless supplied by the host or backend. */
  client?: BookingClient;
  /** Navigate to a validated checkout URL; defaults to window.location.assign. Optional; omitted unless supplied by the host or backend. */
  onRedirect?: (url: string) => void;
}
/** Event booking configuration with a required event identifier. */
export type EventBookingProps = EventBookingOptions & {
  /** Public event identifier used to select variants and availability. */
  eventId: number;
};
/** Render a compact event booking form with date, seats, vouchers, guest contact, consent and payment redirect.
 * @param props - Props supplied by the host. */
function EventBookingContent(props: EventBookingProps) {
  const options = useShopventoLocale();

  const text = useMessages("booking");

  const labels = mergeBookingLabels(props.labels, options);
  const eventId = props.eventId;
  const callbacks = useRef(props);
  callbacks.current = props;
  const client = useMemo(
    () =>
      props.client ??
      createBookingClient({
        baseUrl: props.baseUrl,
        fetch: (...args) =>
          (callbacks.current.fetch ?? globalThis.fetch)(...args),
        credentials: props.credentials,
        getAccessToken: () => callbacks.current.getAccessToken?.(),
      }),
    [props.client, props.baseUrl, props.credentials],
  );
  const {
    data,
    error: loadError,
    loading,
    reload,
  } = useBookingData(client, eventId, props.locationId);
  const { draft, setDraft, ready, clear } = useBookingDraft(
    `vv:booking:${props.baseUrl}:${eventId}:${props.locationId ?? "all"}:${props.mode ?? "guest"}`,
  );
  const { submit, pending, error, fieldErrors, result } = useSubmitBooking(
    client,
    props.onRedirect ?? ((url) => window.location.assign(url)),
    props.checkoutHosts,
  );
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [challenge, setChallenge] = useState(0);
  const [validation, setValidation] = useState<string | null>(null);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const alert = useRef<HTMLParagraphElement>(null);
  const guest = (props.mode ?? "guest") === "guest";
  const message = validation ?? error;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Repeated validation must refocus the alert.
  useEffect(() => {
    if (message) alert.current?.focus();
  }, [message, validationAttempt]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!ready || !data?.variants.length) return;
    setDraft((current) => ({
      ...current,
      seats: current.seats.map((seat) =>
        data.variants.some(
          (v) => (v.variant_id ?? undefined) === seat.variant_id,
        )
          ? seat
          : { ...seat, variant_id: data.variants[0].variant_id ?? undefined },
      ),
    }));
  }, [ready, data, setDraft]);
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setValidationAttempt((attempt) => attempt + 1);
    setValidation(null);
    if (!data || pending || result) return;
    const slot = data.windows.find(
      (w) => w.timewindow_id === draft.timewindow_id,
    );
    if (!slot || !windowBookable(slot, draft.seats.length)) {
      setValidation(
        slot && windowTooSoon(slot)
          ? text(
              "Online kannst Du Termine mindestens 24 Stunden im Voraus buchen. Bitte wähle einen späteren Termin.",
            )
          : slot && deadlinePassed(slot)
            ? text(
                "Die Buchungsfrist ist abgelaufen. Bitte wähle einen anderen Termin.",
              )
            : text("Bitte wähle einen Termin mit genügend freien Plätzen."),
      );
      return;
    }
    if (guest && draft.seats.length > 8) {
      setValidation(
        text("Du kannst als Gast höchstens 8 Plätze pro Buchung reservieren."),
      );
      return;
    }
    if (!consent) {
      setValidation(
        text("Bitte bestätige die Bedingungen und den Datenschutz."),
      );
      return;
    }
    if (
      !data.settings.direct_booking_enabled &&
      draft.seats.some((s) => !s.voucher_code?.trim())
    ) {
      setValidation(text("Bitte gib für jeden Platz einen Gutschein ein."));
      return;
    }
    if (
      guest &&
      (!data.settings.guest_booking_enabled ||
        !data.settings.direct_booking_enabled ||
        !token)
    ) {
      setValidation(text("Bitte bestätige die Sicherheitsprüfung."));
      return;
    }
    const response = await submit(draft, guest, token, consent);
    if (response) clear();
    else if (guest) {
      setToken("");
      setChallenge((c) => c + 1);
    }
  }
  if (loading || !ready)
    return (
      <div className="sv-booking" role="status">
        {labels.eventsLoading}
      </div>
    );
  if (loadError)
    return (
      <div className="sv-booking">
        <p role="alert">{loadError}</p>
        <button type="button" onClick={reload}>
          {text("Erneut laden")}
        </button>
      </div>
    );
  if (!data?.variants.length)
    return <p className="sv-booking">{labels.eventUnavailable}</p>;
  if (
    guest &&
    (!data.settings.guest_booking_enabled ||
      !data.settings.direct_booking_enabled)
  )
    return (
      <p className="sv-booking">
        {props.guestDisabledMessage ?? labels.guestDisabled}
      </p>
    );
  if (result)
    return (
      <div className="sv-booking" role="status">
        {error && (
          <p role="alert" tabIndex={-1} ref={alert}>
            {error}
          </p>
        )}
        <h2>
          {result.checkout_url
            ? text("Weiter zur Zahlung")
            : error
              ? text("Bitte prüfe Deine Buchung")
              : text("Deine Buchung wurde angenommen")}
        </h2>
        <p>
          {text("Buchungsnummer: ")}
          {result.order_number}
        </p>
        {result.checkout_url ? (
          <a href={result.checkout_url}>{text("Checkout öffnen")}</a>
        ) : (
          !error && <p>{text("Die Bestätigung erhältst Du per Mail.")}</p>
        )}
      </div>
    );
  const slot = data.windows.find(
    (w) => w.timewindow_id === draft.timewindow_id,
  );
  return (
    <form className="sv-booking" onSubmit={onSubmit}>
      <h2>{data.variants[0].tasting_name}</h2>
      <fieldset disabled={pending}>
        <DateTimePicker
          windows={data.windows}
          value={draft.timewindow_id}
          seats={draft.seats.length}
          now={now}
          locations={data.locations}
          onChange={(value) =>
            setDraft((d) => ({ ...d, timewindow_id: value }))
          }
        />
        {data.windows.length === 0 && (
          <p>{text("Zurzeit sind keine Termine verfügbar.")}</p>
        )}
        <SeatSelector
          seats={draft.seats}
          variants={data.variants}
          directBookingEnabled={data.settings.direct_booking_enabled}
          maxSeats={guest ? 8 : Math.max(20, draft.seats.length)}
          onChange={(seats) => setDraft((d) => ({ ...d, seats }))}
        />
        {guest && (
          <GuestFields
            contact={draft.contact}
            errors={fieldErrors}
            onChange={(contact) => setDraft((d) => ({ ...d, contact }))}
          />
        )}
        <BookingSummary
          draft={draft}
          variants={data.variants}
          window={slot}
          location={data.locations.find(
            (l) => l.id === slot?.franchise_location_id,
          )}
        />
        <label className="sv-consent">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            {text("Ich akzeptiere die")}{" "}
            <a href={props.termsUrl} target="_blank" rel="noopener">
              {text("Bedingungen")}
            </a>{" "}
            {text("und habe die")}{" "}
            <a href={props.privacyUrl} target="_blank" rel="noopener">
              {text("Datenschutzerklärung")}
            </a>{" "}
            {text("gelesen.")}
          </span>
        </label>
        {guest &&
          (props.turnstileSiteKey ? (
            <Turnstile
              key={challenge}
              siteKey={props.turnstileSiteKey}
              onToken={setToken}
            />
          ) : (
            <p role="alert">
              {text("Die Sicherheitsprüfung ist nicht eingerichtet.")}
            </p>
          ))}
      </fieldset>
      {message && (
        <p className="sv-error" role="alert" tabIndex={-1} ref={alert}>
          {message}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending
          ? text("Deine Buchung wird gesendet…")
          : text("Zahlungspflichtig buchen")}
      </button>
    </form>
  );
}
/** Display a checkout return reference. A success URL is not proof of payment. */
export function BookingResult({
  url = "",
  outcome,
  retryUrl,
}: {
  /** Return-page URL used only for the optional reference, not payment verification.
   * @defaultValue "" */
  url?: string;
  /** Whether the backend returned to the success or cancel route. */
  outcome: "success" | "cancel";
  /** Optional host route for retry navigation. Optional; omitted unless supplied by the host or backend. */
  retryUrl?: string;
}) {
  const text = useMessages("booking");

  let reference: string | null = null;
  try {
    const params = new URL(url, "https://return.invalid").searchParams;
    reference = params.get("order_number") || params.get("session_id");
  } catch {
    /* A malformed URL has no reference. */
  }
  return (
    <section className="sv-booking" aria-label={text("Buchungsstatus")}>
      <h2>
        {outcome === "success"
          ? text("Danke für Deine Buchung")
          : text("Die Zahlung wurde abgebrochen")}
      </h2>
      <p>
        {outcome === "success"
          ? text(
              "Deine Zahlung wird geprüft. Die verbindliche Bestätigung erhältst Du per Mail.",
            )
          : text(
              "Es liegt noch keine Zahlungsbestätigung vor. Du kannst Deine Buchung erneut prüfen.",
            )}
      </p>
      {reference && (
        <p>
          {text("Referenz: ")}
          {reference}
        </p>
      )}
      {outcome === "cancel" && retryUrl && (
        <a href={retryUrl}>{text("Zurück zur Buchung")}</a>
      )}
    </section>
  );
}

/** Render EventBooking in a per-visitor or per-route language scope. */
export function EventBooking(
  props: Parameters<typeof EventBookingContent>[0] & LocaleOptions,
) {
  return (
    <ShopventoProvider locale={props.locale} messages={props.messages}>
      <EventBookingContent {...props} />
    </ShopventoProvider>
  );
}
