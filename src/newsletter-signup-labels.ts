/** German customer-visible defaults. Numbered placeholders preserve interpolation. */
export const defaultNewsletterLabels = Object.freeze({
  /** Sign-up is currently unavailable. Please try again later. */
  "Anmeldung gerade nicht möglich. Bitte später erneut versuchen.":
    "Anmeldung gerade nicht möglich. Bitte später erneut versuchen.",
  /** Please wait five minutes after the last email before requesting another confirmation link. */
  "Bitte warte fünf Minuten nach der letzten E-Mail, bevor Du einen neuen Bestätigungslink anforderst.":
    "Bitte warte fünf Minuten nach der letzten E-Mail, bevor Du einen neuen Bestätigungslink anforderst.",
  /** Please wait for the security check to load. */
  "Bitte warte kurz, bis die Sicherheitsprüfung geladen ist.":
    "Bitte warte kurz, bis die Sicherheitsprüfung geladen ist.",
  /** Connection failed. Please try again later. */
  "Verbindung fehlgeschlagen. Bitte später erneut versuchen.":
    "Verbindung fehlgeschlagen. Bitte später erneut versuchen.",
  /** ◆ Front row */
  "◆ Erste Reihe": "◆ Erste Reihe",
  /** Be the first to hear */
  "Neuigkeiten zuerst erfahren": "Neuigkeiten zuerst erfahren",
  /** Events and */
  "Veranstaltungen und": "Veranstaltungen und",
  /** recommendations. */
  "Empfehlungen.": "Empfehlungen.",
  /** Occasional good things. No spam, just news worth sharing. */
  "Selten, aber gut. Kein Spam, nur, wenn wirklich was anliegt.":
    "Selten, aber gut. Kein Spam, nur, wenn wirklich was anliegt.",
  /** Almost there */
  "Fast geschafft": "Fast geschafft",
  /** ✓ Almost there */
  "✓ Fast geschafft": "✓ Fast geschafft",
  /** Almost there: please confirm your subscription using the link in our email. */
  "Fast geschafft: Bitte bestätige Deine Anmeldung über den Link in unserer E-Mail.":
    "Fast geschafft: Bitte bestätige Deine Anmeldung über den Link in unserer E-Mail.",
  /** If confirmation is required, you will receive an email. Please use its link to confirm your subscription and check your spam folder too. */
  "Wenn eine Bestätigung erforderlich ist, erhältst Du eine E-Mail. Bitte bestätige Deine Anmeldung über den Link darin und prüfe auch Deinen Spam-Ordner.":
    "Wenn eine Bestätigung erforderlich ist, erhältst Du eine E-Mail. Bitte bestätige Deine Anmeldung über den Link darin und prüfe auch Deinen Spam-Ordner.",
  /** First name (optional) */
  "Vorname (optional)": "Vorname (optional)",
  /** First name */
  Vorname: "Vorname",
  /** Sending… */
  "Sende…": "Sende…",
  /** Subscribe to the newsletter */
  "Newsletter abonnieren": "Newsletter abonnieren",
  /** By clicking “Subscribe to the newsletter”, you request a confirmation email from  */
  "Mit Klick auf „Newsletter abonnieren“ forderst Du eine Bestätigungs-E-Mail an ":
    "Mit Klick auf „Newsletter abonnieren“ forderst Du eine Bestätigungs-E-Mail an ",
  /** . You will receive the newsletter after confirming. Unsubscribe at any time in your account or using the link in any email. */
  " an. Erst nach Deiner Bestätigung erhältst Du den Newsletter. Abmeldung jederzeit im Konto oder über den Link in jeder Mail.":
    " an. Erst nach Deiner Bestätigung erhältst Du den Newsletter. Abmeldung jederzeit im Konto oder über den Link in jeder Mail.",
  /** By clicking “Subscribe”, you consent to receive the newsletter. Confirm by email (double opt-in). Unsubscribe at any time using the link in any email. Spam protection by */
  'Mit Klick auf „Abonnieren" willigst du in den Versand ein. Bestätigung per E-Mail (Double-Opt-in). Abmeldung jederzeit über den Link in jeder Mail. Spam-Schutz durch':
    'Mit Klick auf „Abonnieren" willigst du in den Versand ein. Bestätigung per E-Mail (Double-Opt-in). Abmeldung jederzeit über den Link in jeder Mail. Spam-Schutz durch',
  /** Cloudflare Turnstile */
  "Cloudflare Turnstile": "Cloudflare Turnstile",
  /**  (cookie-free). Read our */
  " (cookie-frei). Mehr in der": " (cookie-frei). Mehr in der",
  /** privacy policy */
  Datenschutzerklärung: "Datenschutzerklärung",
  /** Email address */
  "E-Mail-Adresse": "E-Mail-Adresse",
  /** Email */
  "E-Mail": "E-Mail",
  /** Subscribe to the email newsletter */
  "Newsletter per E-Mail abonnieren": "Newsletter per E-Mail abonnieren",
} as const);
/** English messages typed against every German key. */
export const englishNewsletterLabels: {
  [K in keyof typeof defaultNewsletterLabels]: string;
} = Object.freeze({
  /** Sign-up is currently unavailable. Please try again later. */
  "Anmeldung gerade nicht möglich. Bitte später erneut versuchen.":
    "Sign-up is currently unavailable. Please try again later.",
  /** Please wait five minutes after the last email before requesting another confirmation link. */
  "Bitte warte fünf Minuten nach der letzten E-Mail, bevor Du einen neuen Bestätigungslink anforderst.":
    "Please wait five minutes after the last email before requesting another confirmation link.",
  /** Please wait for the security check to load. */
  "Bitte warte kurz, bis die Sicherheitsprüfung geladen ist.":
    "Please wait for the security check to load.",
  /** Connection failed. Please try again later. */
  "Verbindung fehlgeschlagen. Bitte später erneut versuchen.":
    "Connection failed. Please try again later.",
  /** ◆ Front row */
  "◆ Erste Reihe": "◆ Front row",
  /** Be the first to hear */
  "Neuigkeiten zuerst erfahren": "Be the first to hear",
  /** Events and */
  "Veranstaltungen und": "Events and",
  /** recommendations. */
  "Empfehlungen.": "recommendations.",
  /** Occasional good things. No spam, just news worth sharing. */
  "Selten, aber gut. Kein Spam, nur, wenn wirklich was anliegt.":
    "Occasional good things. No spam, just news worth sharing.",
  /** Almost there */
  "Fast geschafft": "Almost there",
  /** ✓ Almost there */
  "✓ Fast geschafft": "✓ Almost there",
  /** Almost there: please confirm your subscription using the link in our email. */
  "Fast geschafft: Bitte bestätige Deine Anmeldung über den Link in unserer E-Mail.":
    "Almost there: please confirm your subscription using the link in our email.",
  /** If confirmation is required, you will receive an email. Please use its link to confirm your subscription and check your spam folder too. */
  "Wenn eine Bestätigung erforderlich ist, erhältst Du eine E-Mail. Bitte bestätige Deine Anmeldung über den Link darin und prüfe auch Deinen Spam-Ordner.":
    "If confirmation is required, you will receive an email. Please use its link to confirm your subscription and check your spam folder too.",
  /** First name (optional) */
  "Vorname (optional)": "First name (optional)",
  /** First name */
  Vorname: "First name",
  /** Sending… */
  "Sende…": "Sending…",
  /** Subscribe to the newsletter */
  "Newsletter abonnieren": "Subscribe to the newsletter",
  /** By clicking “Subscribe to the newsletter”, you request a confirmation email from  */
  "Mit Klick auf „Newsletter abonnieren“ forderst Du eine Bestätigungs-E-Mail an ":
    "By clicking “Subscribe to the newsletter”, you request a confirmation email from ",
  /** . You will receive the newsletter after confirming. Unsubscribe at any time in your account or using the link in any email. */
  " an. Erst nach Deiner Bestätigung erhältst Du den Newsletter. Abmeldung jederzeit im Konto oder über den Link in jeder Mail.":
    ". You will receive the newsletter after confirming. Unsubscribe at any time in your account or using the link in any email.",
  /** By clicking “Subscribe”, you consent to receive the newsletter. Confirm by email (double opt-in). Unsubscribe at any time using the link in any email. Spam protection by */
  'Mit Klick auf „Abonnieren" willigst du in den Versand ein. Bestätigung per E-Mail (Double-Opt-in). Abmeldung jederzeit über den Link in jeder Mail. Spam-Schutz durch':
    "By clicking “Subscribe”, you consent to receive the newsletter. Confirm by email (double opt-in). Unsubscribe at any time using the link in any email. Spam protection by",
  /** Cloudflare Turnstile */
  "Cloudflare Turnstile": "Cloudflare Turnstile",
  /**  (cookie-free). Read our */
  " (cookie-frei). Mehr in der": " (cookie-free). Read our",
  /** privacy policy */
  Datenschutzerklärung: "privacy policy",
  /** Email address */
  "E-Mail-Adresse": "Email address",
  /** Email */
  "E-Mail": "Email",
  /** Subscribe to the email newsletter */
  "Newsletter per E-Mail abonnieren": "Subscribe to the email newsletter",
});
