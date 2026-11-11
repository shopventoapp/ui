# Table reservations

`ReservationForm` creates a public table reservation with contact details, a strict German calendar date, normalized time, runtime party limits, opening hours, exceptions and Turnstile. Import `@shopvento/ui/forms.css` for its responsive layout and theme the `.sv-reservation` scope with `--sv-*` properties.

```tsx
import { ReservationForm } from "@shopvento/ui/forms";
const publicApi = async () => ({ shopvento: true, locationId: 1 });
<ReservationForm siteKey="PUBLIC-TEST-KEY" publicApi={publicApi}
  privacyUrl="/privacy" termsUrl="/terms"
  groupInquiryHref="/groups" phoneHref="tel:+490000000" phoneLabel="Contact us" />;
```

The host proxy must support `GET /api/table-reservations/public/settings?location_id=...` and `POST /api/table-reservations/public`. Supply `publicApi` with a positive installation location ID; runtime settings decide readiness, the public challenge key and party limits. Opening exceptions take precedence over weekly hours, closing time is exclusive, and absent legacy weekly hours remain unrestricted. Invalid dates and times are focused before submission. The server remains authoritative for capacity and booking status.

Timed private-event exceptions add local datetime `closed_from` / `closed_until`
bounds to the existing `from` / `until` date envelope. The form displays their
labels and blocked times, keeps the date selectable, and rejects only arrivals
inside each half-open closure. Setup/teardown across midnight is clipped to each
local date. Regular opening hours and manual opening overrides continue to apply;
the backend checks the complete reservation duration and remains authoritative.
Only `closed_from` identifies a timed closure. Ordinary `opens` / `closes` exceptions retain their
existing meaning as replacement opening hours; entries without times close
the opening days in the date range. Older clients may conservatively show timed entries as
all-day closures until their host upgrades this package.

`publicApi` can return `shopvento: false` only for a host retaining the older `/api/reservation` transport. This is a compatibility bridge; no Worker is shipped. Optional account contact prefill can be disabled with `accountEnabled={false}`. A `renderGuestAccountHint` slot keeps account invitations host-owned. `NewsletterComponent` shares the host newsletter configuration when a reservation includes a separate opt-in.

The default script loader is framework-neutral and renders no markup. `ScriptComponent` can use the host's script manager instead. Never pass a private Turnstile secret. `labels` overrides German text using `defaultReservationLabels` keys; `privacyUrl`, `termsUrl`, `groupInquiryHref` and telephone props remain host-owned. The generic defaults contain no customer address, telephone number or email address.

## Split and overnight opening hours

From 0.7.0 the form prefers the public settings field `opening_intervals`, an array
of `{ weekday, opens, closes }` entries (Monday is zero). Several entries may share
a weekday. If the field is absent, `opening_hours` retains its previous behavior;
present `null` means unrestricted weekly hours and `[]` means no weekly openings.
Exceptions still apply to unrestricted schedules.

Every split-day interval appears in the date hint and invalid-time message.
Opening is inclusive and closing is exclusive. A Friday `18:00` to `02:00`
interval allows Friday 23:59 and Saturday 00:00 through 01:59. Guests select
Saturday for a 00:30 reservation and the form submits Saturday as `date`.
The Friday hint shows the real `02:00` closing on the next day and asks guests
to select the next date for after-midnight arrivals; the Saturday hint includes `00:00` to `02:00`
as well as Saturday's own hours. A `00:00` closing is described as midnight and adds no next-day window.
A genuine same-day `23:59` closing remains exclusive.

Manual exceptions replace the intervals of their opening day before overnight
hours are carried forward. Closing Friday removes its Saturday carry; closing
Saturday does not remove Friday's carried hours. Timed closures still block their
actual calendar-date times, including carried hours. For schedules using `opening_intervals`, the skipped spring-forward and repeated
fall-back Berlin hour (02:00 to 02:59) is removed from offered calendar-date
windows and refused before submission. The hints list the remaining windows.
Unrestricted and legacy schedules retain their previous behavior; the backend
remains authoritative for DST, capacity and reservation duration.

Single-window hints keep their existing translation keys. Complete reservation
catalogues must additionally supply `ab {0} Uhr bis vor {1} Uhr`, ` und `,
`Reservierungen {0}.`, `Bitte wähle eine Uhrzeit {0}.`, ` oder `,
`ab {0} Uhr bis vor {1} Uhr am Folgetag`, `ab {0} Uhr bis Mitternacht`, and
`Für Zeiten nach Mitternacht wähle bitte den Folgetag.`; partial overrides
remain compatible. German and English defaults are included.
