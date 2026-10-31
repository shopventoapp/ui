# Customer account

Use `createAccountClient` with sign-in, registration, password reset, email verification and session hooks. Use `createDashboardClient` for bookings, orders, reservations, vouchers, addresses and settings. Keep each client stable at module scope or with `useMemo`.

<!-- example:examples/customer-account.tsx -->

The host owns login redirects, logout, detail routes, refresh after mutations and editorial copy. A hint cookie is never authentication. `useAccountSession` loads the authoritative profile and cancels obsolete reads. Incorrect login credentials stay inline; other account-client 401 responses call `onUnauthorized`.

## Same-origin session contract

Account paths are fixed relative `/api/shop/user/*` paths. Account and dashboard transports use same-origin credentials, no-store reads and redirect rejection. The shop client also sends cookie credentials and should use the same-origin proxy. Cross-origin base URLs do not make session cookies first party.

The host proxy must:

- Allowlist public paths and methods and choose a fixed HTTPS upstream origin on the server.
- Check the exact storefront Origin on mutations to prevent cross-site requests.
- Keep session credentials in secure HttpOnly cookies with an appropriate SameSite policy.
- Convert the session credential into the upstream authentication expected by the installation.
- Remove upstream access tokens from login JSON. `AccountLoginResponse` describes the browser-visible response.
- Disable caching and avoid forwarding arbitrary browser cookies, headers or upstream redirects.

## Proxy example

`examples/next-app/app/api/shop/[...path]/route.ts` is a typechecked Node-runtime route using a fixed public allowlist, exact Origin checks, an authenticated encrypted HttpOnly cookie and an upstream bearer token. It forwards no browser cookie to the installation and removes the access token from the JSON response. It supports login and password setup sessions and clears logout sessions.

Set server-only `SHOPVENTO_ORIGIN` to the HTTPS installation origin, `STOREFRONT_ORIGIN` to the exact HTTPS host origin and `SHOPVENTO_SESSION_KEY` to a private base64-encoded random 32-byte key. Keep these values out of `NEXT_PUBLIC_*` variables. Terminate HTTPS at the host. Cookie lifetime is bounded to one hour and to a shorter upstream lifetime when supplied. Upstream authorization still decides whether the token is valid.

The example is a starting point for the host's session design. Add host-specific rate limiting and operational session management before rollout. It deliberately excludes Google OAuth redirects: enable those only with the backend's supported storefront callback, state validation and cookie handoff contract. It also excludes file downloads; authorize and proxy those separately if the host needs them.

The full [proxy source](https://github.com/shopventoapp/ui/blob/main/examples/next-app/app/api/shop/%5B...path%5D/route.ts) is copied into a host application; it is not exported by the component package.

## Tokens, consent and registration

Token components take `token: string | null`. Read a token once, remove every `token` query parameter with `history.replaceState` while preserving router state, and keep it only in memory. An explicit confirmation button consumes it. Reloading the sanitized page requires opening the original email link again.

Registration asks for first/last name, email, password and confirmation, required terms/privacy consent and optional newsletter consent. Newsletter starts unticked and uses a separate double opt-in email. The legacy `marketing_consent` request field carries required terms/privacy acceptance only.

Passwords require at least eight Unicode characters and at most 72 UTF-8 bytes, with upper/lowercase, digit and special-character requirements shown by `PasswordChecklist`.

## Dashboard

Provide `AccountLabels`, `AccountRoutes`, `AccountHelp`, allowed countries, runtime minimum age and `ReservationRules`. Wrap dashboard content in the theme scope so its CSS tokens are available. Components include `AccountOverview`, `AccountBookings`, `AccountEventDetail`, `AccountOrderDetail`, `AccountReservationDetail`, `AccountVouchers`, `AccountVoucherDetail` and `AccountSettings`.

The backend supplies rescheduling cutoffs, prior-move indicators and withdrawal eligibility per order line. The host refreshes data after successful mutations. Newsletter status is false, pending or true; `profileNewsletterAdapter` handles profile timestamps and explicit subscribe/unsubscribe calls.

Payment retry, voucher transfer, guest magic links, data export, default-address management and a full order timeline are not provided.

## Optional public contact and reservation details

`AccountHelp.phone`, `phoneLabel` and `email` are optional. Whitespace-only values are empty; each empty entry is hidden in the sidebar and help card. Pass already loaded public company contact through `help.company: { phone, email }` to supply a fallback. Explicit host contact takes priority. The package does not substitute the customer's private profile contact.

`AccountReservationDetail` displays an existing reservation with no `rules` or `onChanged`. Supply authoritative `ReservationRules` to enable changes before the configured cutoff; `readOnly` always suppresses editing and cancellation. Missing rules never imply a change policy. The bundled public OpenAPI provides reservation list/detail/update/cancel operations but no reservation-rules endpoint, so this release cannot load those rules from the backend.
