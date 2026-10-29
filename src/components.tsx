"use client";
import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type BookingClient,
  type ClientOptions,
  createBookingClient,
  deadlinePassed,
  type GuestContact,
  type GuestFieldErrors,
  type Location,
  type Seat,
  type Tasting,
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
import { Turnstile } from "./turnstile";

const money = (cents: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
function slotLabel(slot: Timewindow) {
  const date = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${slot.date}T12:00:00`));
  return `${date}, ${slot.start_time.slice(0, 5)} Uhr`;
}
export function DateTimePicker({
  windows,
  value,
  onChange,
  seats,
  now = Date.now(),
  locations = [],
}: {
  windows: Timewindow[];
  value: string;
  onChange: (value: string) => void;
  seats: number;
  now?: number;
  locations?: Location[];
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>
        Termin
        <select
          id={id}
          aria-describedby={`${id}-hint`}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Bitte wähle einen Termin</option>
          {windows
            .filter((slot) => !windowTooSoon(slot, now))
            .map((slot) => (
              <option
                key={slot.id}
                value={slot.timewindow_id}
                disabled={!windowBookable(slot, seats, now)}
              >
                {slotLabel(slot)} ·{" "}
                {locations.find((l) => l.id === slot.franchise_location_id)
                  ?.location_name ??
                  (slot.franchise_location_id
                    ? `Standort ${slot.franchise_location_id}`
                    : "Standort bitte erfragen")}{" "}
                ·{" "}
                {deadlinePassed(slot, now)
                  ? "Buchungsfrist abgelaufen"
                  : `${slot.free_spots ?? 0} freie Plätze`}
              </option>
            ))}
        </select>
      </label>
      <small id={`${id}-hint`}>
        Online kannst Du Termine mindestens 24 Stunden im Voraus buchen.
      </small>
    </div>
  );
}
export function SeatSelector({
  seats,
  variants,
  onChange,
  directBookingEnabled,
  maxSeats = Math.max(20, seats.length),
}: {
  seats: Seat[];
  variants: Tasting[];
  onChange: (seats: Seat[]) => void;
  directBookingEnabled: boolean;
  maxSeats?: number;
}) {
  const id = useId();
  function update(index: number, change: Partial<Seat>) {
    onChange(
      seats.map((seat, i) => (i === index ? { ...seat, ...change } : seat)),
    );
  }
  return (
    <fieldset>
      <legend>Deine Plätze</legend>
      <label htmlFor={`${id}-count`}>
        Anzahl Plätze
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
          <legend>Platz {index + 1}</legend>
          <label htmlFor={`${id}-variant-${index}`}>
            Variante
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
            Gutscheincode {directBookingEnabled ? "(optional)" : ""}
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
export function GuestFields({
  contact,
  onChange,
  errors = {},
}: {
  contact: GuestContact;
  errors?: GuestFieldErrors;
  onChange: (value: GuestContact) => void;
}) {
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
      <legend>Deine Kontaktdaten</legend>
      {(
        [
          ["first_name", "Vorname", "text", "given-name"],
          ["last_name", "Nachname", "text", "family-name"],
          ["email", "E-Mail-Adresse", "email", "email"],
          ["phone", "Telefon (optional)", "tel", "tel"],
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
                "Bitte gib Deine Telefonnummer mit internationaler Vorwahl an, z. B. +49 151 23456789."}
            </small>
          )}
        </div>
      ))}
    </fieldset>
  );
}
export function BookingSummary({
  draft,
  variants,
  window,
  location,
}: {
  draft: BookingDraft;
  variants: Tasting[];
  window?: Timewindow;
  location?: Location;
}) {
  const prices = draft.seats.map(
    (seat) =>
      variants.find((v) => (v.variant_id ?? undefined) === seat.variant_id)
        ?.price,
  );
  const complete = prices.every((p): p is number => p !== undefined);
  return (
    <section className="sv-summary" aria-label="Zusammenfassung">
      <h3>Deine Buchung</h3>
      {window && (
        <p>
          {slotLabel(window)}
          {location ? ` · ${location.location_name}` : ""}
        </p>
      )}
      <p>
        {draft.seats.length} {draft.seats.length === 1 ? "Platz" : "Plätze"}
      </p>
      {complete && (
        <p>
          Gesamtpreis vor Gutscheinanrechnung:{" "}
          <strong>{money(prices.reduce((sum, p) => sum + p, 0))}</strong>
        </p>
      )}
      {draft.seats.some((s) => s.voucher_code?.trim()) && (
        <p>
          Deine Gutscheine werden bei der Buchung geprüft. Der verbleibende
          Zahlbetrag wird Dir im Checkout angezeigt.
        </p>
      )}
    </section>
  );
}
export interface TastingBookingProps extends ClientOptions {
  tastingId: number;
  locationId?: number;
  checkoutHosts?: readonly string[];
  guestDisabledMessage?: string;
  termsUrl: string;
  privacyUrl: string;
  turnstileSiteKey?: string;
  /** Guest is the default. Account consumers supply authentication through ClientOptions. */
  mode?: "guest" | "account";
  client?: BookingClient;
  onRedirect?: (url: string) => void;
}
export function TastingBooking(props: TastingBookingProps) {
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
  } = useBookingData(client, props.tastingId, props.locationId);
  const { draft, setDraft, ready, clear } = useBookingDraft(
    `vv:booking:${props.baseUrl}:${props.tastingId}:${props.locationId ?? "all"}:${props.mode ?? "guest"}`,
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
          ? "Online kannst Du Termine mindestens 24 Stunden im Voraus buchen. Bitte wähle einen späteren Termin."
          : slot && deadlinePassed(slot)
            ? "Die Buchungsfrist ist abgelaufen. Bitte wähle einen anderen Termin."
            : "Bitte wähle einen Termin mit genügend freien Plätzen.",
      );
      return;
    }
    if (guest && draft.seats.length > 8) {
      setValidation(
        "Du kannst als Gast höchstens 8 Plätze pro Buchung reservieren.",
      );
      return;
    }
    if (!consent) {
      setValidation("Bitte bestätige die Bedingungen und den Datenschutz.");
      return;
    }
    if (
      !data.settings.direct_booking_enabled &&
      draft.seats.some((s) => !s.voucher_code?.trim())
    ) {
      setValidation("Bitte gib für jeden Platz einen Gutschein ein.");
      return;
    }
    if (
      guest &&
      (!data.settings.guest_booking_enabled ||
        !data.settings.direct_booking_enabled ||
        !token)
    ) {
      setValidation("Bitte bestätige die Sicherheitsprüfung.");
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
        Tastings werden geladen…
      </div>
    );
  if (loadError)
    return (
      <div className="sv-booking">
        <p role="alert">{loadError}</p>
        <button type="button" onClick={reload}>
          Erneut laden
        </button>
      </div>
    );
  if (!data?.variants.length)
    return <p className="sv-booking">Dieses Tasting ist nicht verfügbar.</p>;
  if (
    guest &&
    (!data.settings.guest_booking_enabled ||
      !data.settings.direct_booking_enabled)
  )
    return (
      <p className="sv-booking">
        {props.guestDisabledMessage ??
          "Onlinebuchungen ohne Anmeldung sind derzeit nicht verfügbar. Bitte kontaktiere uns, um dieses Tasting zu buchen."}
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
            ? "Weiter zur Zahlung"
            : error
              ? "Bitte prüfe Deine Buchung"
              : "Deine Buchung wurde angenommen"}
        </h2>
        <p>Buchungsnummer: {result.order_number}</p>
        {result.checkout_url ? (
          <a href={result.checkout_url}>Checkout öffnen</a>
        ) : (
          !error && <p>Die Bestätigung erhältst Du per Mail.</p>
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
          <p>Zurzeit sind keine Termine verfügbar.</p>
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
            Ich akzeptiere die{" "}
            <a href={props.termsUrl} target="_blank" rel="noopener">
              Bedingungen
            </a>{" "}
            und habe die{" "}
            <a href={props.privacyUrl} target="_blank" rel="noopener">
              Datenschutzerklärung
            </a>{" "}
            gelesen.
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
            <p role="alert">Die Sicherheitsprüfung ist nicht eingerichtet.</p>
          ))}
      </fieldset>
      {message && (
        <p className="sv-error" role="alert" tabIndex={-1} ref={alert}>
          {message}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Deine Buchung wird gesendet…" : "Zahlungspflichtig buchen"}
      </button>
    </form>
  );
}
export function BookingResult({
  url = "",
  outcome,
  retryUrl,
}: {
  url?: string;
  outcome: "success" | "cancel";
  retryUrl?: string;
}) {
  let reference: string | null = null;
  try {
    const params = new URL(url, "https://return.invalid").searchParams;
    reference = params.get("order_number") || params.get("session_id");
  } catch {
    /* A malformed URL has no reference. */
  }
  return (
    <section className="sv-booking" aria-label="Buchungsstatus">
      <h2>
        {outcome === "success"
          ? "Danke für Deine Buchung"
          : "Die Zahlung wurde abgebrochen"}
      </h2>
      <p>
        {outcome === "success"
          ? "Deine Zahlung wird geprüft. Die verbindliche Bestätigung erhältst Du per Mail."
          : "Es liegt noch keine Zahlungsbestätigung vor. Du kannst Deine Buchung erneut prüfen."}
      </p>
      {reference && <p>Referenz: {reference}</p>}
      {outcome === "cancel" && retryUrl && (
        <a href={retryUrl}>Zurück zur Buchung</a>
      )}
    </section>
  );
}
