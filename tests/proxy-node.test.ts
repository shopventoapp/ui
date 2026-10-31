import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
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

test("Node adapter serves an already decoded gzip upstream body without stale transport headers", async () => {
  const payload = JSON.stringify({
    message: "Compressed catalogue response".repeat(30),
  });
  const compressed = gzipSync(payload);
  const upstream = createServer((_request, response) => {
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      "Content-Length": String(compressed.length),
      Connection: "keep-alive",
      "Keep-Alive": "timeout=5",
    });
    response.end(compressed);
  });
  const proxy = createServer();
  const listen = (server: ReturnType<typeof createServer>) =>
    new Promise<number>((resolve) =>
      server.listen(0, "127.0.0.1", () =>
        resolve((server.address() as { port: number }).port),
      ),
    );
  const upstreamPort = await listen(upstream);
  const proxyPort = await listen(proxy);
  proxy.on(
    "request",
    createNodeShopProxy({
      origin: `http://127.0.0.1:${proxyPort}`,
      apiUrl: `http://127.0.0.1:${upstreamPort}`,
    }),
  );
  try {
    const result = await fetch(
      `http://127.0.0.1:${proxyPort}/api/shop/catalogue`,
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("Content-Encoding")).toBeNull();
    expect(result.headers.get("Content-Length")).toBeNull();
    expect(await result.text()).toBe(payload);
  } finally {
    for (const server of [proxy, upstream]) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});
