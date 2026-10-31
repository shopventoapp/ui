# Locales, catalogues and copy overrides

German is the default, with its existing wording. English is shipped. Set a language for one visitor, route or component subtree:

```tsx
import { ShopventoProvider } from "@shopvento/ui";

<ShopventoProvider locale="en">
  <YourBookingShopAndAccountRoutes />
</ShopventoProvider>
```

`ShopFlow`, `NewsletterSignup` and `ReservationForm` also accept `locale` and `messages` directly. Locale is a render input, scoped through React context. No process-wide registration or mutable locale exists: concurrent German and English requests remain independent. A nested provider inherits omitted options; changing its locale chooses that language's catalogue.

`germanMessages` defines the typed schema, with separate `shop`, `booking`, `account`, `newsletter`, `reservation`, `forms`, `payment` and `voucher` areas. `englishMessages` implements that schema. A host adds another language without changing components:

```tsx
import { ShopventoProvider, type ShopventoCatalogue } from "@shopvento/ui";

const french = {
  shop: { "Dein Einkauf": "Vos achats" },
} satisfies ShopventoCatalogue;

<ShopventoProvider locale="fr-FR" messages={french}>
  <YourRoutes />
</ShopventoProvider>
```

Every missing key falls back to German for a custom language. Partial host messages overlay a shipped language when its locale is selected. Existing component `labels` override a single key on top. Undefined entries preserve the underlying catalogue. Numbered placeholders such as `{0}` and `{1}` must be retained. Semantic booking/account noun labels keep their existing contract and remain the final terminology layer.

The locale drives `Intl` date, time, money and number formatting. German date inputs keep `TT.MM.JJJJ`; English accepts ISO `YYYY-MM-DD` or the selected numeric order (`MM/DD/YYYY` for `en`/`en-US`, `DD/MM/YYYY` for `en-GB`). Invalid calendar dates are rejected. `localeMoney`, `localeDate`, `localeTime`, `parseLocaleDate`, `dateInputPlaceholder`, `dateInputPattern`, `formatLocaleDateInput` and `maskLocaleDate` are available for host fields. Pure helpers take an explicit locale/options argument; React code can read `useShopventoLocale()` and `useMessages(area, labels)`. `getMessages(area, options, labels)` supplies the same interpolation outside components.

Booking accepts a partial `BookingLabels` object. Missing keys keep the selected language, including function-valued labels. Hosts can keep the word "Tasting" while using the generic event API names.

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

`EventBooking`, `BookingFlow`, `DateSheet` and `BookingModeNotice` accept these labels. `guestDisabledMessage` takes precedence over `labels.guestDisabled` in the compact form. Form, error and status texts follow the provider catalogue.

## Account and shop copy

Dashboard components require `AccountLabels`, host-owned `AccountRoutes` and `AccountHelp`. `mergeAccountLabels(overrides, { locale })` supplies translated default nouns so hosts only write their terminology choices. Use `labels.events` for the plural event noun, `eventVoucher` for plural vouchers and `eventVoucherSingular` for a singular event voucher. The optional singular fallback is `Gutschein`. Labels are domain nouns and hints; built-in authentication and validation copy follow the selected locale.

Shop primitives receive their labels directly: search text, add/close actions, quantity labels, total label, tax/shipping copy and declarations. `ShopSummary.isFrom` uses the selected language's minimum-price prefix. Hosts format prices through `formatPrice`.

## Event API

Use `EventBooking`, `EventBookingProps`, `ShopEvent`, `useEvents`, `AccountEventDetail`, `EventColors` and `eventStyle`. Pass identifiers as `eventId` and collections as `events`. Clients expose `listEvents` and `getEvent`. Theme events through `--sv-event`, `k-event` and `t-event`. Backend paths and JSON field names stay unchanged.

## Complete shop and public forms

`ShopFlow`, `NewsletterSignup` and `ReservationForm` accept a partial message dictionary. Keys are the German defaults in `defaultShopFlowLabels`, `defaultNewsletterLabels` and `defaultReservationLabels`. Missing keys keep their default; messages with runtime values use numbered placeholders such as `{0}` and `{1}`. Keep all placeholders in an override. For example:

```tsx
<ShopFlow labels={{ "Noch nichts im Korb.": "Your cart is empty." }} />
<NewsletterSignup siteKey="PUBLIC-KEY" labels={{ "Newsletter abonnieren": "Subscribe" }} />
```

Product mapping, section copy, imagery, gift delivery notes, payment method names and editorial slots remain host props. The dictionary supplements the existing controlled primitive labels and preserves their override priority.
