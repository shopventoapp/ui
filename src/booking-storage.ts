import type { Location, Timewindow } from "./client";
export type ResultWindow = Pick<
  Timewindow,
  "timewindow_id" | "date" | "start_time" | "end_time"
>;
export type ResultLocation = Pick<
  Location,
  "location_name" | "location_street"
>;
export interface ResultSnapshot {
  window: ResultWindow;
  title: string;
  location?: ResultLocation;
  order_number: string;
  seatCount: number;
  guestEmail?: string;
  updated: number;
}
export function validBookingReference(
  reference?: string | null,
): reference is string {
  return (
    typeof reference === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(reference)
  );
}
export function readBookingResult(
  key: string,
  reference?: string | null,
): ResultSnapshot | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(`${key}:result`) ?? "null");
    if (s && Number.isFinite(s.updated) && Date.now() - s.updated >= 86400000) {
      sessionStorage.removeItem(`${key}:result`);
      return null;
    }
    if (
      !s ||
      !validBookingReference(reference) ||
      s.order_number !== reference ||
      typeof s.title !== "string" ||
      s.title.length > 500 ||
      !Number.isInteger(s.seatCount) ||
      s.seatCount < 1 ||
      s.seatCount > 1000 ||
      !Number.isFinite(s.updated) ||
      s.updated > Date.now() ||
      Date.now() - s.updated >= 86400000 ||
      !s.window ||
      typeof s.window.timewindow_id !== "string" ||
      typeof s.window.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(s.window.date) ||
      !Number.isFinite(Date.parse(`${s.window.date}T12:00:00Z`)) ||
      typeof s.window.start_time !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s.window.start_time) ||
      (s.window.end_time != null &&
        (typeof s.window.end_time !== "string" ||
          !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s.window.end_time))) ||
      (s.location != null &&
        (typeof s.location.location_name !== "string" ||
          (s.location.location_street != null &&
            typeof s.location.location_street !== "string")))
    )
      return null;
    return {
      window: {
        timewindow_id: s.window.timewindow_id,
        date: s.window.date,
        start_time: s.window.start_time,
        end_time: s.window.end_time,
      },
      title: s.title,
      location: s.location
        ? {
            location_name: s.location.location_name,
            location_street: s.location.location_street,
          }
        : undefined,
      order_number: reference,
      guestEmail:
        typeof s.guestEmail === "string" && s.guestEmail.length <= 254
          ? s.guestEmail
          : undefined,
      seatCount: s.seatCount,
      updated: s.updated,
    };
  } catch {
    return null;
  }
}
export function writeBookingResult(key: string, snapshot: ResultSnapshot) {
  try {
    sessionStorage.setItem(
      `${key}:result`,
      JSON.stringify({
        window: {
          timewindow_id: snapshot.window.timewindow_id,
          date: snapshot.window.date,
          start_time: snapshot.window.start_time,
          end_time: snapshot.window.end_time,
        },
        title: snapshot.title,
        location: snapshot.location
          ? {
              location_name: snapshot.location.location_name,
              location_street: snapshot.location.location_street,
            }
          : undefined,
        order_number: snapshot.order_number,
        guestEmail: snapshot.guestEmail,
        seatCount: snapshot.seatCount,
        updated: snapshot.updated,
      }),
    );
  } catch {
    /* The return page also works without storage. */
  }
}
