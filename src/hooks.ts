"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type BookingClient,
  type BookingResponse,
  bookingErrorMessage,
  bookingFieldErrors,
  type GuestContact,
  type GuestFieldErrors,
  type Location,
  type Seat,
  type ShopEvent,
  type ShopSettings,
  type Timewindow,
  windowStarted,
} from "./client";

export function useBookingData(
  client: BookingClient,
  eventId: number,
  locationId?: number,
) {
  const [data, setData] = useState<{
    variants: ShopEvent[];
    windows: Timewindow[];
    settings: ShopSettings;
    locations: Location[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Revision explicitly triggers a retry.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    Promise.all([
      client.getEvent(eventId, controller.signal),
      client.listTimewindows(eventId, controller.signal, locationId),
      client.getSettings(controller.signal),
      client.listLocations(controller.signal),
    ])
      .then(([variants, windows, settings, locations]) => {
        if (!controller.signal.aborted)
          setData({
            variants,
            windows: windows.timewindows.filter(
              (w) =>
                !windowStarted(w) &&
                (locationId === undefined ||
                  w.franchise_location_id === locationId),
            ),
            settings,
            locations: locations.locations,
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(bookingErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [client, eventId, locationId, revision]);
  return { data, loading, error, reload: () => setRevision((r) => r + 1) };
}
export interface BookingDraft {
  timewindow_id: string;
  seats: Seat[];
  contact: GuestContact;
  notes?: string;
}
const emptyDraft = (): BookingDraft => ({
  timewindow_id: "",
  seats: [{}],
  contact: { first_name: "", last_name: "", email: "" },
});
function validDraft(value: unknown): value is BookingDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as BookingDraft;
  return (
    typeof d.timewindow_id === "string" &&
    Array.isArray(d.seats) &&
    d.seats.length > 0 &&
    d.seats.length <= 1000 &&
    d.seats.every(
      (s) =>
        s &&
        typeof s === "object" &&
        (s.variant_id === undefined || typeof s.variant_id === "string") &&
        (s.voucher_code === undefined || typeof s.voucher_code === "string"),
    ) &&
    !!d.contact &&
    ["first_name", "last_name", "email"].every(
      (k) => typeof d.contact[k as keyof GuestContact] === "string",
    ) &&
    (d.contact.phone === undefined || typeof d.contact.phone === "string")
  );
}
/** Key must include installation and event to avoid cross-installation drafts. */
export function useBookingDraft(key: string) {
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    let restored = emptyDraft();
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (validDraft(value)) restored = value;
    } catch {
      /* Storage can be unavailable. */
    }
    setDraft(restored);
    setLoadedKey(key);
  }, [key]);
  useEffect(() => {
    if (loadedKey === key) {
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({
            ...draft,
            contact: { ...draft.contact, phone: undefined },
          }),
        );
      } catch {
        /* In-memory booking still works. */
      }
    }
  }, [draft, key, loadedKey]);
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Storage can be unavailable. */
    }
    setDraft(emptyDraft());
  }, [key]);
  return { draft, setDraft, ready: loadedKey === key, clear };
}
export function useSubmitBooking(
  client: BookingClient,
  redirect: (url: string) => void,
  checkoutHosts: readonly string[] = ["checkout.stripe.com"],
  onAccepted?: (response: BookingResponse) => void,
  onFailure?: (error: unknown) => void,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResponse | null>(null);
  const [fieldErrors, setFieldErrors] = useState<GuestFieldErrors>({});
  const busy = useRef(false);
  async function submit(
    draft: BookingDraft,
    guest: boolean,
    token: string,
    consent = false,
  ) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const request = {
        timewindow_id: draft.timewindow_id,
        ...(draft.notes?.trim() ? { notes: draft.notes.trim() } : {}),
        seats: draft.seats.map((s) => ({
          ...(s.variant_id ? { variant_id: s.variant_id } : {}),
          ...(s.voucher_code?.trim()
            ? { voucher_code: s.voucher_code.trim() }
            : {}),
        })),
      };
      const response = guest
        ? await client.submitGuest({
            ...request,
            ...draft.contact,
            turnstile_token: token,
            terms_privacy_accepted: consent,
          })
        : await client.submit(request);
      try {
        if (!response.success) throw new Error("Booking failed");
        if (response.checkout_url) {
          const url = new URL(response.checkout_url);
          if (
            url.protocol !== "https:" ||
            !checkoutHosts.includes(url.hostname) ||
            url.username ||
            url.password
          )
            throw new Error("Invalid checkout URL");
          onAccepted?.(response);
          redirect(url.href);
        } else {
          onAccepted?.(response);
        }
      } catch {
        // The backend may already have created an order. Block duplicate submission.
        setResult({ ...response, checkout_url: null });
        setError(
          response.success
            ? `Deine Buchung ${response.order_number} wurde übermittelt, aber der Abschluss konnte nicht bestätigt werden. Bitte kontaktiere uns mit dieser Buchungsnummer, bevor Du erneut buchst.`
            : `Deine Buchung konnte nicht abgeschlossen werden. Bitte kontaktiere uns mit der Buchungsnummer ${response.order_number}, bevor Du erneut buchst.`,
        );
        return;
      }
      setResult(response);
      return response;
    } catch (error) {
      onFailure?.(error);
      setFieldErrors(bookingFieldErrors(error));
      setError(bookingErrorMessage(error));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const clearError = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);
  return { submit, pending, error, fieldErrors, result, clearError };
}

/** Independent public list hook for host-owned event navigation. */
export function useEvents(client: BookingClient) {
  const [events, setEvents] = useState<ShopEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    client
      .listEvents(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setEvents(rows);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(bookingErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [client]);
  return {
    events,
    /** @deprecated Use events. Removed in 1.0. */
    tastings: events,
    loading,
    error,
  };
}

/** @deprecated Use useEvents. Removed in 1.0. */
export const useTastings = useEvents;
