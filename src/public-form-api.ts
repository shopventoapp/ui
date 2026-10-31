import {
  dateInputPattern,
  dateInputPlaceholder,
  getMessages,
  type LocaleOptions,
  maskLocaleDate,
  parseLocaleDate,
} from "./locale";
/** Parse a strict local calendar date into ISO, rejecting overflow. */
export function reservationDate(
  value: string,
  locale: string | LocaleOptions = "de",
  overrides?: Partial<Record<string, string>>,
): string {
  const options = typeof locale === "string" ? { locale } : locale;
  const language = options.locale ?? "de";
  try {
    return parseLocaleDate(value, language);
  } catch {
    const text = getMessages("forms", options, overrides);
    throw new Error(
      new RegExp(`^${dateInputPattern(language)}$`).test(value)
        ? text("Bitte gib ein gültiges Datum ein.")
        : text(
            "Bitte gib das Datum als {0} ein.",
            dateInputPlaceholder(language),
          ),
    );
  }
}
/** Mask a locale numeric date, allowing English ISO input. */
export function maskReservationDate(value: string, locale = "de"): string {
  return maskLocaleDate(value, locale);
}

/** Map public API status codes to localized customer-safe reservation errors. */
export function publicApiError(
  status: number,
  locale: string | LocaleOptions = "de",
  overrides?: Partial<Record<string, string>>,
): string {
  const text = getMessages(
    "reservation",
    typeof locale === "string" ? { locale } : locale,
    overrides,
  );
  if (status === 403)
    return text(
      "Die Sicherheitsprüfung ist fehlgeschlagen oder die Online-Buchung ist nicht verfügbar. Bitte versuche es erneut oder rufe uns an.",
    );
  if (status === 409)
    return text(
      "Zu dieser Zeit sind nicht genügend Plätze verfügbar. Bitte wähle einen anderen Termin oder rufe uns an.",
    );
  if (status === 422)
    return text("Bitte prüfe Deine Angaben und die zulässige Personenzahl.");
  if (status === 429)
    return text("Zu viele Versuche. Bitte warte kurz und versuche es erneut.");
  return text(
    "Die Anfrage ist gerade nicht möglich. Bitte versuche es später erneut oder rufe uns an.",
  );
}
