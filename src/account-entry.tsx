"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type AccountClient, safeAccountReturnPath } from "./account-client";
import { LoginForm, RegisterForm } from "./account-components";
import { googleMark } from "./google-brand";
import { useMessages } from "./locale";

/** Fail closed until the server confirms that both Google client credentials are configured. */
export function GoogleSignIn({
  returnPath = "/konto",
}: {
  /** Safe same-origin path to visit after account authentication.
   * @defaultValue "/konto" */
  returnPath?: string;
}) {
  const text = useMessages("account");

  const iconId = useId();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/shop/user/google-auth/status", {
      signal: controller.signal,
      credentials: "same-origin",
      redirect: "error",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.ok) setEnabled((await response.json()).enabled === true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (!enabled) return null;
  return (
    <button
      type="button"
      className="sv-google-sign-in"
      onClick={() => {
        const path = safeAccountReturnPath(returnPath) || "/konto";
        const query = new URLSearchParams({
          success_redirect_url: new URL(path, window.location.origin).href,
          failure_redirect_url: new URL(
            `/konto/anmelden?${new URLSearchParams({ weiter: path, google: text("fehlgeschlagen") })}`,
            window.location.origin,
          ).href,
        });
        window.location.assign(`/api/shop/user/google-auth?${query}`);
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="10 10 20 20"
        fill="none"
        aria-hidden="true"
        focusable="false"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static Google brand SVG bundled in google-brand.ts, no user input
        dangerouslySetInnerHTML={{
          __html: googleMark.replaceAll("1298_12516", iconId),
        }}
      />
      <span>{text("Mit Google anmelden")}</span>
    </button>
  );
}

/** Authentication lives in a portal so this entry can also be used inside booking forms. */
export function AccountAccess({
  client,
  returnPath,
  onAuthenticated,
  onGuest,
  termsUrl = "/agb",
  privacyUrl = "/datenschutz",
}: {
  /** Stable client instance used for API requests. */
  client: AccountClient;
  /** Safe same-origin path to visit after account authentication. */
  returnPath: string;
  /** Refresh the host session after successful authentication. */
  onAuthenticated: () => void;
  /** Continue in the host guest flow when supplied. Optional; omitted unless supplied by the host or backend. */
  onGuest?: () => void;
  /** Host terms and conditions URL.
   * @defaultValue "/agb" */
  termsUrl?: string;
  /** Host privacy policy URL.
   * @defaultValue "/datenschutz" */
  privacyUrl?: string;
}) {
  const text = useMessages("account");

  const [mode, setMode] = useState<"login" | "register" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!mode) return;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      trigger.current?.focus();
    };
  }, [mode]);
  const loginUrl = `/konto/anmelden?${new URLSearchParams({ weiter: returnPath })}`;
  return (
    <div className="sv-account-entry">
      <div className="sv-account sv-account-entry-frame">
        <p>
          {text(
            "Mit Deinem Konto hast Du Deine Buchungen und Bestellungen im Blick. Deine Auswahl bleibt gespeichert.",
          )}
        </p>
        <div className="sv-account-entry-actions">
          <button
            type="button"
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setMode("login");
            }}
          >
            {text("Anmelden")}
          </button>
          <button
            type="button"
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setMode("register");
            }}
          >
            {text("Neues Konto anlegen")}
          </button>
        </div>
        <GoogleSignIn returnPath={returnPath} />
      </div>
      {onGuest && (
        <button type="button" className="sv-account-guest" onClick={onGuest}>
          {text("Als Gast fortfahren")}
        </button>
      )}
      {mode &&
        createPortal(
          <dialog
            className="sv-account-entry-dialog"
            ref={dialog}
            aria-labelledby="account-entry-title"
            onCancel={() => setMode(null)}
            onSubmit={(event) => event.stopPropagation()}
          >
            <div className="sv-account">
              <button
                type="button"
                className="sv-account-close"
                onClick={() => setMode(null)}
              >
                {text("Schließen")}
              </button>
              <h2 id="account-entry-title">
                {mode === "login"
                  ? text("Anmelden")
                  : text("Neues Konto anlegen")}
              </h2>
              {mode === "login" ? (
                <LoginForm
                  client={client}
                  registerUrl="#"
                  onSuccess={() => {
                    setMode(null);
                    onAuthenticated();
                  }}
                  onRegister={() => setMode("register")}
                />
              ) : (
                <RegisterForm
                  client={client}
                  termsUrl={termsUrl}
                  privacyUrl={privacyUrl}
                  loginUrl={loginUrl}
                />
              )}
            </div>
          </dialog>,
          document.body,
        )}
    </div>
  );
}
