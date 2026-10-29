# Next.js App Router

Import the package CSS in your root layout. Components that use browser state, hooks or events belong in a client component. The package does not install a router or add a global CSS reset.

## Root layout

This is `examples/next-app/app/layout.tsx`:

<!-- example:examples/next-app/app/layout.tsx -->

## Client page

This is `examples/next-app/app/page.tsx`. The event component and its configuration come from the same typechecked example used in the getting-started guide.

<!-- example:examples/next-app/app/page.tsx -->

Place `examples/event-booking.tsx` next to the example app as shown in the repository, or adjust the relative import when copying it into an existing app. The example uses public placeholder configuration; replace it with your installation settings.

## Account and shop routes

Account and shop clients need a same-origin `/api/shop/*` proxy. Copy the [example proxy](/guides/customer-account/#proxy-example) into `app/api/shop/[...path]/route.ts` and configure the server-only environment variables described there. It uses Web Request/Response handlers and Node crypto, so it runs in the Node runtime.

Do not forward every `/api` path to the backend. Keep the public allowlist, exact Origin checks and server-owned cookie handling. OAuth additionally needs the installation's supported storefront callback flow; the example does not enable OAuth.

## Return pages

Render `BookingResult` from a client component, reading `window.location.href` in an effect as in the [booking guide](/guides/event-booking/#payment-return). The return URL displays a reference; backend confirmation determines payment status.
