# Runtime branding

The branding entrypoint has no React or browser dependency. Server/static builds and Workers use an explicit instance origin; browsers omit it to use the same-origin proxy:

```ts
import { loadBranding, brandingStylesheet, brandingTokens } from "@shopvento/ui/branding";

const serverBrand = await loadBranding({ apiUrl: "https://instance.example" });
const browserBrand = await loadBranding({ signal: new AbortController().signal });
const variables = brandingTokens({ "--sv-primary": "#351c45" });
// variables["--sv-primary"] === "var(--brand-primary, #351c45)"
```

`Branding` includes instance name, logo/alt/footer logo, legal/contact URLs, navigation/location links, colours, fonts and optional public company contact. Missing fields are omitted. Invalid shapes, failed HTTP status codes and payloads above 128 KiB reject. `fetcher` allows an injected transport; hosts choose their fallback and timeout/abort policy. No customer credentials are needed.

Render a stylesheet link with `href={brandingStylesheet}` to load the instance CSS and fonts through the proxy. Apply `brandingTokens(hostFallbacks)` to the root style to map backend `--brand-*` custom properties to package `--sv-*` tokens. The helper uses fixed property names; it does not interpolate instance JSON into executable CSS. Hosts still validate public URLs before rendering navigation links.
