"use client";
import { useCallback, useEffect, useState } from "react";
import {
  type PaymentStatus,
  type PaymentStatusInput,
  paymentStatusFrom,
} from "./payment-status";

/** Client capability shared by shop and event transports. */
export interface PaymentStatusClient {
  /** Read the uncached public capability. Missing methods retain legacy active behavior. */
  getPaymentStatus?: (signal?: AbortSignal) => Promise<PaymentStatus>;
}

/** Internal retry control; entering the final action refreshes the uncached capability. */
export function usePaymentStatusControl(
  client: PaymentStatusClient,
  supplied?: PaymentStatusInput,
  finalAction = false,
) {
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  const [loaded, setLoaded] = useState<{
    client: PaymentStatusClient;
    supplied: PaymentStatusInput | undefined;
    revision: number;
    finalAction: boolean;
    status: PaymentStatus;
  } | null>(null);
  const hostStatus =
    supplied === undefined ? undefined : paymentStatusFrom(supplied);
  // Host capabilities stay authoritative; an explicit retry can recover a host error.
  const readClient =
    supplied === undefined ||
    (revision > 0 && (hostStatus === "error" || hostStatus === "unknown"));
  useEffect(() => {
    if (!readClient) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = (status: PaymentStatus) => {
      if (!controller.signal.aborted)
        setLoaded({ client, supplied, revision, finalAction, status });
    };
    const read = async () => {
      try {
        return typeof client.getPaymentStatus === "function"
          ? paymentStatusFrom(await client.getPaymentStatus(controller.signal))
          : ("active" as const);
      } catch {
        return "error" as const;
      }
    };
    void read().then((status) => {
      if (controller.signal.aborted) return;
      save(status);
      if (status === "error" || status === "unknown") {
        // One retry per read cycle, with backoff, prevents a transient outage locking a mount.
        timer = setTimeout(() => {
          void read().then(save);
        }, 400);
      }
    });
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [client, supplied, finalAction, revision, readClient]);
  const status = !readClient
    ? (hostStatus ?? "unknown")
    : loaded?.client === client &&
        loaded.supplied === supplied &&
        loaded.revision === revision &&
        loaded.finalAction === finalAction
      ? loaded.status
      : "loading";
  return { status, retry };
}

/** Resolve a host capability immediately, or load it through the same client as the action. */
export function usePaymentStatus(
  client: PaymentStatusClient,
  supplied?: PaymentStatusInput,
): PaymentStatus {
  return usePaymentStatusControl(client, supplied).status;
}
