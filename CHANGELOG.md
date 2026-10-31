# Changelog

All notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

- Price filter chips use catalogue messages and locale money formatting. Sidebar host facets omit the heading when `label` is missing; deep-link filtering stays active when controls are hidden.
- Forward validated browser Origin and Sec-Fetch-Site on cookie writes; the instance shop domain must match the storefront host.
- Strip decoded upstream compression/framing and hop headers in the Node adapter.

### Breaking

- Price-band copy uses the parameterized keys `bis {0}`, `{0} bis {1} {2}` and `über {0}` so currency formatting can follow the locale; replace the old `über 60 €` override.
- Catalogue exports are now typed against their German keys; arbitrary dictionary indexing should use `getMessages`, `useMessages`, or an explicit string-record view.
- Date inputs follow the selected locale; German keeps `TT.MM.JJJJ`, while English accepts ISO or its numeric locale order.
- Unspecified `ShopMedia` placeholders and default product mapping now use neutral parcel artwork instead of bottles. Request artwork explicitly on the product or section.
- Trade presentation belongs to hosts: `ShopSectionDefinition.filterChips` accepts a typed attribute/query/options group, and `placeholder` accepts built-in artwork or a host element. No category key enables trade presentation. `filterGroups` adds generic sidebar/mobile facets, derived attribute choices, ordering and host predicates for ranges or aliases; grape, bottle-size and deli filters and their legacy URL keys now require host configuration. Explicit product placeholders take priority over section fallbacks.
- Default empty-cart and search copy is neutral; use the neutral label keys `Eine Entdeckung oder ein Geschenk: Such Dir etwas Schönes aus.` and `Produkte und Gutscheine suchen`. The German wording remains the default.

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

### Breaking

- Remove `TastingBooking` / `TastingBookingProps`; use `EventBooking` / `EventBookingProps`.
- Remove `Tasting` and `ShopTasting`; use `ShopEvent`. Backend JSON fields and endpoint paths stay unchanged.
- Remove `tastingId`; use the required `eventId` booking prop.
- Remove `useTastings`; use `useEvents`. Remove the `tastings` hook result, calendar data and calendar/list props; use `events`. `CalendarData` and `CalendarInput` require the event shape.
- Remove `listTastings` / `getTasting`; use `listEvents` / `getEvent` on booking clients.
- Remove `AccountTastingDetail`; use `AccountEventDetail`.
- Remove `TastingColors` / `tastingStyle`; use `EventColors` / `eventStyle`.
- Remove `--sv-tasting` fallbacks and `k-tasting` / `t-tasting` selectors; use `--sv-event` and `k-event` / `t-event`.
- Before 1.0, minor releases may break compatibility; deprecated aliases are removed in 0.3.0 rather than retained until 1.0.

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
