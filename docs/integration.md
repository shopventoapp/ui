# Integration guide

Detailed behaviour of the `@shopvento/ui` components and the backend contract they rely on. Start with the [README](../README.md) for installation and a minimal example.

## Booking (`EventBooking`)

Pass the event identifier as `eventId`. `ShopEvent` describes an event variant;
its backend field names remain unchanged.

`baseUrl` is the backend origin, without `/api/shop`. The backend must permit the storefront origin via CORS. Public requests default to `credentials: 'omit'`. `mode="account"` requires the host to supply `getAccessToken` or configure cookie authentication via `credentials="include"`; token callbacks may return a token synchronously or asynchronously. Changes to `fetch` and `getAccessToken` callback identity do not reload the form. Account creation and sign-in components use the separate same-origin account client described below. Guest booking requires both `guest_booking_enabled=true` and `direct_booking_enabled=true`, even when all seats have vouchers. The form and Turnstile widget are hidden when either flag is false. In account mode, `direct_booking_enabled=false` requires a voucher for every seat.

`locationId` filters timewindow requests with `location_id`; pass the installation's location ID. Slot options and the summary show location names fetched from `/api/shop/tastings/locations`. `guestDisabledMessage` optionally overrides the installation-neutral notice when guest booking is disabled. The submit button says "Zahlungspflichtig buchen" because voucher balances are not publicly available and even a code on every seat may leave a payable balance.

Guest submission sends flat contact fields, `timewindow_id`, `seats`, `turnstile_token` and `terms_privacy_accepted` from the current consent checkbox. Guests can book one to eight seats. Optional phone numbers require an international prefix (for example +49 151 23456789). German backend 422 messages appear alongside the matching contact field when identifiable and in the focused error summary.

`turnstileSiteKey` is public and required for guest submission. The package loads Cloudflare's explicit-render script only for an enabled guest form, invalidates expired tokens and interactive challenge timeouts, removes widgets on unmount, and remounts after submission errors. The backend must validate the token. See [Cloudflare's client rendering contract](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/). Configure CSP and allowed hostnames in the consumer. Names, email addresses and voucher codes (which carry monetary value) live in plain tab-scoped sessionStorage with the draft. Phone numbers, consent and Turnstile tokens are not persisted. Drafts are scoped by backend, event, optional location and booking mode, and cleared after successful booking submission. Cancelling Stripe Checkout therefore starts a fresh form; preserving a cancelled draft requires a future backend reconciliation contract.

`onRedirect` may override browser navigation for host integration or tests. Checkout redirects accept only HTTPS URLs at `checkout.stripe.com` by default. `checkoutHosts={["checkout.stripe.com", "checkout.example.com"]}` can explicitly allow an installation's custom Stripe domain (hostnames only). A rejected Checkout URL, failed success response or failed navigation shows the backend order number and blocks duplicate submission; the customer should contact the installation before retrying. The default navigates with `window.location.assign`. A fully voucher-funded response without a Checkout URL displays the accepted booking and its order number.

