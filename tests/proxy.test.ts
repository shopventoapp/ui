import { describe, expect, test } from "bun:test";
import {
  instanceOrigin,
  isShopProxyPath,
  proxyShopRequest,
  readSmallJson,
} from "../src/proxy";

const site = "https://storefront.example";
const apiUrl = "https://installation.example";

function request(path: string, init?: RequestInit) {
  return new Request(site + path, init);
}

function fakeFetch(
  run: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Response | Promise<Response>,
): typeof fetch {
  return run as typeof fetch;
}

describe("instance configuration", () => {
  test("accepts HTTPS origins and loopback development only", () => {
    expect(instanceOrigin(apiUrl)?.origin).toBe(apiUrl);
    expect(instanceOrigin("http://localhost:9123")?.origin).toBe(
      "http://localhost:9123",
    );
    for (const value of [
      undefined,
      "",
      "http://installation.example",
      "https://user:pass@installation.example",
      `${apiUrl}/api`,
      `${apiUrl}?key=example`,
      `${apiUrl}#part`,
    ])
      expect(instanceOrigin(value)).toBeNull();
  });
  test("keeps non-shop APIs outside the proxy", () => {
    expect(isShopProxyPath("/api/shop/articles/")).toBe(true);
    expect(isShopProxyPath("/branding/theme.css")).toBe(true);
    expect(isShopProxyPath("/api/table-reservations/public/settings")).toBe(
      true,
    );
    expect(isShopProxyPath("/api/admin/users")).toBe(false);
    const digest = "a".repeat(64);
    expect(isShopProxyPath(`/branding/fonts/${digest}.woff2`)).toBe(true);
    expect(isShopProxyPath(`/branding/fonts/${digest}.woff`)).toBe(true);
    for (const path of [
      "/branding/fonts/example.woff2",
      `/branding/fonts/${digest}.ttf`,
      `/branding/fonts/${digest}.woff2/`,
      `/branding/fonts/${"A".repeat(64)}.woff2`,
      `/branding/fonts/${digest}%2f.woff2`,
    ])
      expect(isShopProxyPath(path)).toBe(false);
  });
});

