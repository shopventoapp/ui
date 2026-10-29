"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  defaultPublicFormApi,
  type PublicFormOptions,
  PublicFormScript,
} from "./public-form-options";

type Status = "idle" | "submitting" | "success" | "error";
/** Default optional newsletter consent label. */
export const newsletterOptInLabel = "Newsletter per E-Mail abonnieren";

/** Props for standalone and account newsletter signup with explicit consent and double opt-in. */
export type NewsletterSignupProps = PublicFormOptions & {
  /** Public Turnstile key for guest signup. */
  siteKey: string;
  /** Consent provenance passed to the public API. */
  source?: "website-footer" | "reservation" | "website";
  /** Prefilled email address, still editable by the customer. */
  initialEmail?: string;
  /** Optional editable first-name prefill. */
  initialFirstName?: string;
  /** Full marketing section or compact card layout. */
  variant?: "section" | "card";
  /** Authenticated signup adapter; omitting it uses the guest transport. */
  onSubscribe?: () => Promise<void>;
  /** An outstanding confirmation email already exists. */
  pending?: boolean;
  /** One-shot signup after previously recorded explicit consent. */
  automatic?: {
    /** Consume consent atomically and return whether signup may proceed. */
    onAttempt: () => boolean;
    /** Consume the intent without sending another request. */
    alreadySubscribed?: boolean;
  };
};
/** Accessible newsletter signup with lazy Turnstile, account adapters and one-shot checkout consent. */
export function NewsletterSignup({
  siteKey,
  initialEmail = "",
  initialFirstName = "",
  variant = "section",
  onSubscribe,
  automatic,
  source = "website-footer",
  pending = false,
  publicApi = defaultPublicFormApi,
  ScriptComponent = PublicFormScript,
  labels = {},
  privacyUrl = "/datenschutz",
}: NewsletterSignupProps) {
  const text = (value: string, ...args: unknown[]) =>
    (labels[value] ?? value).replace(/\{(\d+)\}/g, (match, index: string) =>
      Number(index) < args.length ? String(args[Number(index)]) : match,
    );
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scriptEnabled, setScriptEnabled] = useState(false);
  const widgetIdRef = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const sectionRootRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const automaticAttempted = useRef(false);
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (onSubscribe) return;
    if (scriptEnabled) return;
    if (automatic) {
      setScriptEnabled(true);
      return;
    }
    if (!sectionRootRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setScriptEnabled(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(sectionRootRef.current);
    return () => obs.disconnect();
  }, [scriptEnabled, onSubscribe, automatic]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Preserve transaction lifecycle; host adapters must keep stable identities.
  useEffect(() => {
    if (!scriptEnabled) return;
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
          sitekey: siteKey,
          theme: "light",
          callback: () => setTokenReady(true),
          "expired-callback": () => setTokenReady(false),
          "error-callback": () => {
            if (automatic && !automaticAttempted.current) {
              automaticAttempted.current = true;
              automatic.onAttempt();
              setStatus("error");
              setErrorMsg(
                text(
                  "Anmeldung gerade nicht möglich. Bitte später erneut versuchen.",
                ),
              );
            }
          },
        },
      );
    };
    tryRender();
    return () => {
      cancelled = true;
    };
  }, [scriptEnabled, siteKey]);

  useEffect(() => {
    if (
      !automatic ||
      automaticAttempted.current ||
      (!onSubscribe && !tokenReady)
    )
      return;
    if (pending) {
      automaticAttempted.current = true;
      automatic.onAttempt();
      return;
    }
    if (!formRef.current) return;
    automaticAttempted.current = true;
    if (!automatic.onAttempt()) return;
    if (automatic.alreadySubscribed) {
      setStatus("success");
      return;
    }
    void subscribe(formRef.current);
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await subscribe(e.currentTarget);
  }

  async function subscribe(form: HTMLFormElement) {
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg(null);

    if (onSubscribe) {
      try {
        await onSubscribe();
        setStatus("success");
      } catch (error) {
        setStatus("error");
        setErrorMsg(
          error instanceof Error && "status" in error && error.status === 429
            ? text(
                "Bitte warte fünf Minuten nach der letzten E-Mail, bevor Du einen neuen Bestätigungslink anforderst.",
              )
            : text(
                "Anmeldung gerade nicht möglich. Bitte später erneut versuchen.",
              ),
        );
      }
      return;
    }

    const formData = new FormData(form);
    const turnstileToken =
      window.turnstile?.getResponse(widgetIdRef.current ?? undefined) ?? "";
    if (!turnstileToken) {
      setStatus("error");
      setErrorMsg(
        text("Bitte warte kurz, bis die Sicherheitsprüfung geladen ist."),
      );
      return;
    }

    const payload = {
      firstName: String(formData.get("firstName") ?? ""),
      email: String(formData.get("email") ?? ""),
      turnstileToken,
    };

    try {
      const config = await publicApi();
      const res = await fetch(
        config.shopvento
          ? "/api/shop/user/newsletter/subscribe"
          : "/api/newsletter",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            config.shopvento
              ? {
                  email: payload.email,
                  source,
                  turnstile_token: turnstileToken,
                }
              : payload,
          ),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && (config.shopvento || data.ok)) {
        setStatus("success");
        return;
      }
      setStatus("error");
      setErrorMsg(
        data.error ??
          text(
            "Anmeldung gerade nicht möglich. Bitte später erneut versuchen.",
          ),
      );
      window.turnstile?.reset(widgetIdRef.current ?? undefined);
    } catch {
      setStatus("error");
      setErrorMsg(
        text("Verbindung fehlgeschlagen. Bitte später erneut versuchen."),
      );
      window.turnstile?.reset(widgetIdRef.current ?? undefined);
    }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--sv-font, Georgia, serif)",
    fontSize: 16,
    padding: "14px 16px",
    border: "1px solid var(--sv-border-2, #ccc)",
    background: "var(--sv-background, #fff)",
    color: "var(--sv-text, #1f1f1f)",
    width: "100%",
    borderRadius: 2,
  };

  return (
    <section
      id="newsletter"
      ref={sectionRootRef}
      style={{
        background: "var(--sv-surface-2, #f5f5f5)",
        padding: variant === "card" ? "24px" : "clamp(48px, 10vw, 100px) 24px",
      }}
      className={`sv-newsletter ${variant === "card" ? "vv-shop-newsletter-card" : "sv-newsletter-section"}`}
    >
      {scriptEnabled && (
        <ScriptComponent
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
        />
      )}
      <div style={{ maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
        {variant !== "card" && (
          <p
            style={{
              fontFamily: "var(--sv-font-label, ui-monospace, monospace)",
              fontSize: 12,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "var(--sv-accent, #0b5cad)",
              margin: 0,
              marginBottom: 18,
            }}
          >
            {text("◆ Erste Reihe")}
          </p>
        )}
        <h2
          style={{
            fontFamily: "var(--sv-font-display, Georgia, serif)",
            lineHeight: variant === "card" ? 1.15 : 1.0,
            letterSpacing: "-0.02em",
            margin: 0,
            marginBottom: 20,
          }}
          className={
            variant === "card"
              ? "vv-shop-newsletter-title"
              : "sv-newsletter-title"
          }
        >
          {variant === "card" ? (
            text("Neuigkeiten zuerst erfahren")
          ) : (
            <>
              {text("Veranstaltungen und")}{" "}
              <span
                style={{
                  fontStyle: "italic",
                  color: "var(--sv-accent, #0b5cad)",
                }}
              >
                {text("Empfehlungen.")}
              </span>
            </>
          )}
        </h2>
        <p
          style={{
            fontFamily: "var(--sv-font, Georgia, serif)",
            fontStyle: "italic",
            fontSize: 19,
            color: "var(--sv-text-2, #444)",
            margin: 0,
            marginBottom: 36,
            maxWidth: 600,
            marginInline: "auto",
            lineHeight: 1.5,
          }}
        >
          {text("Selten, aber gut. Kein Spam, nur, wenn wirklich was anliegt.")}
        </p>

        {status === "success" || pending ? (
          <div
            role="status"
            style={{
              background: "var(--sv-background, #fff)",
              border: "1px solid var(--sv-accent, #0b5cad)",
              padding: 28,
              maxWidth: 540,
              margin: "0 auto",
            }}
          >
            <p
              style={{
                fontFamily: "var(--sv-font-label, ui-monospace, monospace)",
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--sv-accent, #0b5cad)",
                margin: 0,
                marginBottom: 12,
              }}
            >
              {onSubscribe ? text("Fast geschafft") : text("✓ Fast geschafft")}
            </p>
            <p
              style={{
                fontFamily: "var(--sv-font, Georgia, serif)",
                fontSize: 16,
                lineHeight: 1.6,
                color: "var(--sv-text, #1f1f1f)",
                margin: 0,
              }}
            >
              {onSubscribe ? (
                text(
                  "Fast geschafft: Bitte bestätige Deine Anmeldung über den Link in unserer E-Mail.",
                )
              ) : (
                <>
                  {text(
                    "Wenn eine Bestätigung erforderlich ist, erhältst Du eine E-Mail. Bitte bestätige Deine Anmeldung über den Link darin und prüfe auch Deinen Spam-Ordner.",
                  )}
                </>
              )}
            </p>
          </div>
        ) : (
          <form
            ref={formRef}
            onSubmit={onSubmit}
            style={{
              maxWidth: 600,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {!onSubscribe && (
              <div className="sv-newsletter-fields">
                <input
                  name="firstName"
                  type="text"
                  placeholder={text("Vorname (optional)")}
                  maxLength={80}
                  autoComplete="given-name"
                  defaultValue={initialFirstName}
                  style={inputStyle}
                  aria-label={text("Vorname")}
                />
                <input
                  name="email"
                  type="email"
                  placeholder="E-Mail-Adresse"
                  required
                  maxLength={200}
                  autoComplete="email"
                  defaultValue={initialEmail}
                  style={inputStyle}
                  aria-label="E-Mail"
                />
              </div>
            )}

            {!onSubscribe && (
              <div
                ref={turnstileContainerRef}
                style={{ display: "flex", justifyContent: "center" }}
              />
            )}

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
                alignSelf: "center",
                opacity: status === "submitting" ? 0.7 : 1,
              }}
            >
              {status === "submitting"
                ? text("Sende…")
                : text("Newsletter abonnieren")}
            </button>

            <p
              style={{
                fontFamily: "var(--sv-font, Georgia, serif)",
                fontSize: 12,
                color: "var(--sv-text-3, #666)",
                margin: 0,
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              {onSubscribe ? (
                <>
                  {text(
                    "Mit Klick auf „Newsletter abonnieren“ forderst Du eine Bestätigungs-E-Mail an ",
                  )}
                  {initialEmail}
                  {text(
                    " an. Erst nach Deiner Bestätigung erhältst Du den Newsletter. Abmeldung jederzeit im Konto oder über den Link in jeder Mail.",
                  )}{" "}
                </>
              ) : (
                <>
                  {text(
                    'Mit Klick auf „Abonnieren" willigst du in den Versand ein. Bestätigung per E-Mail (Double-Opt-in). Abmeldung jederzeit über den Link in jeder Mail. Spam-Schutz durch',
                  )}{" "}
                  <strong>{text("Cloudflare Turnstile")}</strong>
                  {text(" (cookie-frei). Mehr in der")}{" "}
                </>
              )}
              <a
                href={privacyUrl}
                style={{
                  color: "var(--sv-primary, #0b5cad)",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                {text("Datenschutzerklärung")}
              </a>
              .
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
