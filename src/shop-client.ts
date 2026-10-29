import { type ShopOperations, shopPaths } from "./shop-wire";

export type { ShopOperations } from "./shop-wire";
/** Public shop fetch contract used by the storefront clients. */
export type ShopFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
/** An unsuccessful shop API response, retaining its status and parsed detail. */
export class ShopApiError extends Error {
  constructor(
    /** HTTP response status code. */
    public status: number,

    /** Parsed backend error detail, retained for customer-safe error handling. */
    public detail: unknown,
  ) {
    super(`Shop request failed (${status})`);
    this.name = "ShopApiError";
  }
}
/** Create the catalogue, quote and checkout transport. Use the same-origin host proxy so session cookies remain first party. */
export function createShopClient({
  baseUrl = "",
  fetcher = fetch,
}: {
  /** Installation origin without /api/shop. Use an empty string for same-origin shop calls.
   * @defaultValue "" */
  baseUrl?: string;
  /** Optional host fetch implementation.
   * @defaultValue fetch */
  fetcher?: ShopFetch;
} = {}) {
  async function request<K extends keyof ShopOperations>(
    operation: K,
    body?: ShopOperations[K]["body"],
    options: {
      signal?: AbortSignal;
      slug?: string;
      orderId?: string;
      query?: string;
    } = {},
  ): Promise<ShopOperations[K]["response"]> {
    let path: string = shopPaths[operation];
    if (options.slug)
      path = path.replace("{article_slug}", encodeURIComponent(options.slug));
    if (options.orderId)
      path = path.replace("{order_id}", encodeURIComponent(options.orderId));
    const response = await fetcher(
      `${baseUrl.replace(/\/$/, "")}${path}${options.query ?? ""}`,
      {
        method: body === undefined ? "GET" : "POST",
        credentials: "include",
        headers:
          body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: options.signal,
      },
    );
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ShopApiError(response.status, data);
    return data as ShopOperations[K]["response"];
  }
  return {
    /** Call one public shop operation with its typed body, optional slug/order identifier, query and abort signal. */
    request,
  };
}
