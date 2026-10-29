# Getting started

You need a Shopvento installation, React 18.2 or 19, and an ESM bundler. The package works with Next.js, Vite and other React hosts. Native dialogs require a current evergreen browser.

```sh
bun add @shopvento/ui
```

Import the shared styles once. Add the separate shop stylesheet when using shop primitives:

```ts
import "@shopvento/ui/styles.css";
import "@shopvento/ui/shop.css";
```

## Book an event

The example below is included verbatim from the typechecked `examples/event-booking.tsx`. Replace the installation origin and identifiers with your public configuration. `baseUrl` is an origin, without `/api/shop`.

<!-- example:examples/event-booking.tsx -->

The backend must allow your storefront origin in its CORS configuration. Public booking reads omit credentials by default. For cookie-based authenticated booking, use a same-origin proxy or the explicit credentials option with the installation's CORS policy.

Guest booking needs both `guest_booking_enabled` and `direct_booking_enabled`, plus a public Turnstile site key valid for the storefront hostname. The backend validates the short-lived challenge token. Never put the private Turnstile secret in a React prop or browser environment variable. Configure the host CSP for the Turnstile script and frames.

## Pick the integration surface

- [Event booking](/guides/event-booking/): a compact form or host-routed calendar and booking steps.
- [Vouchers](/guides/vouchers/): public checks and backend-authoritative redemption.
- [Customer account](/guides/customer-account/): the host owns a same-origin API proxy and session cookies.
- [Cart and checkout](/guides/shop/): catalogue, persistent cart, guest/account checkout and verified payment returns.
- [Table reservations](/guides/reservations/) and [newsletter signup](/guides/newsletter/): public forms with Turnstile and host-owned content.

Use [Next.js App Router](/guides/nextjs/) for the layout/client boundary, [theming](/guides/theming/) for CSS, and [labels](/guides/labels/) for copy overrides. The complete examples are in the [GitHub repository](https://github.com/shopventoapp/ui/tree/main/examples).
