# Table reservations

`ReservationForm` creates a public table reservation with contact details, a strict German calendar date, normalized time, runtime party limits, opening hours, exceptions and Turnstile. Import `@shopvento/ui/forms.css` for its responsive layout and theme the `.sv-reservation` scope with `--sv-*` properties.

```tsx
import { ReservationForm } from "@shopvento/ui";
const publicApi = async () => ({ shopvento: true, locationId: 1 });
<ReservationForm siteKey="PUBLIC-TEST-KEY" publicApi={publicApi}
  privacyUrl="/privacy" termsUrl="/terms"
  groupInquiryHref="/groups" phoneHref="tel:+490000000" phoneLabel="Contact us" />;
```

The host proxy must support `GET /api/table-reservations/public/settings?location_id=...` and `POST /api/table-reservations/public`. Supply `publicApi` with a positive installation location ID; runtime settings decide readiness, the public challenge key and party limits. Opening exceptions take precedence over weekly hours, closing time is exclusive, and absent legacy weekly hours remain unrestricted. Invalid dates and times are focused before submission. The server remains authoritative for capacity and booking status.

`publicApi` can return `shopvento: false` only for a host retaining the older `/api/reservation` transport. This is a compatibility bridge; no Worker is shipped. Optional account contact prefill can be disabled with `accountEnabled={false}`. A `renderGuestAccountHint` slot keeps account invitations host-owned. `NewsletterComponent` shares the host newsletter configuration when a reservation includes a separate opt-in.

The default script loader is framework-neutral and renders no markup. `ScriptComponent` can use the host's script manager instead. Never pass a private Turnstile secret. `labels` overrides German text using `defaultReservationLabels` keys; `privacyUrl`, `termsUrl`, `groupInquiryHref` and telephone props remain host-owned. The generic defaults contain no customer address, telephone number or email address.
