"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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

/** Estimate compact-form voucher funding; debounce public checks and reuse successful codes. */
export function useBookingPayable(
  client: BookingClient,
  seats: Seat[],
  variants: ShopEvent[],
  enabled: boolean,
) {
  const key = JSON.stringify(
    seats.map((seat) => seat.voucher_code?.trim() || ""),
  );
  const cache = useRef<{
    client: BookingClient;
    checks: Record<string, VoucherCheck>;
  }>({ client, checks: {} });
  if (cache.current.client !== client) cache.current = { client, checks: {} };
  const [checked, setChecked] = useState<{
    client: BookingClient;
    key: string;
    checks: Record<string, VoucherCheck>;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const request = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lookup = useCallback(async () => {
    clearTimeout(debounce.current);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    const codes = JSON.parse(key) as string[];
    const entries = await Promise.all(
      // Skip incomplete input before querying the public voucher endpoint.
      [...new Set(codes.filter((code) => code.length >= 5))].map(
        async (code) => {
          try {
            const check =
              cache.current.checks[code] ??
              (await client.checkVoucher(code, controller.signal));
            if (!controller.signal.aborted && !check.pending)
              cache.current.checks[code] = check;
            return [code, check] as const;
          } catch {
            return [code, { voucher_code: code, pending: true }] as const;
          }
        },
      ),
    );
    if (controller.signal.aborted) return null;
    const checks = Object.fromEntries(entries);
    setChecked({ client, key, checks });
    setChecking(false);
    return checks;
  }, [client, key]);
  useEffect(() => {
    if (enabled)
      debounce.current = setTimeout(() => {
        void lookup();
      }, 400);
    return () => {
      clearTimeout(debounce.current);
      request.current?.abort();
      setChecking(false);
    };
  }, [enabled, lookup]);
  const codes = JSON.parse(key) as string[];
  const prices = seats.map(
    (seat) =>
      variants.find(
        (variant) => (variant.variant_id ?? undefined) === seat.variant_id,
      )?.price,
  );
  const amount = (checks: Record<string, VoucherCheck>) => {
    if (
      !prices.length ||
      prices.some(
        (price) =>
          typeof price !== "number" || !Number.isFinite(price) || price < 0,
      )
    )
      return null;
    return bookingVoucherAllocation(prices as number[], codes, {
      ...checks,
      "": { voucher_code: "", kind: "SINGLE_PURPOSE", remaining_value: 0 },
    }).amountToPay;
  };
  const checks =
    checked?.client === client && checked.key === key ? checked.checks : {};
  return {
    payable: amount(checks),
    checking,
    failed: codes.some((code) => Boolean(checks[code]?.pending)),
    retry: async () => {
      const refreshed = await lookup();
      return refreshed ? amount(refreshed) : null;
    },
  };
}
