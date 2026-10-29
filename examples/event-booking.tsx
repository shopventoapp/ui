"use client";
import { EventBooking } from "@shopvento/ui";

export function EventBookingExample() {
  return (
    <EventBooking
      baseUrl="https://your-installation.shopvento.app"
      eventId={123}
      locationId={1}
      turnstileSiteKey="YOUR_PUBLIC_TURNSTILE_SITE_KEY"
      termsUrl="/terms"
      privacyUrl="/privacy"
    />
  );
}
