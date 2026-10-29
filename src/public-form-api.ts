/** Parse a strict German calendar date into ISO form, rejecting invalid dates and overflow. */
export function reservationDate(value: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) throw new Error("Bitte gib das Datum als TT.MM.JJJJ ein.");
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== iso
  )
    throw new Error("Bitte gib ein gültiges Datum ein.");
  return iso;
}
/** Mask up to eight date digits as DD.MM.YYYY. */
export function maskReservationDate(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{2})(\d)/, "$1.$2");
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
