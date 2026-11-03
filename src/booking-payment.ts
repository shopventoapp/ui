"use client";
import { useEffect, useState } from "react";
import { bookingVoucherAllocation } from "./booking-voucher-allocation";
import type { BookingClient, Seat, ShopEvent, VoucherCheck } from "./client";
import type { BookingDraft } from "./hooks";

/** Identity of the payment-relevant booking selection, excluding contact and consent. */
export function bookingPaymentSelection(
  draft: Pick<BookingDraft, "timewindow_id" | "seats">,
): string {
  return JSON.stringify([
    draft.timewindow_id,
    draft.seats.map((seat) => [
      seat.variant_id ?? null,
      seat.voucher_code?.trim() || null,
    ]),
  ]);
}

/** Estimate compact-form voucher funding from public lookups; final allocation remains server-owned. */
export function useBookingPayable(
  client: BookingClient,
  seats: Seat[],
  variants: ShopEvent[],
  active: boolean,
): number | null {
  const codes = seats.map((seat) => seat.voucher_code?.trim() || "");
  const key = JSON.stringify(codes);
  const [checked, setChecked] = useState<{
    client: BookingClient;
    key: string;
    checks: Record<string, VoucherCheck>;
  } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: The serialized codes are the exact request identity.
  useEffect(() => {
    if (active || !codes.some(Boolean)) return;
    const controller = new AbortController();
    void Promise.all(
      [...new Set(codes.filter(Boolean))].map(async (code) => {
        try {
          return [
            code,
            await client.checkVoucher(code, controller.signal),
          ] as const;
        } catch {
          return [code, { voucher_code: code, pending: true }] as const;
        }
      }),
    ).then((entries) => {
      if (!controller.signal.aborted)
        setChecked({ client, key, checks: Object.fromEntries(entries) });
    });
    return () => controller.abort();
  }, [client, key, active]);
  const prices = seats.map(
    (seat) =>
      variants.find(
        (variant) => (variant.variant_id ?? undefined) === seat.variant_id,
      )?.price,
  );
  if (
    !prices.length ||
    prices.some(
      (price) =>
        typeof price !== "number" || !Number.isFinite(price) || price < 0,
    )
  )
    return null;
  const checks =
    checked?.client === client && checked.key === key ? checked.checks : {};
  return bookingVoucherAllocation(prices as number[], codes, {
    ...checks,
    "": { voucher_code: "", kind: "SINGLE_PURPOSE", remaining_value: 0 },
  }).amountToPay;
}
