"use client";
import { EventBooking, type PaymentStatusInput } from "@shopvento/ui";

export function EventBookingExample({
  paymentStatus,
}: {
  paymentStatus?: PaymentStatusInput;
} = {}) {
  return (
    <EventBooking
      paymentStatus={paymentStatus}
      baseUrl="https://your-installation.shopvento.app"
      eventId={123}
      locationId={1}
      turnstileSiteKey="YOUR_PUBLIC_TURNSTILE_SITE_KEY"
      termsUrl="/terms"
      privacyUrl="/privacy"
    />
  );
}
