import { expect, test } from "bun:test";
import * as booking from "../src/booking-entry";

test("guest entry has no account or commerce surface", () => {
  expect(Object.keys(booking).sort()).toEqual(
    [
      "DateList",
      "EventBooking",
      "ReservationForm",
      "ShopventoProvider",
      "Turnstile",
      "createBookingClient",
    ].sort(),
  );
});
