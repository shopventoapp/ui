import { maskLocaleDate, parseLocaleDate } from "./locale";
/** Parse a strict local calendar date into ISO, rejecting overflow. */
export function reservationDate(value: string, locale = "de"): string {
  try {
    return parseLocaleDate(value, locale);
  } catch {
    throw new Error(
      locale.startsWith("de") && !/^\d{2}\.\d{2}\.\d{4}$/.test(value)
        ? "Bitte gib das Datum als TT.MM.JJJJ ein."
        : "Bitte gib ein gültiges Datum ein.",
    );
  }
}
/** Mask a locale numeric date, allowing English ISO input. */
export function maskReservationDate(value: string, locale = "de"): string {
  return maskLocaleDate(value, locale);
}

/** Map public API status codes to customer-safe German reservation errors. */
export function publicApiError(status: number): string {
  if (status === 403)
    return "Die Sicherheitsprüfung ist fehlgeschlagen oder die Online-Buchung ist nicht verfügbar. Bitte versuche es erneut oder rufe uns an.";
  if (status === 409)
    return "Zu dieser Zeit sind nicht genügend Plätze verfügbar. Bitte wähle einen anderen Termin oder rufe uns an.";
  if (status === 422)
    return "Bitte prüfe Deine Angaben und die zulässige Personenzahl.";
  if (status === 429)
    return "Zu viele Versuche. Bitte warte kurz und versuche es erneut.";
  return "Die Anfrage ist gerade nicht möglich. Bitte versuche es später erneut oder rufe uns an.";
}
