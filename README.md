# @shopvento/ui

React components for storefronts built on the Shopvento API: catalogue, cart, checkout, table reservations, newsletter signup, event booking with vouchers, customer accounts (sign-in, registration, dashboard with bookings, orders, vouchers and reservations) and shop building blocks (product cards, prices, dialogs, summaries). The components are plain React with one CSS file per area, no router and no styling runtime. Prices, availability, voucher balances and booking rules stay authoritative in the backend.

Version 0.3 adds the complete catalogue, cart, guest/account checkout and order-return flow, plus table reservations and newsletter signup. Version 0.3 removes the deprecated aliases; see the changelog for breaking changes. Version 0.4 adds a shared same-origin proxy, typed branding, read-only reservation details and neutral catalogue defaults, typed German/English message catalogues and per-render locale formatting. The host owns routing and editorial content.

Full English documentation: [docs.shopvento.de](https://docs.shopvento.de), including guides, the generated component/type reference and the public Shop API reference.

## Requirements

- A Shopvento instance. Every component talks to its storefront API (`/api/shop/*`).
- React 18.2 or 19 and React DOM as peer dependencies.
- An ESM bundler (Next.js, Vite, React Router, Astro islands or similar).
- Current evergreen browsers (Chrome, Edge, Firefox, Safari). The dialogs rely on the native `<dialog>` element.
- Account and shop components call same-origin `/api/shop/*` paths with the session cookie. Use `@shopvento/ui/proxy` (Workers / Fetch) or `@shopvento/ui/proxy/node` (Node HTTP) to keep the HttpOnly session first party.

## Install

```sh
bun add @shopvento/ui
# or: npm install @shopvento/ui
```

Import the styles once in your root layout. `shop.css` is only needed when you use the shop primitives. Complete `ShopFlow` pages also import the additive `shop-flow.css`. Standalone reservation and newsletter forms can import `@shopvento/ui/forms.css` instead, so shop styles stay out of shop-disabled builds.

```ts
import "@shopvento/ui/styles.css";
import "@shopvento/ui/shop.css";
import "@shopvento/ui/shop-flow.css";
```

## Minimal usage

```tsx
"use client";
import { EventBooking } from "@shopvento/ui";

export default function BookingForm() {
  return (
    <EventBooking
      baseUrl="https://your-instance.example"
      eventId={123}
      locationId={1}
      turnstileSiteKey="YOUR-PUBLIC-TURNSTILE-SITE-KEY"
      termsUrl="/terms"
      privacyUrl="/privacy"
    />
  );
}
```

Customer account:

```tsx
"use client";
import { createAccountClient, LoginForm } from "@shopvento/ui";

// Keep the client identity stable (module scope or useMemo).
const client = createAccountClient({
  onUnauthorized: () => window.location.assign("/login"),
});

export function Login() {
  return <LoginForm client={client} onSuccess={() => window.location.assign("/account")} />;
}
```

The [shop flow guide](docs/guides/shop.md), [reservations guide](docs/guides/reservations.md) and [newsletter guide](docs/guides/newsletter.md) explain host composition, legacy storage keys, validation and payment returns. New integrations can start with `ShopFlow` from `@shopvento/ui/shop-flow`; import standalone forms from `@shopvento/ui/forms` to keep checkout out of marketing-page JavaScript. Root exports remain available. Existing hosts must configure their original cart, draft, pending-order and event names through `storage`.

The [integration guide](docs/integration.md) describes every component, the booking flow, the account dashboard, the shop primitives and the backend contract in detail.

## Theming

All selectors are scoped (`.sv-booking`, `.sv-account`, `.sv-redesign`, `.sv-shop-*`) and no global reset is shipped. Components read CSS custom properties with the `--sv-` prefix; set them on any ancestor:

```css
.my-storefront {
  --sv-font: "Inter", system-ui, sans-serif;
  --sv-background: #fff;
  --sv-text: #1f1f1f;
  --sv-primary: #0b5cad;
  --sv-on-primary: #fff;
  --sv-border: #d0d0d0;
  --sv-radius: 0.5rem;
}
```

The full variable list with defaults is in the [integration guide](docs/integration.md#css-variables). The user interface texts are German by default. Use `<ShopventoProvider locale="en">` around a route or visitor subtree for English copy and formatting; see the [locale and labels guide](docs/guides/labels.md) for custom catalogues and per-key overrides. Booking components accept `labels` overrides through `Partial<BookingLabels>`; account and shop components also take their labels as props.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `bun install`, then `bun run lint`, `bun run typecheck`, `bun test` and `bun run build`.

## Documentation development

`bun run docs:build` builds the static site in `site/`, including the TypeDoc reference and locally bundled Redoc API viewer. `bun run docs:check` validates internal pages, fragments and assets and requires safe attributes on external links. `bun run typecheck` includes the runnable examples; `bun run typecheck:examples:built` checks them against the built package declarations after `bun run build`.

- `scripts/wire-documentation.ts`: keep public wire type and field documentation when either client generator runs.
- `scripts/build-docs.ts`: build the guides from `docs/guides/`, embed source examples, generate TypeDoc, validate the OpenAPI document and bundle the API viewer.
- `scripts/check-docs-links.ts`: check generated HTML links, fragments, local assets and outbound-link attributes; accepts an optional site directory.
- `scripts/export-public-openapi.ts`: `bun run export:openapi /absolute/path/backend-openapi.json [output.json]` keeps only the exact public client paths/methods and their reachable components, neutralizes backend schema names and replaces deployment metadata. If the backend export is unavailable, `bun run export:openapi --from-wire` reconstructs the limited contract from the committed TypeScript wire types and public call sites. The resulting API source note explicitly states the missing backend-only constraints.

The GitHub Pages workflow builds on main and version tags. Server-proxy fixtures in `tests/fixtures/docs-proxy.ts` run automatically through the test suite using native server Web APIs. Repository Pages source, custom domain and DNS are configured separately; the build emits `CNAME` for `docs.shopvento.de`.

## Licence

MIT, see [LICENSE](LICENSE). Bundled third-party code and assets (qrcode-generator, Google Sans, the Google "G" mark) keep their own licences and terms, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Host integration (0.4)

- [Same-origin proxy](docs/guides/proxy.md): strict public paths, cookies, origin validation and trusted visitor IPs.
- [Runtime branding](docs/guides/branding.md): `loadBranding`, `brandingTokens` and `brandingStylesheet` from `@shopvento/ui/branding`, usable during static builds, in Workers and browsers.
- `AccountReservationDetail` accepts omitted `rules` and `onChanged` for read-only details; `readOnly` also suppresses editing with rules present. The bundled public OpenAPI has no rules endpoint. Supply authoritative host `ReservationRules` to enable changes; no policy is invented.
- `AccountHelp.phone`, `phoneLabel` and `email` are optional. Empty entries are hidden. `help.company` can reuse already loaded public company contact as a fallback; this never reads the customer's profile phone/email.
- Catalogue placeholders are neutral parcels. Configure section `placeholder` artwork and `filterChips` attribute/query/options data for host presentation. Copy uses the existing label catalogues. See the [shop guide](docs/guides/shop.md#neutral-defaults-and-section-presentation).
