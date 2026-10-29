# @shopvento/ui

React components for storefronts built on the Shopvento API: tasting and event booking with vouchers, customer accounts (sign-in, registration, dashboard with bookings, orders, vouchers and reservations) and shop building blocks (product cards, prices, dialogs, summaries). The components are plain React with one CSS file per area, no router and no styling runtime. Prices, availability, voucher balances and booking rules stay authoritative in the backend.

Version 0.1 covers booking, vouchers, the customer account and shop presentation primitives. A complete shop flow (cart and checkout) is planned for a later release.

## Requirements

- A Shopvento instance. Every component talks to its storefront API (`/api/shop/*`).
- React 18.2 or 19 and React DOM as peer dependencies.
- An ESM bundler (Next.js, Vite, React Router, Astro islands or similar).
- Current evergreen browsers (Chrome, Edge, Firefox, Safari). The dialogs rely on the native `<dialog>` element.
- Account and shop components call same-origin `/api/shop/*` paths with the session cookie. The host site must proxy these paths to the instance so the HttpOnly cookie stays first party.

## Install

```sh
bun add @shopvento/ui
# or: npm install @shopvento/ui
```

Import the styles once in your root layout. `shop.css` is only needed when you use the shop components.

```ts
import "@shopvento/ui/styles.css";
import "@shopvento/ui/shop.css";
```

## Minimal usage

```tsx
"use client";
import { TastingBooking } from "@shopvento/ui";

export default function BookingForm() {
  return (
    <TastingBooking
      baseUrl="https://your-instance.example"
      tastingId={123}
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

The full variable list with defaults is in the [integration guide](docs/integration.md#css-variables). The user interface texts are German by default; account and shop components take their labels as props.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `bun install`, then `bun run lint`, `bun run typecheck`, `bun test` and `bun run build`.

## Licence

MIT, see [LICENSE](LICENSE). Bundled third-party code and assets (qrcode-generator, Google Sans, the Google "G" mark) keep their own licences and terms, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
