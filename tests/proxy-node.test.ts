import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { createWorkerShopProxy } from "../src/proxy";
import { createNodeShopProxy } from "../src/proxy-node";

test("Node adapter rejects non-origin configuration", () => {
  expect(() =>
    createNodeShopProxy({ origin: "https://site.example/path" }),
  ).toThrow("origin");
});
test("Worker adapter delegates the strict public transport", async () => {
  const worker = createWorkerShopProxy({
    apiUrl: "https://instance.example",
    fetcher: (async () =>
      Response.json({ ok: true })) as unknown as typeof fetch,
  });
  expect(
    (await worker.fetch(new Request("https://site.example/api/admin"))).status,
  ).toBe(404);
  expect(
    await (
      await worker.fetch(new Request("https://site.example/api/shop/settings"))
    ).json(),
  ).toEqual({ ok: true });
});
test("Node adapter streams requests and responses, validates origin, and preserves separate cookies", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const origin = `http://127.0.0.1:${address.port}`;
  server.on(
    "request",
    createNodeShopProxy({
      origin,
      apiUrl: "https://instance.example",
      fetcher: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        expect(new Headers(init?.headers).get("Authorization")).toBeNull();
        expect(await new Response(init?.body).text()).toBe('{"items":[]}');
        const headers = new Headers({ "Content-Type": "application/json" });
        headers.append(
          "Set-Cookie",
          "shop_access_token=synthetic; Domain=instance.example; SameSite=None; Path=/api",
        );
        headers.append(
          "Set-Cookie",
          "other=synthetic; Domain=instance.example",
        );
        return new Response('{"ok":true}', { headers });
      }) as typeof fetch,
    }),
  );
  try {
    const result = await fetch(`${origin}/api/shop/cart/`, {
      method: "POST",
      headers: { Origin: origin, Authorization: "Bearer synthetic" },
      body: '{"items":[]}',
    });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
    expect(result.headers.getSetCookie()).toHaveLength(2);
    expect(result.headers.getSetCookie()[0]).toContain("HttpOnly");
    expect(result.headers.getSetCookie().join(";")).not.toContain("Domain=");
    expect(
      (
        await fetch(`${origin}/api/shop/cart/`, {
          method: "POST",
          headers: { Origin: "https://other.example" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((e) =>
        e && (e as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING"
          ? reject(e)
          : resolve(),
      ),
    );
  }
});
