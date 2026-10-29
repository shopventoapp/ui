"use client";
import { useEffect, useRef, useState } from "react";

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      "timeout-callback": () => void;
      size: string;
    },
  ): string;
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
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
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
          Die Sicherheitsprüfung ist nicht verfügbar. Bitte lade die Seite
          erneut.
        </p>
      )}
    </div>
  );
}
