# Labels and copy overrides

The components display German by default. Booking accepts a partial `BookingLabels` object. Missing keys keep `defaultBookingLabels`, including function-valued labels. Hosts can keep the word "Tasting" while using the generic event API names.

<!-- example:examples/labels.tsx -->

## Booking labels

| Key | Default | Purpose |
| --- | --- | --- |
| `eventsLoading` | Veranstaltungen werden geladen… | Loading event variants |
| `eventUnavailable` | Diese Veranstaltung ist nicht verfügbar. | Unavailable event |
| `guestDisabled` | Onlinebuchungen ohne Anmeldung sind derzeit nicht verfügbar. Bitte kontaktiere uns, um diese Veranstaltung zu buchen. | Guest mode disabled |
| `eventVoucherRequired` | Bitte gib für jeden Platz einen gültigen Veranstaltungsgutschein ein. | Every seat needs a voucher |
| `eventVoucherMissing(count)` | 1 Platz braucht / n Plätze brauchen noch einen Veranstaltungsgutschein. | Missing voucher count |
| `eventVoucherDescription` | Veranstaltungsgutschein für 1 Person, deckt 1 Platz | Voucher explanation |
| `eventVoucherNotice` | Jeder Platz braucht einen Veranstaltungsgutschein. Dafür meldest Du Dich mit Deinem Konto an. Ältere Codes prüfen wir verbindlich beim Buchen. | Voucher-only mode |
| `eventDetails` | Mehr zur Veranstaltung | Details link |

`EventBooking`, `BookingFlow`, `DateSheet` and `BookingModeNotice` accept these labels. `guestDisabledMessage` takes precedence over `labels.guestDisabled` in the compact form. Other fixed form and status texts remain German in this release; there is no complete locale dictionary for every component string.

## Account and shop copy

Dashboard components require host-owned `AccountLabels`, `AccountRoutes` and `AccountHelp`. Use `labels.events` for the plural event noun, `eventVoucher` for plural vouchers and `eventVoucherSingular` for a singular event voucher. The optional singular fallback is `Gutschein`. Labels are domain nouns and hints; built-in authentication/validation copy still uses German.

Shop primitives receive their labels directly: search text, add/close actions, quantity labels, total label, tax/shipping copy and declarations. `ShopSummary.isFrom` currently uses the fixed German prefix `ab`. Hosts format prices through `formatPrice`.

## Migration from 0.1

Deprecated aliases remain until 1.0: `TastingBooking` / `TastingBookingProps` become `EventBooking` / `EventBookingProps`; `Tasting` becomes `ShopEvent`; `useTastings` becomes `useEvents`; `AccountTastingDetail` becomes `AccountEventDetail`; `TastingColors` / `tastingStyle` become `EventColors` / `eventStyle`. Replace the old event identifier and collection prop spellings with `eventId` and `events`, client list/detail calls with `listEvents` / `getEvent`, and `--sv-tasting`, `k-tasting` and `t-tasting` with `--sv-event`, `k-event` and `t-event`. New props win when both spellings are supplied. Backend paths and wire field names are unchanged. The generated reference marks aliases as deprecated.
