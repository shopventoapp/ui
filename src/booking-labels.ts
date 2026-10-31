import { getMessages, type LocaleOptions } from "./locale";
/** Override event-specific German copy with the host's own terminology. */
export interface BookingLabels {
  /** Events loading in the booking labels contract. */
  eventsLoading: string;
  /** Event unavailable in the booking labels contract. */
  eventUnavailable: string;
  /** Guest disabled in the booking labels contract. */
  guestDisabled: string;
  /** Event voucher required in the booking labels contract. */
  eventVoucherRequired: string;
  /** Event voucher missing in the booking labels contract. */
  eventVoucherMissing: (count: number) => string;
  /** Event voucher description in the booking labels contract. */
  eventVoucherDescription: string;
  /** Event voucher notice in the booking labels contract. */
  eventVoucherNotice: string;
  /** Event details in the booking labels contract. */
  eventDetails: string;
}
/** Complete German booking copy defaults. Pass a partial labels object to replace individual event messages. */
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

/** Undefined overrides retain the default, including function-valued labels. */
export function mergeBookingLabels(
  labels?: Partial<BookingLabels>,
  options: LocaleOptions = {},
): BookingLabels {
  const text = getMessages("booking", options);
  const localized =
    options.locale === undefined && options.messages === undefined
      ? defaultBookingLabels
      : (Object.fromEntries(
          Object.entries(defaultBookingLabels).map(([key, value]) => [
            key,
            typeof value === "string"
              ? text(value)
              : (count: number) =>
                  text(
                    "{0} {1} noch einen Veranstaltungsgutschein.",
                    count,
                    text(count === 1 ? "Platz braucht" : "Plätze brauchen"),
                  ),
          ]),
        ) as unknown as BookingLabels);
  return {
    ...localized,
    ...Object.fromEntries(
      Object.entries(labels ?? {}).filter(([, value]) => value !== undefined),
    ),
  };
}
