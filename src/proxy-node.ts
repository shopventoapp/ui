import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { type ProxyOptions, proxyShopRequest } from "./proxy";

/** Node adapter configuration. Supply the public origin explicitly; forwarded headers are untrusted. */
export interface NodeShopProxyOptions extends ProxyOptions {
  /** Exact externally visible origin, used for CSRF validation and cookie rewriting. */
  origin: string;
}
/** Create a Node HTTP handler. Route only public shop and allowlisted branding paths to it. */
export function createNodeShopProxy(options: NodeShopProxyOptions) {
  const origin = new URL(options.origin);
  if (
    origin.origin !== options.origin ||
    !["http:", "https:"].includes(origin.protocol)
  )
    throw new Error("Expected an exact public HTTP(S) origin");
  return async (
    incoming: IncomingMessage,
    outgoing: ServerResponse,
  ): Promise<void> => {
    try {
      // Never allow a network-path request target to replace the configured origin.
      if (!incoming.url?.startsWith("/") || incoming.url.startsWith("//")) {
        outgoing.writeHead(400).end();
        return;
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value))
          for (const part of value) headers.append(name, part);
        else if (value !== undefined) headers.set(name, value);
      }
      const method = incoming.method || "GET";
      const mutation = !["GET", "HEAD"].includes(method);
      const request = new Request(origin.origin + incoming.url, {
        method,
        headers,
        ...(mutation ? { body: Readable.toWeb(incoming), duplex: "half" } : {}),
      } as RequestInit);
      const result = await proxyShopRequest(request, options);
      outgoing.statusCode = result.status;
      result.headers.forEach((value, name) => {
        if (name !== "set-cookie") outgoing.setHeader(name, value);
      });
      const cookies = result.headers.getSetCookie();
      if (cookies.length) outgoing.setHeader("Set-Cookie", cookies);
      if (result.body)
        await pipeline(
          Readable.fromWeb(
            result.body as unknown as Parameters<typeof Readable.fromWeb>[0],
          ),
          outgoing,
        );
      else outgoing.end();
    } catch {
      if (!outgoing.headersSent)
        outgoing.writeHead(502, { "Cache-Control": "no-store" });
      outgoing.end();
    }
  };
}
