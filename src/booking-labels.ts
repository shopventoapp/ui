/** Override event-specific German copy with the host's own terminology. */
export interface BookingLabels {
  eventsLoading: string;
  eventUnavailable: string;
  guestDisabled: string;
  eventVoucherRequired: string;
  eventVoucherMissing: (count: number) => string;
  eventVoucherDescription: string;
  eventVoucherNotice: string;
  eventDetails: string;
}
export const defaultBookingLabels: BookingLabels = {
  eventsLoading: "Veranstaltungen werden geladen…",
  eventUnavailable: "Diese Veranstaltung ist nicht verfügbar.",
  guestDisabled:
    "Onlinebuchungen ohne Anmeldung sind derzeit nicht verfügbar. Bitte kontaktiere uns, um diese Veranstaltung zu buchen.",
  eventVoucherRequired:
    "Bitte gib für jeden Platz einen gültigen Veranstaltungsgutschein ein.",
  eventVoucherMissing: (count) =>
    `${count} ${count === 1 ? "Platz braucht" : "Plätze brauchen"} noch einen Veranstaltungsgutschein.`,
  eventVoucherDescription:
    "Veranstaltungsgutschein für 1 Person, deckt 1 Platz",
  eventVoucherNotice:
    "Jeder Platz braucht einen Veranstaltungsgutschein. Dafür meldest Du Dich mit Deinem Konto an. Ältere Codes prüfen wir verbindlich beim Buchen.",
  eventDetails: "Mehr zur Veranstaltung",
};
