# Integration examples

These source files are typechecked by `bun run typecheck` and copied verbatim into the guides by `bun run docs:build`. They use public placeholder configuration and do not contact an installation during checks.

- `event-booking.tsx`: compact event booking client component.
- `booking-return.tsx`: read a checkout return URL after mount.
- `vouchers.ts`: sanitize and check a public voucher code on demand.
- `labels.tsx`: retain host Tasting terminology through label overrides.
- `customer-account.tsx`: stable same-origin account client and login form.
- `shop.tsx`: a controlled product presentation with integer-cent prices.
- `next-app/app/layout.tsx` and `page.tsx`: Next.js App Router CSS and client boundary. Copy the shared `event-booking.tsx` at the relative location or adjust the import.
- `next-app/app/api/shop/[...path]/route.ts`: host-owned Node-runtime session proxy recipe. It checks mutation Origins, allowlists public operations, encrypts session tokens in secure HttpOnly cookies and redacts upstream credentials. The guide explains the server-only environment variables and OAuth/download boundaries.

To run the components, copy the relevant source into a React 18.2/19 ESM app with `@shopvento/ui` installed, import its CSS once, and replace the public placeholder configuration. For Next.js, put the layout and page under `app/` and adapt the example import. The repository does not install or run a second Next.js application just to validate these standard React and Web Request/Response examples.

The package build runs before a second examples typecheck in CI, so examples are checked against both the source API and the actual published declaration surface. Complete cart and checkout UI flows are not provided by the package.
