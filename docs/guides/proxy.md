# Same-origin proxy

Use a Fetch handler in Cloudflare Workers or a framework route:

```ts
import { proxyShopRequest, isShopProxyPath } from "@shopvento/ui/proxy";

export default {
  fetch(request: Request, env: { SHOPVENTO_API_URL: string }) {
    if (isShopProxyPath(new URL(request.url).pathname)) {
      return proxyShopRequest(request, {
        apiUrl: env.SHOPVENTO_API_URL,
        trustVisitorIp: true, // Only behind Cloudflare's trusted edge.
      });
    }
    return new Response("Not found", { status: 404 });
  },
};
```

`createWorkerShopProxy(options)` returns a Fetch-compatible Worker handler. For Node:

```ts
import { createServer } from "node:http";
import { createNodeShopProxy } from "@shopvento/ui/proxy/node";

createServer(createNodeShopProxy({
  origin: "https://shop.example",
  apiUrl: "https://instance.example",
})).listen(3100);
```

Node uses an explicit public origin and never trusts forwarded host headers. The configured upstream must be an HTTPS origin without credentials, path, query or fragment; loopback HTTP is allowed for development. Do not set `trustVisitorIp` on a public Node listener that accepts arbitrary client headers.

Allowed routes are `/api/shop/*`, the exact public table-reservation form/settings/cancel endpoints, `/branding/theme.css`, and lowercase SHA-256 font filenames under `/branding/fonts/` ending in `.woff` or `.woff2`. Branding assets accept only GET/HEAD. Encoded traversal, unrelated APIs and unsupported methods are rejected. Mutation requests need the exact host `Origin`; `Sec-Fetch-Site: same-site` or `cross-site` is rejected too.

Only the session cookie and selected content headers go upstream. Authorization, unrelated host cookies and spoofable visitor headers stay private. Session cookies become host-only, HttpOnly, SameSite=Strict, Path=/, and Secure on HTTPS. Credential JSON from login/callback/password-reset-confirm responses is bounded and redacted. Upstream same-instance redirects return to the host origin. Responses are no-store, including CDN caches. Fetch failures return a neutral error without logging customer or credential data.
