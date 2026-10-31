/** Same-origin transport only; commerce and session state remain upstream. */
/** Same-origin proxy configuration. Only enable visitor IP trust behind a trusted edge. */
export interface ProxyOptions {
  /** HTTPS instance origin, or loopback HTTP for local development. */
  apiUrl?: string;
  /** Forward CF-Connecting-IP only behind a trusted Cloudflare edge. */
  trustVisitorIp?: boolean;
  /** Optional injected upstream transport. */
  fetcher?: typeof fetch;
}

const publicReservationPaths = new Set([
  "/api/table-reservations/public",
  "/api/table-reservations/public/settings",
  "/api/table-reservations/public/cancel",
]);
const brandingFontPath = /^\/branding\/fonts\/[a-f0-9]{64}\.woff2?$/;
const noStore = {
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
};

/** Test the exact public route and branding asset allowlist. */
export function isShopProxyPath(path: string): boolean {
  return (
    path.startsWith("/api/shop/") ||
    path === "/branding/theme.css" ||
    brandingFontPath.test(path) ||
    publicReservationPaths.has(path.replace(/\/$/, ""))
  );
}

/** Validate an origin without credentials, path, query or fragment. */
export function instanceOrigin(value?: string): URL | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

function failure(message: string, status: number): Response {
  return Response.json({ detail: message }, { status, headers: noStore });
}

/** Bounded reads are used only for small configuration and credential payloads. */
export async function readSmallJson(
  response: Response,
  maximum = 262144,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new Error("Response exceeds configuration limit");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function stripCredentials(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    const record = value as Record<string, unknown>;
    if (["access_token", "refresh_token", "id_token"].includes(key))
      delete record[key];
    else stripCredentials(record[key]);
  }
}

/** Forward a public operation with first-party sessions and strict origin validation. */
export async function proxyShopRequest(
  request: Request,
  options: ProxyOptions,
): Promise<Response> {
  const source = new URL(request.url);
  if (!isShopProxyPath(source.pathname))
    return failure("Unsupported public operation", 404);
  if (
    source.pathname.includes("//") ||
    /%(?:2f|5c|2e|25|0[0-9a-f]|1[0-9a-f]|7f)|\\/i.test(source.pathname)
  )
    return failure("Invalid API path", 400);
  const upstreamOrigin = instanceOrigin(options.apiUrl);
  if (!upstreamOrigin)
    return failure(
      "Configure SHOPVENTO_API_URL to connect this storefront",
      503,
    );
  if (
    !["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  )
    return failure("Method not allowed", 405);
  const mutation = !["GET", "HEAD"].includes(request.method);
  if (
    mutation &&
    (request.headers.get("Origin") !== source.origin ||
      ["cross-site", "same-site"].includes(
        request.headers.get("Sec-Fetch-Site") ?? "",
      ))
  )
    return failure("Invalid origin", 403);
  if (
    (source.pathname === "/branding/theme.css" ||
      brandingFontPath.test(source.pathname)) &&
    mutation
  )
    return failure("Method not allowed", 405);
  const target = new URL(source.pathname + source.search, upstreamOrigin);
  const headers = new Headers();
  for (const name of ["Content-Type", "Accept", "User-Agent"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  // Send only the backend session cookie; unrelated host cookies stay private.
  const sessionCookie = request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("shop_access_token="));
  if (sessionCookie) headers.set("Cookie", sessionCookie);
  if (options.trustVisitorIp) {
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) headers.set("X-Visitor-Ip", ip);
  }
  headers.set("X-Forwarded-Host", source.host);
  headers.set("X-Forwarded-Proto", source.protocol.slice(0, -1));
  try {
    const result = await (options.fetcher ?? fetch)(target, {
      method: request.method,
      headers,
      body: mutation ? request.body : undefined,
      redirect: "manual",
      cache: "no-store",
      ...(mutation && request.body ? { duplex: "half" } : {}),
    } as RequestInit);
    const responseHeaders = new Headers(result.headers);
    for (const name of [
      "Authorization",
      "Proxy-Authenticate",
      "WWW-Authenticate",
      "X-Powered-By",
      "Server",
      "Set-Cookie",
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Credentials",
    ])
      responseHeaders.delete(name);
    for (const cookie of result.headers.getSetCookie()) {
      const parts = cookie.split(";").map((part) => part.trim());
      if (/^shop_access_token=/i.test(parts[0])) {
        const attributes = parts
          .slice(1)
          .filter(
            (part) =>
              !/^(?:Domain|Path|SameSite|Secure|HttpOnly)(?:=|$)/i.test(part),
          );
        responseHeaders.append(
          "Set-Cookie",
          [
            parts[0],
            ...attributes,
            "Path=/",
            "HttpOnly",
            "SameSite=Strict",
            ...(source.protocol === "https:" ? ["Secure"] : []),
          ].join("; "),
        );
      } else
        responseHeaders.append(
          "Set-Cookie",
          cookie.replace(/;\s*Domain\s*=\s*[^;]*/gi, ""),
        );
    }
    for (const [name, value] of Object.entries(noStore))
      responseHeaders.set(name, value);
    const location = responseHeaders.get("Location");
    if (location) {
      const destination = new URL(location, upstreamOrigin);
      if (destination.origin === upstreamOrigin.origin) {
        destination.protocol = source.protocol;
        destination.host = source.host;
        responseHeaders.set("Location", destination.toString());
      }
    }
    let body: BodyInit | null = result.body;
    if (
      request.method !== "HEAD" &&
      result.body &&
      /\/(?:login|callback|password-reset\/confirm)\/?$/.test(
        source.pathname,
      ) &&
      /application\/json/i.test(responseHeaders.get("Content-Type") ?? "")
    ) {
      const json = await readSmallJson(result);
      stripCredentials(json);
      body = JSON.stringify(json);
      for (const name of ["Content-Length", "Content-Encoding", "ETag"])
        responseHeaders.delete(name);
    }
    return new Response(request.method === "HEAD" ? null : body, {
      status: result.status,
      statusText: result.statusText,
      headers: responseHeaders,
    });
  } catch {
    // Never log callback URLs, tokens, contact details or upstream error bodies.
    return failure("Shop service temporarily unavailable", 502);
  }
}

/** Cloudflare Workers adapter. Bind only trusted edge requests to this handler. */
export function createWorkerShopProxy(options: ProxyOptions) {
  return {
    /** Handle an incoming Worker request. */ fetch: (request: Request) =>
      proxyShopRequest(request, options),
  };
}
