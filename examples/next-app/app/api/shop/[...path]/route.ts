/** Host-owned session proxy example. Run in Next.js's Node runtime behind HTTPS. */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const runtime = "nodejs";
const cookieName = "__Host-shopvento-session";
const lifetime = 3600;
const allowed: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [
    /^user\/(login|register|password-reset|password-reset\/confirm|verify-email|confirm-email-change|logout|password-update|update-email|newsletter\/unsubscribe)$/,
    ["POST"],
  ],
  [/^user\/profile$/, ["GET", "PUT"]],
  [/^user\/shipping-addresses$/, ["GET", "POST"]],
  [/^user\/shipping-addresses\/[^/]+$/, ["PUT", "DELETE"]],
  [/^settings$/, ["GET"]],
  [/^tastings\/$/, ["GET"]],
  [/^tastings\/(timewindows|locations)$/, ["GET"]],
  [/^tastings\/bookings$/, ["GET", "POST"]],
  [/^tastings\/bookings\/guest$/, ["POST"]],
  [/^tastings\/bookings\/[^/]+$/, ["GET"]],
  [/^tastings\/bookings\/[^/]+\/move$/, ["POST"]],
  [/^table-reservations$/, ["GET"]],
  [/^table-reservations\/[^/]+$/, ["GET", "PATCH"]],
  [/^table-reservations\/[^/]+\/cancel$/, ["POST"]],
  [/^vouchers\/customer$/, ["GET"]],
  [/^vouchers\/customer\/[^/]+(\/history)?$/, ["GET"]],
  [/^vouchers\/[^/]+$/, ["GET"]],
  [/^orders\/$/, ["GET"]],
  [/^orders\/[^/]+$/, ["GET"]],
  [/^orders\/[^/]+\/withdrawal-items$/, ["GET"]],
  [/^orders\/[^/]+\/cancellation-request$/, ["POST"]],
  [/^articles\/$/, ["GET"]],
  [/^articles\/catalogue$/, ["GET"]],
  [/^articles\/[^/]+$/, ["GET"]],
  [/^cart\/$/, ["POST"]],
  [/^checkout\/(create-checkout-session|confirm-checkout)$/, ["POST"]],
];
function config() {
  const upstream = new URL(process.env.SHOPVENTO_ORIGIN ?? "");
  const storefront = new URL(process.env.STOREFRONT_ORIGIN ?? "");
  const key = Buffer.from(process.env.SHOPVENTO_SESSION_KEY ?? "", "base64");
  if (
    [upstream, storefront].some(
      (url) =>
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash,
    ) ||
    key.length !== 32
  ) {
    throw new Error(
      "Configure HTTPS host origins and a private 32-byte session key",
    );
  }
  return { upstream, storefront, key };
}
function seal(token: string, key: Buffer, expires: number) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(cookieName));
  const payload = Buffer.from(JSON.stringify({ token, expires }));
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
function session(request: Request, key: Buffer): string | undefined {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!value) return;
  try {
    const packed = Buffer.from(value, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      packed.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(cookieName));
    decipher.setAuthTag(packed.subarray(12, 28));
    const json = JSON.parse(
      Buffer.concat([
        decipher.update(packed.subarray(28)),
        decipher.final(),
      ]).toString(),
    ) as { token?: unknown; expires?: unknown };
    if (
      typeof json.token === "string" &&
      typeof json.expires === "number" &&
      json.expires > Date.now()
    )
      return json.token;
  } catch {
    /* Invalid, expired or rotated sessions are anonymous. */
  }
}
function cookie(value: string, seconds: number) {
  return `${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
}

async function proxy(request: Request) {
  const { upstream, storefront, key } = config();
  const url = new URL(request.url);
  const prefix = "/api/shop/";
  const path = url.pathname.slice(prefix.length);
  // Reject encoded separators and traversal rather than normalizing into another route.
  if (
    !url.pathname.startsWith(prefix) ||
    /%2f|%5c|%2e|\\/i.test(path) ||
    !allowed.some(
      ([pattern, methods]) =>
        pattern.test(path) && methods.includes(request.method),
    )
  ) {
    return Response.json(
      { detail: "Unsupported public operation" },
      { status: 404 },
    );
  }
  const mutation = !["GET", "HEAD"].includes(request.method);
  if (mutation && request.headers.get("origin") !== storefront.origin)
    return Response.json({ detail: "Invalid origin" }, { status: 403 });
  if (
    mutation &&
    request.body &&
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return Response.json({ detail: "JSON required" }, { status: 415 });
  const headers = new Headers({ Accept: "application/json" });
  const token = session(request, key);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (mutation) headers.set("Content-Type", "application/json");
  const target = new URL(`${prefix}${path}${url.search}`, upstream);
  const result = await fetch(target, {
    method: request.method,
    headers,
    body: mutation && request.body ? await request.text() : undefined,
    redirect: "manual",
    cache: "no-store",
  });
  const responseHeaders = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  if (result.status >= 300 && result.status < 400)
    return Response.json(
      { detail: "Unexpected upstream redirect" },
      { status: 502, headers: responseHeaders },
    );
  const payload: unknown = await result.json().catch(() => null);
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const accessToken = record.access_token;
    // Remove credentials from every object response, including error responses.
    for (const field of ["access_token", "refresh_token", "id_token"])
      delete record[field];
    if (
      result.ok &&
      ["user/login", "user/password-reset/confirm"].includes(path) &&
      typeof accessToken === "string"
    ) {
      const seconds =
        typeof record.expires_in === "number"
          ? Math.min(lifetime, Math.max(0, record.expires_in))
          : lifetime;
      responseHeaders.set(
        "Set-Cookie",
        cookie(seal(accessToken, key, Date.now() + seconds * 1000), seconds),
      );
    }
  }
  if (path === "user/logout" || result.status === 401)
    responseHeaders.set("Set-Cookie", cookie("", 0));
  if (result.status === 204)
    return new Response(null, { status: 204, headers: responseHeaders });
  return Response.json(payload, {
    status: result.status,
    headers: responseHeaders,
  });
}
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
