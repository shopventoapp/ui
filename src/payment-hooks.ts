"use client";
import { useEffect, useState } from "react";
import {
  type PaymentStatus,
  type PaymentStatusInput,
  paymentStatusFrom,
} from "./payment-status";

/** Client capability shared by shop and event transports. */
export interface PaymentStatusClient {
  /** Read the uncached public capability. */
  getPaymentStatus: (signal?: AbortSignal) => Promise<PaymentStatus>;
}

/** Resolve a host capability immediately, or load it through the same client as the action. */
export function usePaymentStatus(
  client: PaymentStatusClient,
  supplied?: PaymentStatusInput,
): PaymentStatus {
  const [loaded, setLoaded] = useState<{
    client: PaymentStatusClient;
    status: PaymentStatus;
  } | null>(null);
  useEffect(() => {
    setLoaded(null);
    if (supplied !== undefined) return;
    const controller = new AbortController();
    client.getPaymentStatus(controller.signal).then(
      (status) => {
        if (!controller.signal.aborted)
          setLoaded({ client, status: paymentStatusFrom(status) });
      },
      () => {
        if (!controller.signal.aborted) setLoaded({ client, status: "error" });
      },
    );
    return () => controller.abort();
  }, [client, supplied]);
  return supplied !== undefined
    ? paymentStatusFrom(supplied)
    : loaded?.client === client
      ? loaded.status
      : "loading";
}
