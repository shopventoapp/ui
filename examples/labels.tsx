"use client";
import { type BookingLabels, EventBooking } from "@shopvento/ui";

const labels = {
  eventsLoading: "Tastings werden geladen…",
  eventUnavailable: "Dieses Tasting ist gerade nicht buchbar.",
  guestDisabled: "Bitte melde Dich für die Tasting-Buchung an.",
  eventVoucherRequired:
    "Bitte gib für jeden Platz einen Tasting-Gutschein ein.",
  eventVoucherMissing: (count: number) =>
    `${count} ${count === 1 ? "Platz braucht" : "Plätze brauchen"} noch einen Tasting-Gutschein.`,
  eventVoucherDescription: "Tasting-Gutschein für 1 Person, deckt 1 Platz",
  eventVoucherNotice:
    "Jeder Platz braucht einen Tasting-Gutschein und ein Konto.",
  eventDetails: "Mehr zum Tasting",
} satisfies Partial<BookingLabels>;

export function BrandedBookingExample() {
  return (
    <EventBooking
      baseUrl="https://your-installation.shopvento.app"
      eventId={123}
      termsUrl="/terms"
      privacyUrl="/privacy"
      turnstileSiteKey="YOUR_PUBLIC_TURNSTILE_SITE_KEY"
      labels={labels}
    />
  );
}
