# Event booking

Use `EventBooking` for the compact date, seat, voucher and contact form. Provide an event ID, optional location ID, legal URLs and the public guest challenge key. [Getting started](/guides/getting-started/) contains a complete example.

## Availability and modes

The client loads event variants, timewindows, locations and installation settings. Submit the selected `timewindow_id`; a materialized row's numeric `id` is not the booking identifier. Prices are integer euro cents. Variants use UUID identifiers.

The compact form excludes past starts, full windows, expired `booking_deadline` values and starts less than 24 Berlin wall-clock hours away. Exactly 24 hours is eligible. The backend must recheck capacity and deadlines at submission.

Guest mode is the compact form default. Both guest and direct booking flags must be enabled. Account mode requires host authentication through `getAccessToken` or cookie credentials; when direct booking is off, every seat needs an event voucher. Account sign-in itself uses the separate same-origin account client.

The compact guest form supports one to eight seats. The multi-step flow uses the runtime guest seat limit and lead time from settings. Do not derive capacity or a final charge from client state.

## Calendar and multi-step flow

Create one stable `createBookingClient`, then use `useCalendar({ client, locationId, from, to })` to load calendar data. `DateList`, `MonthCalendar` and `DateSheet` expose selection callbacks. `BookingFlow` takes fresh calendar data, a host-owned step, navigation callbacks, session profile and legal copy. Wrap these components in `.sv-redesign` and set theme tokens on that element.

`bookingDraftKey` scopes multi-step storage by installation and location. `startFlowDraft` sets the selected timewindow and seats. Pass `onReloadAvailability` to refresh after a 400/409 seat conflict. The [generated reference](/reference/functions/BookingFlow.html) documents each host prop.

Both flows keep drafts in tab-scoped sessionStorage. Names, email and voucher codes can be stored in plain text. Phone, consent and challenge tokens are excluded. The compact form clears its draft after accepted submission, including before a payment redirect. The multi-step flow retains its draft through cancellation and expires it after 24 hours.

## Submission and redirects

Guest submissions include contact, seats, `turnstile_token` and the current `terms_privacy_accepted` checkbox value. Do not precheck consent. An optional phone must include an international prefix. Field-level backend validation appears alongside the contact field and in the error summary.

When using `useSubmitBooking` directly, guest submission is `submit(draft, true, token, consent)`. Consent defaults to false. Account submission is `submit(draft, false, "")`.

The compact form permits HTTPS checkout redirects to `checkout.stripe.com` by default. `checkoutHosts` can add a configured custom checkout hostname. A rejected redirect or failed navigation after an accepted order displays its reference and blocks duplicate submission. Fully voucher-funded orders can complete without a checkout URL.

## Payment return

`examples/booking-return.tsx` reads the browser URL after mount:

<!-- example:examples/booking-return.tsx -->

For cancellation, use `BookingResult` with `outcome="cancel"` and a host retry URL. A return URL is not proof of payment. The backend sends authoritative confirmation. Backend configuration owns the success and cancel destinations.

`BookingOutcome` is the multi-step result surface. It requires a matching validated local reference, clears the active draft on success and can produce a local Europe/Berlin calendar file.