For static success/cancel pages, read the URL in a client effect and pass it to `BookingResult`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { BookingResult } from '@shopvento/ui';
export default function SuccessPage() {
  const [url, setUrl] = useState('');
  useEffect(() => setUrl(window.location.href), []);
  return <BookingResult url={url} outcome="success" />;
}
```

Use `<BookingResult outcome="cancel" retryUrl="/booking" />` for cancellation. The backend redirects to `BOOKING_CANCEL_URL` without query parameters; `url` is optional. If supplied, `order_number` or `session_id` are displayed as an optional reference. A return URL is not proof of payment; the component tells the customer to await backend confirmation. Checkout return destinations are configured by the backend, not by this package.

## Booking exports

`EventBooking`, `BookingResult`, `DateTimePicker`, `SeatSelector`, `GuestFields`, `BookingSummary`; `createBookingClient`, `bookingErrorMessage`, `bookingFieldErrors`, `deadlinePassed`, `windowBookable`, `windowTooSoon`; `useEvents`, `useBookingData`, `useBookingDraft`, `useSubmitBooking`; and their TypeScript contracts. `getEvent` derives detail/variants by filtering the existing public event list, because there is no public detail endpoint.

When using `useSubmitBooking` directly, call `submit(draft, true, turnstileToken, consent)` for guests; the fourth argument is the current consent state and defaults to false. Account submissions keep `submit(draft, false, "")`. The hook exposes `fieldErrors` alongside the error summary.

## Discover bookable events at a location

```ts
import { createBookingClient, windowBookable } from '@shopvento/ui';
const client = createBookingClient({ baseUrl: 'https://YOUR-INSTALLATION.example' });
const controller = new AbortController();
const { timewindows, total } = await client.listLocationTimewindows(3, {
  startDate: '2026-11-01',
  signal: controller.signal,
});
const eventIds = [...new Set(timewindows.filter(slot => windowBookable(slot)).map(slot => slot.tasting_id))];
```

`listLocationTimewindows(locationId, { startDate, signal })` makes one `GET /api/shop/tastings/timewindows?location_id=...&start_date=...` request without `tasting_id`. Location IDs must be positive integers; invalid IDs throw before making a request. Options are optional; `startDate` defaults to today in Europe/Berlin and `signal` supports cancellation. The response preserves the backend's `{ timewindows, total }` envelope across all events; apply `windowBookable` for the local 24-hour and capacity checks. `listTimewindows` remains available for a single event.

## Renamed in 0.2.0

The old names remain deprecated aliases until 1.0. Both prop names work; the new
name takes precedence when both are supplied. Backend paths and wire fields are
unchanged.

| Previous name | New name |
| --- | --- |
| `TastingBooking` | `EventBooking` |
| `TastingBookingProps` | `EventBookingProps` |
| `tastingId` | `eventId` |
| `Tasting` | `ShopEvent` |
| `useTastings` | `useEvents` |
| `tastings` (hook result, calendar data and props) | `events` |
| `client.listTastings`, `client.getTasting` | `client.listEvents`, `client.getEvent` |
| `AccountTastingDetail` | `AccountEventDetail` |
| `TastingColors`, `tastingStyle` | `EventColors`, `eventStyle` |
| `--sv-tasting` | `--sv-event` |
| `k-tasting`, `t-tasting` | `k-event`, `t-event` |

## Event labels

German defaults use "Veranstaltung" and "Veranstaltungsgutschein". Pass partial
`BookingLabels` through `labels` on `EventBooking`, `BookingFlow`, `DateSheet`
and `BookingModeNotice`, following the same host-owned copy pattern as account
`labels.events`. `DateSheet` and `BookingFlow` forward the labels to their mode
notices. `guestDisabledMessage` still takes precedence over `labels.guestDisabled`.

```tsx
<EventBooking
  baseUrl="https://your-instance.example"
  eventId={123}
  termsUrl="/terms"
  privacyUrl="/privacy"
  labels={{
    eventsLoading: 'Veranstaltungen laden…',
    eventUnavailable: 'Dieses Event ist gerade nicht buchbar.',
    guestDisabled: 'Bitte melde Dich für die Buchung an.',
  }}
/>
```

Other keys are `eventDetails`, `eventVoucherNotice`, `eventVoucherRequired`,
`eventVoucherDescription`, and `eventVoucherMissing: (count: number) => string`.
Every event-specific default can be replaced with the host's terminology.
`defaultBookingLabels` exports the complete defaults.

## CSS variables

Set variables on any host ancestor or `.sv-booking`. Defaults are fallback values, so inheritance works. Booking selectors are scoped to `.sv-booking` and account selectors to `.sv-account`; no global reset is shipped.

| Variable | Default |
| --- | --- |
| `--sv-font` | `system-ui, sans-serif` |
| `--sv-background` | `#fff` |
| `--sv-text` | `#241a20` |
| `--sv-primary` | `#752844` |
| `--sv-on-primary` | `#fff` |
| `--sv-border` | `#c9bdc3` |
| `--sv-surface` | `#f7f3f5` |
| `--sv-error` | `#a51d32` |
| `--sv-focus` | `#155fc0` |
| `--sv-radius` | `0.5rem` |
| `--sv-space` | `1rem` |
| `--sv-padding` | `1.25rem` |

