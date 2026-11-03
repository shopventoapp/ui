/** Public tenant capability returned by /api/shop/payments/status. */
export interface PaymentCapability {
  /** Whether this tenant can create online payments. */
  online_payments_enabled: boolean;
  /** Backend checkout guidance; disabled UI actions use the package label. */
  checkout_label: string;
}

/** Only active permits a new paid action. A 404 status endpoint is legacy active. */
export type PaymentStatus =
  | "active"
  | "inactive"
  | "unknown"
  | "loading"
  | "error";
/** Hosts can forward their capability response or an explicit loading/error state. */
export type PaymentStatusInput = PaymentCapability | PaymentStatus;

/** Validate untrusted host or API capability data without assuming payments work. */
export function paymentStatusFrom(value: unknown): PaymentStatus {
  if (
    ["active", "inactive", "unknown", "loading", "error"].includes(
      value as string,
    )
  )
    return value as PaymentStatus;
  if (
    value &&
    typeof value === "object" &&
    "online_payments_enabled" in value &&
    typeof value.online_payments_enabled === "boolean" &&
    "checkout_label" in value &&
    typeof value.checkout_label === "string"
  )
    return value.online_payments_enabled ? "active" : "inactive";
  return "unknown";
}

/** Fetch uncached public payment capability through the configured client transport. */
export async function loadPaymentStatus(
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<PaymentStatus> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(
          `${baseUrl.replace(/\/+$/, "")}/api/shop/payments/status`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          },
        );
        if (response.status === 404) return "active" as const;
        if (!response.ok) return "error" as const;
        // API responses must be capabilities, never bare status strings.
        const data: unknown = await response.json();
        return typeof data === "object" ? paymentStatusFrom(data) : "unknown";
      })(),
      new Promise<PaymentStatus>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve("error");
        }, 10000);
      }),
    ]);
  } catch {
    return "error";
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

/** Zero payable is allowed independently of card capability; missing/invalid amounts fail closed. */
export function paymentActionBlocked(
  status: PaymentStatus,
  remainingPayable: unknown,
): boolean {
  return status !== "active" && remainingPayable !== 0;
}
