import { type ShopOperations, shopPaths } from "./shop-wire";

export type { ShopOperations } from "./shop-wire";
export type ShopFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
export class ShopApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(`Shop request failed (${status})`);
    this.name = "ShopApiError";
  }
}
export function createShopClient({
  baseUrl = "",
  fetcher = fetch,
}: {
  baseUrl?: string;
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
  return { request };
}