```css
/* Example mapping to an existing site theme */
.booking-container {
  --sv-font: var(--serif);
  --sv-background: var(--bg);
  --sv-text: var(--ink);
  --sv-primary: var(--bordeaux);
  --sv-on-primary: var(--bg);
  --sv-border: var(--line);
  --sv-radius: 2px;
}
```

Calendar and list components accept `colors: EventColors`, keyed by event ID;
`eventStyle(color)` supplies `--sv-event`. Set `--sv-event` on a host ancestor to
provide a default color. Account event vouchers and date tiles expose `k-event`
and `t-event`; the previous selectors and tokens remain supported in parallel.

## Backend contract

- Public routes: `GET /api/shop/tastings/`, `GET /api/shop/tastings/timewindows?tasting_id=…`. Always send the timewindow's `timewindow_id` for booking. The row `id` is only a rendering key; materialized rows have a different numeric row ID. Requests include `start_date` equal to today in Europe/Berlin, and optional `location_id`. Past dates and elapsed local starts are excluded.
- Contracts: settings flags at `GET /api/shop/settings`; `POST /api/shop/tastings/bookings` accepts `seats`; response adds `order_number`. Variant IDs are UUID strings. Event prices are integer euro cents.
- `POST /api/shop/tastings/bookings/guest` accepts `first_name`, `last_name`, `email`, optional nullable `phone`, `turnstile_token`, required `terms_privacy_accepted`, `timewindow_id`, and one to eight `seats`. Both feature flags are required.
- Pending: optional `booking_deadline` is an ISO timestamp with UTC offset on each timewindow. When present, the UI disables expired dates and rechecks at submit. The picker also excludes starts less than 24 hours ahead and rechecks at submission, matching the backend's Berlin local datetime subtraction, including daylight saving transitions. Exactly 24 hours ahead is eligible. The backend must enforce the deadline and capacity at submission.
- There is no quote endpoint or voucher balance in the current public contract. Summary shows backend variant prices before voucher allocation; the final payable amount comes from Stripe Checkout. Customer-safe German details are preserved, including counts, voucher codes, 500/503 messages and the slowapi 429 `error` envelope. Its prefix is stripped; recognized German messages preserve the backend wait time, while other rate limits use a German one-minute fallback. German 422 messages are mapped to contact fields where possible, with local German hints for email format and empty names; body-level messages appear in the summary. Contact field errors use `--sv-error` styling and disappear when the customer edits that field; a new rejected submission shows fresh errors. Generic technical and network errors use local messages.
- Validate CORS, Turnstile, return destinations and Stripe behavior in the target installation before rollout.

## Customer account

The account contracts and operation paths are generated from the backend OpenAPI export (see [CONTRIBUTING](../CONTRIBUTING.md)).

```tsx
'use client';
import { createAccountClient, LoginForm, RegisterForm, useAccountSession } from '@shopvento/ui';
// Keep the client identity stable in React (e.g. module scope or useMemo).
const client = createAccountClient({ onUnauthorized: () => { /* host redirects to login */ } });
// Host handles safe post-login navigation; no tokens are stored by this package.
<LoginForm client={client} onSuccess={() => window.location.assign('/konto')} />;
<RegisterForm client={client} termsUrl="/terms" privacyUrl="/privacy" />;
```

The client uses fixed relative `/api/shop/user/*` and `/api/shop/settings` paths, `credentials: 'same-origin'`, `cache: 'no-store'`, and rejects HTTP redirects. The host must provide a same-origin auth proxy with secure HttpOnly cookies and exact Origin checks for mutations. It must remove upstream access tokens from login JSON; `AccountLoginResponse` represents that edge response. There is no bearer-token or external base URL option. `onUnauthorized` handles every account-client 401 except incorrect login credentials, which stay inline. The session hook loads the authoritative profile, provides `profile`, `authenticated`, `loading`, `error`, `reload`, and `logout`, and cancels reads on unmount/client changes. A hint cookie is never authentication.

