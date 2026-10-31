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
export const defaultBookingLabels: BookingLabels = Object.freeze({
  eventsLoading: getMessages("booking")("Veranstaltungen werden geladen…"),
  eventUnavailable: getMessages("booking")(
    "Diese Veranstaltung ist nicht verfügbar.",
  ),
  guestDisabled: getMessages("booking")(
    "Onlinebuchungen ohne Anmeldung sind derzeit nicht verfügbar. Bitte kontaktiere uns, um diese Veranstaltung zu buchen.",
  ),
  eventVoucherRequired: getMessages("booking")(
    "Bitte gib für jeden Platz einen gültigen Veranstaltungsgutschein ein.",
  ),
  eventVoucherMissing: (count: number) =>
    getMessages("booking")(
      "{0} {1} noch einen Veranstaltungsgutschein.",
      count,
      getMessages("booking")(count === 1 ? "Platz braucht" : "Plätze brauchen"),
    ),
  eventVoucherDescription: getMessages("booking")(
    "Veranstaltungsgutschein für 1 Person, deckt 1 Platz",
  ),
  eventVoucherNotice: getMessages("booking")(
    "Jeder Platz braucht einen Veranstaltungsgutschein. Dafür meldest Du Dich mit Deinem Konto an. Ältere Codes prüfen wir verbindlich beim Buchen.",
  ),
  eventDetails: getMessages("booking")("Mehr zur Veranstaltung"),
});

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
