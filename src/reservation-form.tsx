"use client";

import { useAccountContactPrefill } from "./account-contact-prefill";
import { NewsletterSignup } from "./newsletter-signup";
import {
  type OpeningSettings,
  openingWindow,
  timeInOpeningWindow,
} from "./opening-window";
import {
  maskReservationDate,
  publicApiError,
  reservationDate,
} from "./public-form-api";
import {
  defaultPublicFormApi,
  type PublicFormOptions,
  PublicFormScript,
} from "./public-form-options";

const reservationGuests = { min: 2, max: 8 };

import { type FormEvent, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
  }
}

type Status = "idle" | "submitting" | "success" | "inquiry" | "error";

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--sv-font, Georgia, serif)",
  fontSize: 16,
  padding: "12px 14px",
  border: "1px solid var(--sv-border-2, #ccc)",
  background: "var(--sv-background, #fff)",
  color: "var(--sv-text, #1f1f1f)",
  width: "100%",
  borderRadius: 2,
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--sv-font-label, ui-monospace, monospace)",
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--sv-text-2, #444)",
  marginBottom: 6,
  display: "block",
};

function normalizeTimeInput(val: string): string {
  if (!val) return "";
  const digits = val.replace(/[^\d]/g, "");
  if (digits.length === 4) {
    const h = parseInt(digits.slice(0, 2), 10);
    const m = parseInt(digits.slice(2, 4), 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
    }
  } else if (digits.length === 3) {
    const h = parseInt(digits.slice(0, 1), 10);
    const m = parseInt(digits.slice(1, 3), 10);
    if (h >= 0 && h <= 9 && m >= 0 && m <= 59) {
      return `0${h}:${digits.slice(1, 3)}`;
    }
  } else if (digits.length === 1 || digits.length === 2) {
    const h = parseInt(digits, 10);
    if (h >= 0 && h <= 23) {
      return `${h.toString().padStart(2, "0")}:00`;
    }
  }
  return val.trim();
}