Public account components: `LoginForm`, `RegisterForm`, `PasswordResetRequest`, `PasswordSetForm`, `EmailVerify`, `EmailChangeConfirm`, and `PasswordChecklist`. Login/register/reset navigation URLs are configurable props. Password setup signs the customer in and links to the configurable `accountUrl` (default `/konto`). Token components receive `token: string | null`; the host must read it once, remove all `token` query parameters with `history.replaceState` preserving router state, and keep it only in component memory. Confirmation requires an explicit button press, so loading or prefetching a page does not consume the token. Reloading the sanitized page requires opening the original link again. Missing/invalid tokens expose recovery navigation and successful mutations show focused status notices.

Registration requires only first name, last name, email, password and confirmation, terms/privacy consent and optional newsletter consent. It does not load age settings or ask for address, phone or birth date. Newsletter starts unticked and keeps the double opt-in notice; the legacy `marketing_consent` request field carries required terms/privacy acceptance only. Generic registration/reset responses do not reveal account existence. Passwords require at least 8 Unicode characters and at most 72 UTF-8 bytes, a Unicode letter and any non-letter (including a space); confirmation must match. Passwords, tokens and registration details are never persisted.

`CountrySelect` consumes `{ value, label }` options from unauthenticated `/api/shop/settings`. Pass `settings.countries` directly to `AccountSettings`; the first option is the installation country and becomes the default for new entries. Known legacy country names resolve to the API option and its German label; unknown stored values remain visible. `CountrySelect.error` renders a linked field error, marks the select invalid. Account settings focus the first invalid field after a rejected save. `BirthDateInput` is the shared numeric text mask (`TT.MM.JJJJ`) with automatic dots and caret movement. `birthDateFromISO` and `birthDateToISO` convert between display and API values. `AccountLabels.birthDateHint` describes the optional birth date, separately from the pickup hand-over notice in `ageHint`. The date format remains visible outside the accessible name. Complete ISO and unpadded German dates convert only on real paste input (`insertFromPaste`); inserting a digit into a complete date overwrites the following digit, and separator deletion also works without a Backspace keydown. Account birth date is optional; supplied dates must be real, nonfuture, from 1900 onward, at most 120 years old and meet the configured minimum age.

`safeAccountReturnPath` accepts normalized relative same-origin destinations and rejects login loops; `accountDocumentReturnPath` accepts only invoice/credit-note UUID paths, including URL-encoded cookie values. Hosts choose an explicit safe return first, then the document cookie, then their account root, and clear the consumed cookie.

Account styling inherits `--sv-*` only. In addition to booking tokens, hosts may set `--sv-font-label`, `--sv-label-size`, `--sv-label-spacing`, `--sv-label-case`, `--sv-text-2`, `--sv-accent-strong`, `--sv-input-border`, `--sv-error-soft`, `--sv-success`, `--sv-success-soft`, and `--sv-radius-lg`. Forms stack on mobile; paired fields use two columns from 640px. Labels, linked field errors, first-invalid-field focus, focused API error summaries and success notices, 44px targets and visible focus rings are included. These components contain no product or brand terms.

## Booking flow and calendar

`useCalendar` joins public formats, dated availability, settings and locations. The
location client accepts `startDate` and `endDate` for bounded month requests.
`MonthCalendar`, `DateList`, `DateSheet`, `AvailabilityBadge` and `SeatStepper`
provide the date selection controls; wrap them in `.sv-redesign` and import
`@shopvento/ui/styles.css`. The host sets `--sv-*` fonts, colors and content.

`BookingFlow` receives fresh `CalendarData`, a host-owned URL step and navigation
callbacks, session profile, legal texts and the installation-specific draft key
from `bookingDraftKey`. `startFlowDraft` starts the selection and retains contact
and notes. Drafts remain in tab-scoped sessionStorage through checkout and cancel
and expire after 24 hours; phone, consent and security tokens are never stored.
`BookingOutcome` requires a matching, validated result reference and clears the active draft and result after rendering success. It provides the
local ticket summary and a client-generated Europe/Berlin calendar file. A Stripe
return alone does not confirm payment; confirmation remains the backend's email.

