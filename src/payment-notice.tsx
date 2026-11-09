"use client";
import { useMessages } from "./locale";
import type { PaymentStatus } from "./payment-status";
import { ShopButton, ShopNotice } from "./shop-components";

/** Explain the payment gate next to its disabled action, with recovery for failed reads. */
export function PaymentNotice({
  id,
  status,
  blocked,
  retry,
  variant = "compact",
  className,
}: {
  id: string;
  status: PaymentStatus;
  blocked: boolean;
  retry: () => void;
  variant?: "compact" | "booking" | "shop";
  className?: string;
}) {
  const text = useMessages("payment");
  if (!blocked || status === "active") return null;
  const failed = status === "error" || status === "unknown";
  const Notice = variant === "shop" ? ShopNotice : "div";
  const Button = variant === "shop" ? ShopButton : "button";
  return (
    <Notice
      id={id}
      role="status"
      className={`${variant === "booking" ? "hint" : variant === "compact" ? "sv-summary" : ""} sv-payment-notice ${className ?? ""}`}
    >
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
        <Button
          type="button"
          onClick={retry}
          className={
            variant === "shop"
              ? "is-secondary"
              : variant === "booking"
                ? "btn btn-outline"
                : "sv-payment-retry"
          }
        >
          {text("Erneut versuchen")}
        </Button>
      )}
    </Notice>
  );
}
