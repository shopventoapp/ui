"use client";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "./locale";

interface TurnstileApi {
  /** Render in the turnstile api contract. */
  render(
    element: HTMLElement,
    options: {
      /** Sitekey in the turnstile api contract. */
      sitekey: string;
      /** Callback in the turnstile api contract. */
      callback: (token: string) => void;
      /** Expired-callback in the turnstile api contract. */
      "expired-callback": () => void;
      /** Error-callback in the turnstile api contract. */
      "error-callback": () => void;
      /** Timeout-callback in the turnstile api contract. */
      "timeout-callback": () => void;
      /** Size in the turnstile api contract. */
      size: string;
    },
  ): string;
  /** Remove in the turnstile api contract. */
  remove(id: string): void;
}
function api() {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}
let loading: Promise<void> | undefined;
function load() {
  if (api()) return Promise.resolve();
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        loading = undefined;
        reject(new Error("Turnstile failed"));
      };
      document.head.append(script);
    });
  return loading;
}
/** Load the explicit-render Turnstile widget and emit a short-lived token; clear expired tokens and remove the widget on unmount. */
export function Turnstile({
  siteKey,
  onToken,
}: {
  /** Public Turnstile site key; never pass the private secret. */
  siteKey: string;
  /** Receive the current short-lived challenge token, or an empty string after expiry or error. */
  onToken: (token: string) => void;
}) {
  const text = useMessages("forms");
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let id: string | undefined;
    onToken("");
    load()
      .then(() => {
        if (!active || !container.current) return;
        const provider = api();
        if (!provider) throw new Error("Turnstile missing");
        id = provider.render(container.current, {
          sitekey: siteKey,
          size: "flexible",
          callback: (token) => {
            if (active) onToken(token);
          },
          "expired-callback": () => onToken(""),
          "timeout-callback": () => {
            onToken("");
            setFailed(true);
          },
          "error-callback": () => {
            onToken("");
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (id) api()?.remove(id);
    };
  }, [siteKey, onToken]);
  return (
    <div>
      <div ref={container} />
      {failed && (
        <p role="alert">
          {text(
            "Die Sicherheitsprüfung ist nicht verfügbar. Bitte lade die Seite erneut.",
          )}
        </p>
      )}
    </div>
  );
}