Voucher lookup uses the existing public `/vouchers/{code}` endpoint. Legacy codes
that return 404 or rate-limited checks (429) stay pending for backend validation.
The booking contract accepts one code per seat. The summary and review deduct
checked event vouchers from their assigned seat first, then apply value voucher
balances across the remaining seats in submit order. They show “Zu zahlen” with
the remaining amount; only pending checks retain “Höchstens zu zahlen” and the
Stripe hint, with known deductions already applied. Codes are rechecked on
restore; depleted and inapplicable vouchers are rejected.
Guest seat limits, online lead time and Turnstile site keys come from settings
with backwards-compatible defaults. The minimum age is displayed only when
provided by the backend and is never hard-coded into these components.

Booking modes use the effective backend flags: absent settings pause online booking;
both flags off keep account booking with a voucher for every seat;
direct off and guest on requires event vouchers and an account; direct on and
guest off requires an account. Pass `onReloadAvailability` to refresh the calendar
after a 400/409 seat conflict and `onSignOut` to expose account sign-out.

The result stores only the date/time window, title, location name/street,
reference, seat count and timestamp. It expires after 24 hours, is saved only
after validating the checkout host, and contains no contact, notes, voucher codes
or checkout URL. Cancel renders the current selection using fresh `data`.

Hosts can pass `countryCodes` to `BookingFlow` (without it, enter an international
number), `format` (`locale`, `currency`) to the flow/date components, and `colors`
keyed by event ID to calendars/lists. `DateTile` and `DateSheet` accept `color`.
Notes are limited to 300 characters in the flow while the public API still accepts
500. The backend OpenAPI caps guest `seats` at 99; runtime `guest_max_seats` can
apply a smaller limit. Public booking requests send `notes`; `booking_note` is
restricted to back office and is deliberately absent from this client's contract.

`EventBooking` provides the compact booking form for existing hosts.

## Account dashboard

The account components consume the additive customer API through `createDashboardClient`. Requests use fixed relative paths, same-origin cookies, no cache and an unauthorized callback. Supply `AccountLabels`, `AccountRoutes`, `AccountHelp`, runtime minimum age, allowed countries and `ReservationRules`; brand/contact/editorial copy stays in the host. Import `@shopvento/ui/styles.css` and set `--sv-*` tokens on the `.sv-account` ancestor.

Set optional `AccountLabels.eventVoucherSingular` for a single event voucher (fallback: “Gutschein”); `eventVoucher` remains the plural label. Reservation updates submit only changed fields so stored legacy counts and free-text times remain editable. `reservationStartInstant` mirrors the backend midnight fallback for stored times outside strict HH:MM (00:00 to 23:59). Unchanged reservation forms disable saving and never send an empty PATCH.

Exports: `AccountLayout`, `AccountOverview`, `AccountBookings`, `AccountEventDetail`, `AccountOrderDetail`, `AccountReservationDetail`, `AccountVouchers`, `AccountVoucherDetail`, `AccountSettings`. The host owns loading detail records, refreshing after mutations, sign-in redirects, logout, public event windows and static detail routing. Filters use `zeit` and `typ` query parameters, while detail links carry opaque IDs.

Newsletter uses the `NewsletterAdapter` (`status`, `subscribe`, `unsubscribe`) interface. Status is `false` (off), `"pending"` (requested but unconfirmed), or `true` (confirmed). `profileNewsletterAdapter` reads the profile timestamps and requests or resends DOI with an explicit profile PUT true. Account settings explain the five-minute resend cooldown, 24-hour expiry and previous-link invalidation. Cancellation and revocation POST to `/api/shop/user/newsletter/unsubscribe` without a body. Unchanged newsletter consent is omitted from personal-data saves. Registration explains the separate newsletter confirmation email when opted in.

