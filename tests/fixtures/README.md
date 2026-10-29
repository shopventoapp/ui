# Test fixtures

- `docs-proxy.ts` exercises the documented host session proxy with Web API requests.
- `shop-0.2.0.css` is the exact `dist/shop.css` output of version 0.2.0 at commit `742ff62`. That release's copy script writes `src/shop.css` unchanged. SHA-256: `a18e8729be39daecbc86a90eb0dc839ae91a928805452e6745d347e398ddab39`. The additive flow stylesheet must never change this compatibility fixture.
