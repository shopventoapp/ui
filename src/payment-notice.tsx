"use client";
import { useMessages } from "./locale";
import type { PaymentStatus } from "./payment-status";

/** Explain the payment gate next to its disabled action, with recovery for failed reads. */
export function PaymentNotice({
  id,
  status,
  blocked,
  retry,
}: {
  id: string;
  status: PaymentStatus;
  blocked: boolean;
  retry: () => void;
}) {
  const text = useMessages("payment");
  if (!blocked || status === "active") return null;
  const failed = status === "error" || status === "unknown";
  return (
    <div id={id} role="status">
      <p>
        {failed
          ? text(
              "Der Zahlungsstatus konnte nicht geladen werden. Bitte versuche es erneut.",
            )
          : status === "loading"
            ? text("Zahlungsstatus wird geladen…")
            : text(
                "Online-Zahlung ist derzeit nicht verfügbar. Gutscheine kannst Du weiterhin einlösen.",
              )}
      </p>
      {failed && (
        <button type="button" onClick={retry}>
          {text("Erneut versuchen")}
        </button>
      )}
    </div>
  );
}