QR encoding uses dependency-free `qrcode-generator` 2.0.4 by Kazuhiko Arase, MIT licensed, bundled into the build. SVGs encode the supplied ticket/pickup/voucher code locally, with a four-module quiet zone and the code also rendered as text. No external QR service is used.

Rescheduling reuses `DateTimePicker` and trusts the API cut-off. A booking reported with `has_been_moved: true`, positive `reschedule_count`, or nonempty `moved_at` hides the action; absent fields mean not moved yet. ICS reuses `bookingCalendarFile`, adds a three-hour reminder, and retains Berlin DST rules. Withdrawal eligibility/quantities and article deadlines come from `withdrawal-items`, avoiding a mixed order's voucher deadline being shown as the deadline for all goods.

Unsupported APIs are omitted: payment retry, voucher claiming/gift transfer, guest magic links, data export, voucher expiry, address defaults, newsletter topic switches and full order timelines. The existing public voucher PDF endpoint necessarily includes the code; account page URLs contain only opaque IDs. No customer records are persisted by dashboard components.


## Shop components

`ShopSurface`, `ShopNavigation`, `ShopHero`, `ShopSection`, `ShopProductGrid`, `ShopProductCard`, `ShopMedia`, `ShopPrice`, `ShopQuantity`, `ShopDialog`, `ShopSummary`, `ShopCheckoutSteps`, `ShopDeclarations`, `ShopNotice` and `ShopEmpty` provide controlled, installation-neutral catalogue and checkout primitives. Supply all labels, product copy, prices, legal content and actions as props. Import `@shopvento/ui/styles.css` and supply the existing `--sv-*` tokens. The optional `--sv-product-fill` token controls the illustrated placeholder. Dialogs use native modal focus containment, Escape dismissal and focus restoration.

`createShopClient()` calls the same-origin public catalogue, articles, settings, quote, checkout and payment confirmation APIs with cookie credentials. Amounts are integer cents; quote and checkout totals must come from the server. The client propagates abort signals and throws `ShopApiError` for unsuccessful responses.

`ShopSummary` rows accept optional `isFrom: true` to prefix an address-dependent minimum with `ab`. Public fulfillment options expose `delivery_zones`, `price_is_from`, the configured out-of-area hint, and recurring closures. Send `shipping_postcode` for an exact cart quote; checkout always derives the charged zone from the shipping address.

Shop styles are exported separately: import `@shopvento/ui/shop.css` only in enabled storefronts. The main `@shopvento/ui/styles.css` contains booking and account styles.

`Turnstile` is a shared challenge widget used by booking and shop review. Pass the public site key and an `onToken` callback; never persist its token with checkout drafts.

Catalogue nutrition values retain units in keys: `energy_kj`, `energy_kcal`, `fat_g`, `saturated_fat_g`, `carbohydrates_g`, `sugars_g`, `protein_g`, `salt_g`.

### Account-first entry

`AccountAccess` presents sign-in and registration in a native modal dialog and an optional guest text action below the frame. Supply the same-origin `AccountClient`, a local `returnPath`, `onAuthenticated` (reload the session), and optional `onGuest`. Registration retains the email-verification and separate newsletter double-opt-in notices. The booking flow accepts `accountClient`, `onAuthenticated`, and `accountReturnPath` for the same interaction.

`GoogleSignIn` checks `/api/shop/user/google-auth/status` and stays hidden unless it returns `{ "enabled": true }`. OAuth starts through the current origin's `/api` proxy and returns to a validated local path. The backend must support the storefront OAuth callback before Google credentials are enabled.

Google sign-in uses the official full-colour Google mark and locally bundled Google Sans. The build copies the font to `dist/` alongside the shared CSS; see `THIRD_PARTY_NOTICES.md` for its license.

### Voucher links

Pass the decoded `gutschein` query parameter to `BookingFlow.initialVoucherCode`
to prefill the first booking step. Use `voucherCodeFromQuery` before forwarding
the parameter across date-selection routes; it rejects markup, control characters
and values longer than 100 characters. Prefilling does not redeem or validate
credit: the existing voucher check and booking validation remain authoritative.
