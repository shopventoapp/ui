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

## Event API

Use `EventBooking`, `EventBookingProps`, `ShopEvent`, `useEvents`, `AccountEventDetail`, `EventColors` and `eventStyle`. Pass identifiers as `eventId` and collections as `events`. Clients expose `listEvents` and `getEvent`. Theme events through `--sv-event`, `k-event` and `t-event`. Backend paths and JSON field names stay unchanged.

## Complete shop and public forms

`ShopFlow`, `NewsletterSignup` and `ReservationForm` accept a partial message dictionary. Keys are the German defaults in `defaultShopFlowLabels`, `defaultNewsletterLabels` and `defaultReservationLabels`. Missing keys keep their default; messages with runtime values use numbered placeholders such as `{0}` and `{1}`. Keep all placeholders in an override. For example:

```tsx
<ShopFlow labels={{ "Noch nichts im Korb.": "Your cart is empty." }} />
<NewsletterSignup siteKey="PUBLIC-KEY" labels={{ "Newsletter abonnieren": "Subscribe" }} />
```

Product mapping, section copy, imagery, gift delivery notes, payment method names and editorial slots remain host props. This dictionary supplements the existing controlled primitive labels; it does not change the 0.2 booking or account label contracts.
