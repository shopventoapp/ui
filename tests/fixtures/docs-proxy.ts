/** Run server-side proxy checks with Bun's native Web APIs, outside the DOM test preload. */
import assert from "node:assert/strict";
import {
  GET,
  POST,
} from "../../examples/next-app/app/api/shop/[...path]/route";

process.env.SHOPVENTO_ORIGIN = "https://installation.shopvento.app";
process.env.STOREFRONT_ORIGIN = "https://store.example";
process.env.SHOPVENTO_SESSION_KEY = Buffer.alloc(32, 7).toString("base64");
function request(path: string, origin = "https://store.example") {
  return new Request(`https://store.example/api/shop/${path}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "customer@example.com",
      password: "example-only",
    }),
  });
}
const checks: Record<string, () => Promise<void>> = {
  async boundaries() {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return Response.json({});
    }) as unknown as typeof fetch;
    assert.equal(
      (await POST(request("user/login", "https://elsewhere.example"))).status,
      403,
    );
    assert.equal((await POST(request("admin/reset"))).status, 404);
    assert.equal(
      (await GET(new Request("https://store.example/api/shop/user/login")))
        .status,
      404,
    );
    assert.equal(calls, 0);
  },
  async session() {
    const credential = "example-upstream-credential";
    globalThis.fetch = (async () =>
      Response.json({
        access_token: credential,
        refresh_token: "example-refresh",
        expires_in: 120,
        success: true,
      })) as unknown as typeof fetch;
    const login = await POST(request("user/login"));
    const cookie = login.headers.get("set-cookie") ?? "";
    assert.equal(cookie.includes(credential), false);
    for (const attribute of [
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Max-Age=120",
    ])
      assert.ok(cookie.includes(attribute));
    const body = await login.json();
    assert.equal(body.access_token, undefined);
    assert.equal(body.refresh_token, undefined);
    let upstreamHeaders = new Headers();
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      upstreamHeaders = new Headers(init?.headers);
      return Response.json({ id: "customer" });
    }) as unknown as typeof fetch;
    await GET(
      new Request("https://store.example/api/shop/user/profile", {
        headers: {
          Cookie: `${cookie.split(";")[0]}; unrelated=browser-cookie`,
          Authorization: "Bearer untrusted-browser-value",
        },
      }),
    );
    assert.equal(upstreamHeaders.get("Authorization"), `Bearer ${credential}`);
    assert.equal(upstreamHeaders.get("Cookie"), null);
    await GET(
      new Request("https://store.example/api/shop/user/profile", {
        headers: { Cookie: "__Host-shopvento-session=invalid" },
      }),
    );
    assert.equal(upstreamHeaders.get("Authorization"), null);
  },
  async expiry() {
    globalThis.fetch = (async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://elsewhere.example" },
      })) as unknown as typeof fetch;
    assert.equal(
      (await GET(new Request("https://store.example/api/shop/settings")))
        .status,
      502,
    );
    globalThis.fetch = (async () =>
      Response.json(
        { detail: "Expired" },
        { status: 401 },
      )) as unknown as typeof fetch;
    const expired = await GET(
      new Request("https://store.example/api/shop/user/profile"),
    );
    assert.ok(expired.headers.get("Set-Cookie")?.includes("Max-Age=0"));
    globalThis.fetch = (async () =>
      Response.json({ success: true })) as unknown as typeof fetch;
    assert.ok(
      (await POST(request("user/logout"))).headers
        .get("Set-Cookie")
        ?.includes("Max-Age=0"),
    );
  },
};
const name = Bun.argv[2];
if (!checks[name]) throw new Error("Specify a proxy fixture check");
await checks[name]();
console.log(`Proxy ${name} passed`);
