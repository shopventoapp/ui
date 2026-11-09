# Changelog

All notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Tenant payment-status gating for shop checkout and both event-booking forms, with host capability/state props or uncached client loading and guest/account/retry guards. `Bald verfügbar` is reserved for inactive payments; loading stays neutral, and failed status reads offer retry.
- Zero-payable backend cart quotes, estimated fully voucher-funded/free event bookings and free table reservations remain usable without card payments. Event bookings use public voucher allocation estimates because there is no booking quote endpoint; backend payment-unavailable rejections show their message and lock retries for that exact selection.
- Timed private-event opening exceptions preserve outside-window reservations, including buffered closures across midnight, with localized closure notices and focused time validation. Legacy all-day closures and replacement opening hours remain compatible.

### Fixed

- Retry transient payment-status failures once with backoff, refresh on entering checkout or the booking summary, and expose an explicit retry with a visible disabled-action reason.
- Debounce compact booking voucher lookups, skip incomplete codes and reuse successful checks; failed checks can be retried without editing the code and are rechecked on submit.
- Honor booking credentials for status reads, match backend timed-closure detection using only `closed_from`, and preserve the closed-date message when timed closures overlap.

### Changed

- Without a host `paymentStatus` prop, shop and booking forms automatically request `/api/shop/payments/status` on mount. Paid actions are disabled while loading, on errors and unknown responses, or when inactive; zero-payable actions remain available.

### Compatibility

- Both client factories expose `getPaymentStatus`; it is optional on custom `BookingClient` implementations. A missing method or a 404 endpoint retains legacy active behavior.
- `useSubmitBooking` adds `paymentRejected`, and `OpeningWindow` adds optional `closures`. `bookingVoucherAllocation` moved to a shared module and remains exported from the package root.

## [0.5.0] - 2026-11-10

### Fixed