/** Props for the public table reservation form, runtime settings and host editorial slots. */
export interface ReservationFormProps extends PublicFormOptions {
  /** Public challenge key; runtime settings take precedence. */
  siteKey: string;
  /** Disable optional account contact prefill. */
  accountEnabled?: boolean;
  /** Show the terms link. */
  termsEnabled?: boolean;
  /** Terms route. */
  termsUrl?: string;
  /** Group enquiry URL. */
  groupInquiryHref?: string;
  /** Customer service telephone link. */
  phoneHref?: string;
  /** Customer service telephone text. */
  phoneLabel?: string;
  /** Optional account invitation after a guest reservation. */
  renderGuestAccountHint?: (email: string) => React.ReactNode;
  /** Host newsletter wrapper, sharing copy and public API configuration. */
  NewsletterComponent?: React.ComponentType<
    import("./newsletter-signup").NewsletterSignupProps
  >;
}
/** Table reservation form with runtime party limits, opening hours, strict calendar dates and Turnstile. */
export function ReservationForm({
  siteKey,
  publicApi = defaultPublicFormApi,
  ScriptComponent = PublicFormScript,
  labels = {},
  privacyUrl = "/datenschutz",
  accountEnabled = true,
  termsEnabled = true,
  termsUrl = "/agb",
  groupInquiryHref,
  phoneHref,
  phoneLabel,
  renderGuestAccountHint,
  NewsletterComponent = NewsletterSignup,
}: ReservationFormProps) {
  const text = (value: string, ...args: unknown[]) =>
    (labels[value] ?? value).replace(/\{(\d+)\}/g, (match, index: string) =>
      Number(index) < args.length ? String(args[Number(index)]) : match,
    );
  const [status, setStatus] = useState<Status>("idle");
  const [apiSiteKey, setApiSiteKey] = useState<string | null>(null);
  const [limits, setLimits] = useState(reservationGuests);
  const [dateValue, setDateValue] = useState("");
  const [openingSettings, setOpeningSettings] = useState<OpeningSettings>({});
  const [newsletter, setNewsletter] = useState(false);
  const newsletterAttempted = useRef(false);
  const inFlight = useRef(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scriptEnabled] = useState(true);
  const [timeValue, setTimeValue] = useState("");
  const [timeTouched, setTimeTouched] = useState(false);
  const widgetIdRef = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const formRootRef = useRef<HTMLFormElement>(null);
  const contact = useAccountContactPrefill(accountEnabled);

  let isoDate: string | null = null;
  let dateError: string | null = null;
  if (dateValue.length === 10) {
    try {
      isoDate = reservationDate(dateValue);
    } catch (error) {
      dateError =
        error instanceof Error
          ? text(error.message)
          : text("Bitte gib ein gültiges Datum ein.");
    }
  }
  const opening = isoDate ? openingWindow(isoDate, openingSettings) : null;
  if (opening?.kind === "closed") {
    dateError = text(
      "Am {0} haben wir geschlossen.{1}",
      dateValue,
      opening.label ? ` (${opening.label})` : "",
    );
  }
  const dateMessage =
    dateError ??
    (opening?.kind === "open"
      ? text(
          "Reservierungen ab {0} Uhr bis vor {1} Uhr.",
          opening.opens,
          opening.closes,
        )
      : null);
  const timeInvalid =
    opening?.kind === "open" &&
    Boolean(timeValue) &&
    !timeInOpeningWindow(normalizeTimeInput(timeValue), opening);
  // Shown after blur or a submit attempt, so typing "1" for "12:30" does not flash an error.
  const timeError =
    timeInvalid && timeTouched && opening?.kind === "open"
      ? text(
          "Bitte wähle eine Uhrzeit ab {0} Uhr bis vor {1} Uhr.",
          opening.opens,
          opening.closes,
        )
      : null;
  const fieldMessageStyle: React.CSSProperties = {
    fontFamily: "var(--sv-font, Georgia, serif)",
    fontSize: 14,
    lineHeight: 1.5,
    margin: "6px 0 0",
    color: "var(--sv-text-2, #444)",
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Preserve transaction lifecycle; host adapters must keep stable identities.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const config = await publicApi();
        if (!config.shopvento) {
          if (active) setApiSiteKey(siteKey);
          return;
        }
        if (
          !Number.isInteger(config.locationId) ||
          Number(config.locationId) < 1
        )
          throw new Error("Reservation location missing");
        const response = await fetch(
          `/api/table-reservations/public/settings?location_id=${config.locationId}`,
          { cache: "no-store" },
        );
        if (!response.ok)
          throw new Error(
            text("Online-Reservierungen sind gerade nicht verfügbar."),
          );
        const settings = (await response.json()) as {
          ready: boolean;
          turnstile_site_key: string;
          online_party_min: number;
          online_party_max: number;
        } & OpeningSettings;
        if (!settings.ready || !settings.turnstile_site_key)
          throw new Error(
            text("Die Sicherheitsprüfung ist gerade nicht verfügbar."),
          );
        if (active) {
          setOpeningSettings(settings);
          setLimits({
            min: settings.online_party_min,
            max: settings.online_party_max,
          });
          setApiSiteKey(settings.turnstile_site_key);
        }
      } catch {
        if (active)
          setErrorMsg(
            text(
              "Online-Reservierungen sind gerade nicht verfügbar. Bitte rufe uns an.",
            ),
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [siteKey]);

  // Render Turnstile widget once script + container are ready.
  useEffect(() => {
    if (apiSiteKey === null) return;
    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      if (!window.turnstile || !turnstileContainerRef.current) {
        window.setTimeout(tryRender, 80);
        return;
      }
      if (widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(
        turnstileContainerRef.current,
        {
          sitekey: apiSiteKey,
          theme: "light",
          "expired-callback": () => {
            if (widgetIdRef.current)
              window.turnstile?.reset(widgetIdRef.current);
          },
          "error-callback": () => {
            if (widgetIdRef.current)
              window.turnstile?.reset(widgetIdRef.current);
          },
        },
      );
    };
    tryRender();
    return () => {
      cancelled = true;
    };
  }, [apiSiteKey]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    if (dateError || timeInvalid) {
      setTimeTouched(true);
      setErrorMsg(null);
      e.currentTarget
        .querySelector<HTMLInputElement>(
          dateError ? "#resv-date" : "#resv-time",
        )
        ?.focus();
      return;
    }
    inFlight.current = true;

    setStatus("submitting");
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    const turnstileToken =
      window.turnstile?.getResponse(widgetIdRef.current ?? undefined) ?? "";
    if (!turnstileToken) {
      inFlight.current = false;
      setStatus("error");
      setErrorMsg(
        text(
          "Bitte bestätige kurz die Sicherheitsprüfung (Spamschutz) und klicke erneut auf Absenden.",
        ),
      );
      if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
      return;
    }

    const rawTime = String(formData.get("time") ?? timeValue);
    const normalizedTime = normalizeTimeInput(rawTime);

    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      date: String(formData.get("date") ?? ""),
      time: normalizedTime,
      guests: String(formData.get("guests") ?? "2"),
      message: String(formData.get("message") ?? ""),
      newsletter: formData.get("newsletter") === "on",
      turnstileToken,
    };

    try {
      const config = await publicApi();
      const date = reservationDate(payload.date);
      const res = await fetch(
        config.shopvento
          ? "/api/table-reservations/public"
          : "/api/reservation",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            config.shopvento
              ? {
                  franchise_location_id: config.locationId,
                  date,
                  time: payload.time,
                  num_guests: Number(payload.guests),
                  guest_name: payload.name,
                  guest_email: payload.email,
                  guest_phone: payload.phone,
                  notes: payload.message,
                  turnstile_token: turnstileToken,
                }
              : { ...payload, date },
          ),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        detail?: string;
        ok?: boolean;
        confirmed?: boolean;
        error?: string;
      };

      if (res.ok && data.status === "inquiry") {
        setStatus("inquiry");
        return;
      }
      if (res.ok && (data.status === "confirmed" || data.ok)) {
        setNewsletter(config.shopvento && payload.newsletter);
        setGuestEmail(payload.email);
        setConfirmed(data.status === "confirmed" || Boolean(data.confirmed));
        setStatus("success");
        return;
      }
      setStatus("error");
      setErrorMsg(
        data.error ??
          (typeof data.detail === "string"
            ? data.detail
            : text(publicApiError(res.status))),
      );
      window.turnstile?.reset(widgetIdRef.current ?? undefined);
    } catch (error) {
      setStatus("error");
      setErrorMsg(
        error instanceof Error && error.message.startsWith("Bitte gib")
          ? text(error.message)
          : text(
              "Verbindung fehlgeschlagen. Bitte versuche es erneut oder rufe uns an.",
            ),
      );
      window.turnstile?.reset(widgetIdRef.current ?? undefined);
    } finally {
      inFlight.current = false;
    }
  }

  if (status === "inquiry")
    return (
      <div
        className="sv-reservation"
        role="status"
        style={{
          background: "var(--sv-background, #fff)",
          padding: 36,
          border: "1px solid var(--sv-border-2, #ccc)",
          fontFamily: "var(--sv-font, Georgia, serif)",
          lineHeight: 1.6,
        }}
      >
        <h2>{text("Für Gruppen ab {0} Personen", limits.max + 1)}</h2>
        <p>
          {text(
            "Es wurde kein Tisch reserviert und keine Anfrage versendet. Bitte ",
          )}
          <a href={groupInquiryHref}>{text("sende uns eine Gruppenanfrage")}</a>
          {text(" oder rufe uns unter ")}
          <a href={phoneHref}>{phoneLabel}</a> {text(" an.")}
        </p>
      </div>
    );

  if (status === "success") {
    return (
      <>
        <div
          className="sv-reservation"
          style={{
            background: "var(--sv-background, #fff)",
            padding: 44,
            border: "1px solid var(--sv-border-2, #ccc)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <p
            style={{
              fontFamily: "var(--sv-font-label, ui-monospace, monospace)",
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--sv-accent, #0b5cad)",
              margin: 0,
            }}
          >
            {confirmed
              ? text("✓ Tisch reserviert")
              : text("✓ Anfrage gesendet")}
          </p>
          <h2
            style={{
              fontFamily: "var(--sv-font-display, Georgia, serif)",
              fontSize: 36,
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            {text("Vielen Dank!")}
          </h2>
          <p
            style={{
              fontFamily: "var(--sv-font, Georgia, serif)",
              fontSize: 17,
              lineHeight: 1.6,
              color: "var(--sv-text-2, #444)",
              margin: 0,
            }}
          >
            {confirmed
              ? text(
                  "Dein Tisch ist verbindlich reserviert. Schau gleich in Deinem Posteingang nach: Dort wartet Deine Bestätigung, mit der Du die Reservierung bei Bedarf auch wieder stornieren kannst.",
                )
              : text(
                  "Wir haben Deine Reservierungsanfrage erhalten und melden uns zeitnah mit einer Bestätigung. Schau gleich auch in Deinem Posteingang nach.",
                )}
          </p>
          {renderGuestAccountHint?.(guestEmail)}
          {newsletter && (
            <NewsletterComponent
              siteKey={siteKey}
              initialEmail={guestEmail}
              source="reservation"
              variant="card"
              automatic={{
                onAttempt: () => {
                  if (newsletterAttempted.current) return false;
                  newsletterAttempted.current = true;
                  return true;
                },
              }}
            />
          )}
          <p
            style={{
              fontFamily: "var(--sv-font, Georgia, serif)",
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--sv-text-3, #666)",
              margin: 0,
            }}
          >
            {text("Wenn es dringend ist, ruf uns auch gerne direkt an:")}{" "}
            <a href={phoneHref} style={{ color: "var(--sv-primary, #0b5cad)" }}>
              {phoneLabel}
            </a>
            .
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {scriptEnabled && (
        <ScriptComponent
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
        />
      )}
      <form
        className="sv-reservation"
        ref={formRootRef}
        onSubmit={onSubmit}
        style={{
          background: "var(--sv-background, #fff)",
          padding: 36,
          border: "1px solid var(--sv-border-2, #ccc)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--sv-font-label, ui-monospace, monospace)",
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--sv-accent, #0b5cad)",
              margin: 0,
              marginBottom: 8,
            }}
          >
            {text("Tisch anfragen")}
          </p>
          <h2
            style={{
              fontFamily: "var(--sv-font-display, Georgia, serif)",
              fontSize: 28,
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {text("Wir freuen uns auf Euch.")}
          </h2>
        </div>

        <div>
          <label htmlFor="resv-name" style={labelStyle}>
            {text("Name *")}
          </label>
          <input
            id="resv-name"
            name="name"
            {...contact.name}
            type="text"
            required
            maxLength={120}
            autoComplete="name"
            style={inputStyle}
          />
        </div>

        <div className="sv-reservation-fields-two">
          <div>
            <label htmlFor="resv-email" style={labelStyle}>
              {text("E-Mail *")}
            </label>
            <input
              id="resv-email"
              name="email"
              {...contact.email}
              type="email"
              required
              maxLength={200}
              autoComplete="email"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="resv-phone" style={labelStyle}>
              {text("Telefon")}
            </label>
            <input
              id="resv-phone"
              name="phone"
              {...contact.phone}
              type="tel"
              maxLength={60}
              autoComplete="tel"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="sv-reservation-fields-three">
          <div>
            <label htmlFor="resv-date" style={labelStyle}>
              {text("Datum *")}
            </label>
            <input
              id="resv-date"
              name="date"
              type="text"
              inputMode="numeric"
              placeholder={text("TT.MM.JJJJ")}
              pattern="[0-9]{2}[.][0-9]{2}[.][0-9]{4}"
              maxLength={10}
              value={dateValue}
              onChange={(e) =>
                setDateValue(maskReservationDate(e.target.value))
              }
              required
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateMessage ? "resv-date-message" : undefined}
              style={inputStyle}
            />
            {dateMessage && (
              <p
                id="resv-date-message"
                role={dateError ? "alert" : undefined}
                style={{
                  ...fieldMessageStyle,
                  color: dateError
                    ? "var(--sv-primary, #0b5cad)"
                    : "var(--sv-text-2, #444)",
                }}
              >
                {dateMessage}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="resv-time" style={labelStyle}>
              {text("Uhrzeit *")}
            </label>
            <input
              id="resv-time"
              name="time"
              type="text"
              required
              value={timeValue}
              aria-invalid={Boolean(timeError)}
              aria-describedby={timeError ? "resv-time-message" : undefined}
              placeholder="z. B. 18:30"
              onChange={(e) => setTimeValue(e.target.value)}
              onBlur={() => {
                setTimeValue((prev) => normalizeTimeInput(prev));
                setTimeTouched(true);
              }}
              style={inputStyle}
            />
            {timeError && (
              <p
                id="resv-time-message"
                role="alert"
                style={{
                  ...fieldMessageStyle,
                  color: "var(--sv-primary, #0b5cad)",
                }}
              >
                {timeError}
              </p>
            )}
          </div>
          <div>
            <p style={{ margin: "0 0 20px" }}>
              {text("Für Gruppen ab 9 Personen sende uns bitte eine ")}
              <a
                href={groupInquiryHref}
                style={{ color: "var(--sv-primary, #0b5cad)" }}
              >
                {text("Anfrage")}
              </a>
              {text(". Du erhältst ein individuelles Angebot.")}
            </p>
            <label htmlFor="resv-guests" style={labelStyle}>
              {text("Personen * ({0} bis {1})", limits.min, limits.max)}
            </label>
            <select
              id="resv-guests"
              name="guests"
              required
              defaultValue="2"
              style={inputStyle}
            >
              {Array.from(
                { length: limits.max - limits.min + 1 },
                (_, i) => i + limits.min,
              ).map((n) => (
                <option key={n} value={n}>
                  {n} {text(" Personen")}
                </option>
              ))}
              <option value={String(limits.max + 1)}>
                {text("{0} oder mehr Personen (Anfrage)", limits.max + 1)}
              </option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="resv-message" style={labelStyle}>
            {text("Nachricht (optional)")}
          </label>
          <textarea
            id="resv-message"
            name="message"
            rows={4}
            maxLength={2000}
            placeholder={text("Wünsche, besondere Hinweise")}
            style={{
              ...inputStyle,
              resize: "vertical",
              minHeight: 100,
              fontFamily: "var(--sv-font, Georgia, serif)",
            }}
          />
        </div>

        <label
          htmlFor="resv-newsletter"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontFamily: "var(--sv-font, Georgia, serif)",
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--sv-text-2, #444)",
            cursor: "pointer",
            padding: "8px 0",
          }}
        >
          <input
            id="resv-newsletter"
            name="newsletter"
            type="checkbox"
            style={{
              marginTop: 3,
              width: 16,
              height: 16,
              accentColor: "var(--sv-primary, #0b5cad)",
              flexShrink: 0,
              cursor: "pointer",
            }}
          />
          <span>
            <strong style={{ color: "var(--sv-text, #1f1f1f)" }}>
              {text("Newsletter abonnieren")}
            </strong>
            {text(
              ", gelegentliche Hinweise auf Veranstaltungen und Empfehlungen. Du erhältst zur Bestätigung eine separate E-Mail (Double-Opt-in). Abmeldung jederzeit über den Link in jeder E-Mail. ",
            )}
          </span>
        </label>

        <div ref={turnstileContainerRef} />

        {errorMsg && (
          <div
            role="alert"
            style={{
              background: "var(--sv-error-soft, #fff0f0)",
              border: "1px solid var(--sv-accent, #0b5cad)",
              color: "var(--sv-primary, #0b5cad)",
              padding: "12px 14px",
              fontFamily: "var(--sv-font, Georgia, serif)",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          style={{
            fontFamily: "var(--sv-font-label, ui-monospace, monospace)",
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: status === "submitting" ? "wait" : "pointer",
            borderRadius: 2,
            padding: "16px 28px",
            fontSize: 13,
            background: "var(--sv-primary, #0b5cad)",
            color: "var(--sv-background, #fff)",
            border: "1px solid var(--sv-primary, #0b5cad)",
            alignSelf: "flex-start",
            opacity: status === "submitting" ? 0.7 : 1,
          }}
        >
          {status === "submitting" ? text("Sende…") : text("Jetzt reservieren")}
        </button>

        {termsEnabled && (
          <p style={{ margin: 0 }}>
            {text("Es gelten unsere ")}
            <a href={termsUrl} style={{ color: "var(--sv-primary, #0b5cad)" }}>
              {text("AGB")}
            </a>
            .
          </p>
        )}

        <p
          style={{
            fontFamily: "var(--sv-font, Georgia, serif)",
            fontSize: 13,
            color: "var(--sv-text-3, #666)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {text(
            "Deine Angaben nutzen wir nur für Deine Reservierung. Mehr dazu in der",
          )}{" "}
          <a href={privacyUrl} style={{ color: "var(--sv-primary, #0b5cad)" }}>
            {text("Datenschutzerklärung")}
          </a>
          {text(". Dieses Formular ist durch")}{" "}
          <strong>{text("Cloudflare Turnstile")}</strong>
          {text(" gegen Spam geschützt (cookie-frei).")}
        </p>
      </form>
    </>
  );
}
