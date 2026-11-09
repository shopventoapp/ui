/** Shared form messages. German keys define the translation contract. */
export const defaultFormsMessages = Object.freeze({
  /** Wall-clock suffix in German; empty in English. */
  " Uhr": " Uhr",
  /** The security check is unavailable. Please reload the page. */
  "Die Sicherheitsprüfung ist nicht verfügbar. Bitte lade die Seite erneut.":
    "Die Sicherheitsprüfung ist nicht verfügbar. Bitte lade die Seite erneut.",
  /** Please enter a valid date. */
  "Bitte gib ein gültiges Datum ein.": "Bitte gib ein gültiges Datum ein.",
  /** Please enter the date as {0}. */
  "Bitte gib das Datum als {0} ein.": "Bitte gib das Datum als {0} ein.",
} as const);
/** English form validation. */
export const englishFormsMessages: {
  [K in keyof typeof defaultFormsMessages]: string;
} = Object.freeze({
  /** The security check is unavailable. Please reload the page. */
  "Die Sicherheitsprüfung ist nicht verfügbar. Bitte lade die Seite erneut.":
    "The security check is unavailable. Please reload the page.",
  /** Please enter a valid date. */
  /** English wall-clock suffix. */
  " Uhr": "",
  "Bitte gib ein gültiges Datum ein.": "Please enter a valid date.",
  /** Please enter the date as {0}. */
  "Bitte gib das Datum als {0} ein.": "Please enter the date as {0}.",
});
/** Payment actions and method names, independent of checkout presentation. */
export const defaultPaymentMessages = Object.freeze({
  /** Payment capability could not be read; the customer can retry. */
  "Der Zahlungsstatus konnte nicht geladen werden. Bitte versuche es erneut.":
    "Der Zahlungsstatus konnte nicht geladen werden. Bitte versuche es erneut.",
  /** Visible reason for a disabled paid action. */
  "Online-Zahlung ist derzeit nicht verfügbar. Gutscheine kannst Du weiterhin einlösen.":
    "Online-Zahlung ist derzeit nicht verfügbar. Gutscheine kannst Du weiterhin einlösen.",
  /** Neutral payment capability loading notice. */
  "Zahlungsstatus wird geladen…": "Zahlungsstatus wird geladen…",
  /** A voucher lookup failed and can be retried. */
  "Der Gutschein konnte nicht geprüft werden. Bitte versuche es erneut.":
    "Der Gutschein konnte nicht geprüft werden. Bitte versuche es erneut.",
  /** Retry the failed capability or voucher lookup. */
  "Erneut versuchen": "Erneut versuchen",

  /** Voucher not found. */
  "Gutschein nicht gefunden.": "Gutschein nicht gefunden.",
  /** This voucher cannot currently be redeemed. */
  "Dieser Gutschein kann derzeit nicht eingelöst werden.":
    "Dieser Gutschein kann derzeit nicht eingelöst werden.",
  /** Disabled paid action label. */
  "Bald verfügbar": "Bald verfügbar",
  /** Credit card */
  Kreditkarte: "Kreditkarte",
  /** Debit card */
  Debitkarte: "Debitkarte",
} as const);
/** English payment method names. */
export const englishPaymentMessages: {
  [K in keyof typeof defaultPaymentMessages]: string;
} = Object.freeze({
  /** Payment capability could not be read; the customer can retry. */
  "Der Zahlungsstatus konnte nicht geladen werden. Bitte versuche es erneut.":
    "Payment status could not be loaded. Please try again.",
  /** Visible reason for a disabled paid action. */
  "Online-Zahlung ist derzeit nicht verfügbar. Gutscheine kannst Du weiterhin einlösen.":
    "Online payment is currently unavailable. You can still redeem vouchers.",
  /** Neutral payment capability loading notice. */
  "Zahlungsstatus wird geladen…": "Loading payment status…",
  /** A voucher lookup failed and can be retried. */
  "Der Gutschein konnte nicht geprüft werden. Bitte versuche es erneut.":
    "The voucher could not be checked. Please try again.",
  /** Retry the failed capability or voucher lookup. */
  "Erneut versuchen": "Try again",

  /** Voucher not found. */
  "Gutschein nicht gefunden.": "Voucher not found.",
  /** This voucher cannot currently be redeemed. */
  "Dieser Gutschein kann derzeit nicht eingelöst werden.":
    "This voucher cannot currently be redeemed.",
  /** Disabled paid action label, fixed by the payment gate contract. */
  "Bald verfügbar": "Bald verfügbar",
  /** Credit card */
  Kreditkarte: "Credit card" /** Debit card */,
  Debitkarte: "Debit card",
});
/** Voucher descriptions from the public catalogue. */
export const defaultVoucherMessages = Object.freeze({
  /** Multi-purpose voucher, redeemable across the entire range */
  "Mehrzweckgutschein, einlösbar für das komplette Sortiment":
    "Mehrzweckgutschein, einlösbar für das komplette Sortiment",
  /** Single-purpose voucher */
  Einzweckgutschein: "Einzweckgutschein",
  /** Voucher */
  Gutschein: "Gutschein",
} as const);
/** English voucher descriptions. */
export const englishVoucherMessages: {
  [K in keyof typeof defaultVoucherMessages]: string;
} = Object.freeze({
  /** Multi-purpose voucher, redeemable across the entire range */
  "Mehrzweckgutschein, einlösbar für das komplette Sortiment":
    "Multi-purpose voucher, redeemable across the entire range",
  /** Single-purpose voucher */
  Einzweckgutschein: "Single-purpose voucher",
  /** Voucher */
  Gutschein: "Voucher",
});