- Underline inline links in public reservation forms and add persistent, translatable field validation with accessible error descriptions and first-invalid-field focus to newsletter and reservation forms (#43825).

### Compatibility

- Complete host catalogues typed as `ShopventoMessages` must add five `reservation` keys: `Bitte gib Deinen Namen ein.`, `Bitte gib Deine E-Mail-Adresse ein.`, `Bitte gib eine gültige E-Mail-Adresse ein.`, `Bitte gib eine gültige Uhrzeit ein, zum Beispiel 18:30.`, and `Bitte wähle eine Personenzahl aus.`; and two `newsletter` keys: `Bitte gib Deine E-Mail-Adresse ein.` and `Bitte gib eine gültige E-Mail-Adresse ein.`. Partial `ShopventoCatalogue` overrides and per-key `labels` remain compatible.
- Newsletter and reservation forms now use `noValidate` and persistent translated field errors instead of native browser validation bubbles. API payloads, existing message keys, exports and props are unchanged.

### Added

- English static documentation with integration guides, TypeDoc component/type reference and a locally bundled read-only Shop API reference.
- Typechecked source and built-package examples, a host-owned session proxy recipe, a public OpenAPI exporter and static link checks.
- SHA-pinned GitHub Pages workflow for main and version tags.

## [0.4.0] - 2026-10-31

### Added

- Per-render `ShopventoProvider`, typed German and English catalogues for shop, booking, account, newsletter, reservation, forms, payment and voucher messages. Hosts can supply partial custom catalogues and retain their existing per-key `labels` overrides.
- Locale-aware date, time, money and number formatting, plus numeric date input order and ISO input support outside German.
- A source guard rejects new customer-visible literal JSX copy and message lookups missing from the catalogue.
- Fetch/Cloudflare Worker proxy at `@shopvento/ui/proxy` and Node HTTP adapter at `@shopvento/ui/proxy/node`, ported from the storefront transport with first-party cookies, exact-origin mutation checks, credential/header redaction, trusted visitor IP forwarding and a strict branding asset allowlist.
- Server/build/Worker/browser `loadBranding`, `brandingTokens`, `brandingTokenMap` and `brandingStylesheet` at `@shopvento/ui/branding`.
- Reservation details without host rules, explicit `readOnly`, and optional `onChanged`. No reservation-rules endpoint exists in the bundled OpenAPI, so editing still needs host rules.
- Optional account phone/email, hidden empty links and fallback to already loaded instance company contact via `help.company`.

### Fixed

- Confirm parsed reservation and birth dates with a written month in every locale. Translate completed pickups, reservation guest plurals and public form errors.
- Use statutory withdrawal wording consistently in English, separate shipping price suffixes from headings, and localize unknown account failures.
- Freeze shipped catalogues, resolve only the requested message area in pure helpers, avoid event reloads on unrelated catalogue changes, and extend the German literal guard to source helpers.
- Price filter chips use catalogue messages and locale money formatting. Sidebar host facets omit the heading when `label` is missing; deep-link filtering stays active when controls are hidden.
- Forward validated browser Origin and Sec-Fetch-Site on cookie writes; the instance shop domain must match the storefront host.
- Strip decoded upstream compression/framing and hop headers in the Node adapter.

## [0.3.0] - 2026-10-29

### Added

- Shared product mapping retains catalogue declarations, legal notes, per-variant unit prices and tracked physical stock rules.
- Framework-neutral `ShopFlow` for catalogue, category and product views, persistent cart, guest/account checkout, postcode delivery-zone quotes, offered dates, legal acceptance, hosted Stripe Checkout and verified order returns.
- Configurable legacy storage keys, route adapters, product mapping, feature policies, editorial slots and German message dictionaries.
- Focused `@shopvento/ui/shop-flow` and `@shopvento/ui/forms` entrypoints with shared ESM chunks keep checkout out of marketing-page JavaScript.
- Separate additive `shop-flow.css` export for complete shop pages.
- Separate `forms.css` export keeps standalone public forms independent of shop assets.
- Generic `ReservationForm` and `NewsletterSignup` with runtime public API adapters, Turnstile, opening-hour validation, account prefill and separate double opt-in.
- Internal cart, draft, checkout validation, fulfilment, display and return-consent logic; migrated consumer regressions and new form/validation tests.
- Complete cart/checkout, reservation and newsletter guides with typechecked examples and documented public APIs.

### Compatibility

- Host storage names must be configured when adopting an existing cart/draft; no stored customer data is migrated or discarded automatically.
- Routes, customer branding, editorial copy and the same-origin Worker/API proxy remain owned by the host.

## [0.2.0] - 2026-10-29

### Added

- Generic public event names: `EventBooking`, `EventBookingProps`, `ShopEvent`,
  `useEvents`, `AccountEventDetail`, `EventColors`, `eventStyle`, booking
  `eventId`, calendar/list `events`, and client `listEvents`/`getEvent`.
- Event CSS token `--sv-event` and account selectors `k-event`/`t-event`, with
  legacy custom-property fallbacks and both class names emitted.
- Partial `BookingLabels` overrides on booking forms, flows, date sheets and
  booking-mode notices for all event-specific default copy.

### Changed

- German defaults use "Veranstaltung" and "Veranstaltungsgutschein" instead of
  tasting-specific terminology. Hosts can override every changed message.
- Booking error-focus tests avoid expensive DOM-object diagnostic formatting
  during asynchronous focus polling, without increasing timeouts.

## [0.1.0] - 2026-10-29

First public release.

### Added

- Tasting and event booking: calendar, date list and sheet, seat selection, guest and account booking, voucher allocation, Turnstile, booking result and calendar file.
- Customer account: sign-in, registration, Google sign-in, password reset, email verification and change, account-first entry dialog.
- Account dashboard: overview, bookings with rescheduling and tickets, orders with withdrawal, vouchers with history, table reservations, settings and newsletter.
- Shop presentation primitives: surface, navigation, hero, sections, product grid and card, media, price, quantity, dialog, summary, checkout steps, declarations, notices, and a typed client for the public catalogue, quote and checkout API.
- Theming through `--sv-*` CSS custom properties; styles in `@shopvento/ui/styles.css` and `@shopvento/ui/shop.css`.