describe("same-origin shop transport", () => {
  test("rejects missing configuration, traversal, unsupported paths and foreign mutations before fetching", async () => {
    const fetcher = fakeFetch(() => {
      throw new Error("Must not fetch");
    });
    expect(
      (await proxyShopRequest(request("/api/shop/settings"), { fetcher }))
        .status,
    ).toBe(503);
    expect(
      (await proxyShopRequest(request("/api/admin/users"), { apiUrl, fetcher }))
        .status,
    ).toBe(404);
    expect(
      (
        await proxyShopRequest(request("/api/shop/articles%2fprivate"), {
          apiUrl,
          fetcher,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await proxyShopRequest(
          request("/api/shop/user/logout", {
            method: "POST",
            headers: { Origin: "https://foreign.example" },
          }),
          { apiUrl, fetcher },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await proxyShopRequest(
          request("/api/shop/user/logout", { method: "POST" }),
          { apiUrl, fetcher },
        )
      ).status,
    ).toBe(403);
  });
  test("forwards query, body and first-party cookie without trusting spoofed visitor headers", async () => {
    let called = false;
    const fetcher = fakeFetch(async (input, init) => {
      called = true;
      expect(String(input)).toBe(`${apiUrl}/api/shop/cart/?locale=de`);
      const headers = new Headers(init?.headers);
      expect(headers.get("Cookie")).toBe("shop_access_token=synthetic");
      expect(headers.get("Authorization")).toBeNull();
      expect(headers.get("X-Visitor-Ip")).toBeNull();
      expect(headers.get("X-Forwarded-For")).toBeNull();
      expect(headers.get("X-Forwarded-Host")).toBe("storefront.example");
      expect(init?.redirect).toBe("manual");
      expect(await new Response(init?.body).text()).toBe('{"items":[]}');
      return Response.json({ ok: true });
    });
    const response = await proxyShopRequest(
      request("/api/shop/cart/?locale=de", {
        method: "POST",
        headers: {
          Origin: site,
          Cookie:
            "unrelated=private; shop_access_token=synthetic; preferences=private",
          Authorization: "Bearer ignored",
          "X-Visitor-Ip": "192.0.2.5",
          "X-Forwarded-For": "192.0.2.6",
          "CF-Connecting-IP": "192.0.2.7",
          "Content-Type": "application/json",
        },
        body: '{"items":[]}',
      }),
      { apiUrl, fetcher },
    );
    expect(called).toBe(true);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  test("forwards only edge-supplied IPs when the Worker opts into trust", async () => {
    const fetcher = fakeFetch((_input, init) => {
      expect(new Headers(init?.headers).get("X-Visitor-Ip")).toBe("192.0.2.7");
      return Response.json({ ok: true });
    });
    await proxyShopRequest(
      request("/api/shop/settings", {
        headers: { "CF-Connecting-IP": "192.0.2.7" },
      }),
      { apiUrl, trustVisitorIp: true, fetcher },
    );
  });
  test("rewrites cookies to the first-party host and removes login bearer credentials", async () => {
    const fetcher = fakeFetch(
      () =>
        new Response(
          JSON.stringify({
            access_token: "synthetic",
            nested: { refresh_token: "synthetic" },
            user_id: 4,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie":
                "shop_access_token=synthetic; Domain=installation.example; Path=/api; SameSite=None; Max-Age=3600",
              "Access-Control-Allow-Origin": "*",
            },
          },
        ),
    );
    const response = await proxyShopRequest(
      request("/api/shop/user/login", {
        method: "POST",
        headers: { Origin: site },
      }),
      { apiUrl, fetcher },
    );
    expect(await response.json()).toEqual({ nested: {}, user_id: 4 });
    const cookie = response.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain=");
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });
  test("keeps upstream callbacks on the storefront origin without following redirects", async () => {
    const fetcher = fakeFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { Location: `${apiUrl}/buchung?reference=synthetic` },
        }),
    );
    const response = await proxyShopRequest(
      request("/api/shop/stripe/success"),
      { apiUrl, fetcher },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      `${site}/buchung?reference=synthetic`,
    );
  });
  test("returns a neutral failure without upstream details", async () => {
    const fetcher = fakeFetch(() => {
      throw new Error("private infrastructure detail");
    });
    const response = await proxyShopRequest(request("/api/shop/settings"), {
      apiUrl,
      fetcher,
    });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("infrastructure");
  });
  test("branding fonts are exact read-only asset routes", async () => {
    const path = `/branding/fonts/${"b".repeat(64)}.woff2`;
    let calls = 0;
    const fetcher = fakeFetch((input, init) => {
      calls += 1;
      expect(String(input)).toBe(apiUrl + path);
      return new Response(
        init?.method === "HEAD" ? null : new Uint8Array([119, 79, 70, 50]),
        { headers: { "Content-Type": "font/woff2" } },
      );
    });
    const get = await proxyShopRequest(request(path), { apiUrl, fetcher });
    expect(get.headers.get("Content-Type")).toBe("font/woff2");
    expect([...new Uint8Array(await get.arrayBuffer())]).toEqual([
      119, 79, 70, 50,
    ]);
    const head = await proxyShopRequest(request(path, { method: "HEAD" }), {
      apiUrl,
      fetcher,
    });
    expect(await head.text()).toBe("");
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const response = await proxyShopRequest(
        request(path, { method, headers: { Origin: site } }),
        { apiUrl, fetcher },
      );
      expect(response.status).toBe(405);
    }
    expect(calls).toBe(2);
  });
  test("bounds configuration and credential parsing", async () => {
    await expect(
      readSmallJson(new Response('"0123456789"'), 4),
    ).rejects.toThrow("limit");
  });
});
