import { getMessages, maskLocaleDate, parseLocaleDate } from "./locale";
/** Parse a strict local calendar date into ISO, rejecting overflow. */
export function reservationDate(value: string, locale = "de"): string {
  return parseLocaleDate(value, locale);
}
/** Mask a locale numeric date, allowing English ISO input. */
export function maskReservationDate(value: string, locale = "de"): string {
  return maskLocaleDate(value, locale);
}

/** Map public API status codes to localized customer-safe reservation errors. */
export function publicApiError(status: number, locale = "de"): string {
  const text = getMessages("reservation", { locale });
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
