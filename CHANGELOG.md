# Changelog

All notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- English static documentation with integration guides, TypeDoc component/type reference and a locally bundled read-only Shop API reference.
- Typechecked source and built-package examples, a host-owned session proxy recipe, a public OpenAPI exporter and static link checks.
- SHA-pinned GitHub Pages workflow for main and version tags.

## [0.3.0] - 2026-10-29

### Added

- Framework-neutral `ShopFlow` for catalogue, category and product views, persistent cart, guest/account checkout, postcode delivery-zone quotes, offered dates, legal acceptance, hosted Stripe Checkout and verified order returns.
- Configurable legacy storage keys, route adapters, product mapping, feature policies, editorial slots and German message dictionaries.
- Separate `forms.css` export keeps standalone public forms independent of shop assets.
- Generic `ReservationForm` and `NewsletterSignup` with runtime public API adapters, Turnstile, opening-hour validation, account prefill and separate double opt-in.
- Public cart, draft, checkout validation, fulfilment, display and return-consent helpers; migrated consumer regressions and new form/validation tests.
- Complete cart/checkout, reservation and newsletter guides with typechecked examples and documented public APIs.

### Compatibility

- All 0.2 exports and props remain available. Host storage names must be configured when adopting an existing cart/draft; no stored customer data is migrated or discarded automatically.
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

### Deprecated

- All previous `Tasting`/`tasting` public names remain compatible aliases until
  1.0. New props take precedence when both names are supplied. Backend endpoints,
  generated wire contracts, request fields, draft storage and URL filters stay
  unchanged.

- When both `events` and deprecated `tastings` are supplied, `events` wins.
  Hosts replacing only `tastings` on data returned by `useCalendar` must replace
  `events` instead. `CalendarData` keeps both arrays required; `CalendarInput`
  accepts either key for component props.
- The package calls `client.listEvents` and `client.getEvent`. Hand-written
  clients must provide these methods; overriding only `listTastings` or
  `getTasting` no longer takes effect.
- Eight German default texts changed to generic event terminology: loading,
  unavailable event, disabled guest booking, required voucher, missing voucher
  count, voucher description, voucher notice and event details. Hosts that want
  "Tasting" wording must pass `labels` overrides.

## [0.1.0] - 2026-10-29

First public release.

### Added

- Tasting and event booking: calendar, date list and sheet, seat selection, guest and account booking, voucher allocation, Turnstile, booking result and calendar file.
- Customer account: sign-in, registration, Google sign-in, password reset, email verification and change, account-first entry dialog.
- Account dashboard: overview, bookings with rescheduling and tickets, orders with withdrawal, vouchers with history, table reservations, settings and newsletter.
- Shop presentation primitives: surface, navigation, hero, sections, product grid and card, media, price, quantity, dialog, summary, checkout steps, declarations, notices, and a typed client for the public catalogue, quote and checkout API.
- Theming through `--sv-*` CSS custom properties; styles in `@shopvento/ui/styles.css` and `@shopvento/ui/shop.css`.
