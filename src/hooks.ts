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

/** Load event variants, windows, settings and locations; abort obsolete requests and expose reload state.
 * @param client - Stable client instance used for API requests.
 * @param eventId - Public event identifier used to select variants and availability.
 * @param locationId - Positive installation location identifier used to filter availability. */
export function useBookingData(
  client: BookingClient,
  eventId: number,
  locationId?: number,
) {
  const [data, setData] = useState<{
    /** Public event variants and integer-cent prices. */
    variants: ShopEvent[];

    /** Loaded dated event availability. */
    windows: Timewindow[];

    /** Authoritative installation booking settings. */
    settings: ShopSettings;

    /** Public installation locations. */
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

            /** Loaded dated event availability. */
            windows: windows.timewindows.filter(
              (w) =>
                !windowStarted(w) &&
                (locationId === undefined ||
                  w.franchise_location_id === locationId),
            ),
            settings,

            /** Public installation locations. */
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
  return {
    /** Loaded authoritative data, or null while unavailable. */
    data,
    /** Whether the read is pending. */
    loading,
    /** Customer-visible error, or null. */
    error,
    /** Reload the resource from its authoritative API. */
    reload: () => setRevision((r) => r + 1),
  };
}
/** Compact form draft containing the selected window, seats and guest contact. */
export interface BookingDraft {
  /** Backend timewindow identifier used for submission. */
  timewindow_id: string;
  /** Booked places, or requested seat count depending on the signature. */
  seats: Seat[];
  /** Guest contact fields. */
  contact: GuestContact;
  /** Optional booking notes, subject to the component and backend limits. Optional; omitted unless supplied by the host or backend. */
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
  return {
    /** Current in-memory booking draft. */
    draft,
    /** Update the in-memory and persisted draft. */
    setDraft,
    /** Whether the draft has been restored for this key. */
    ready: loadedKey === key,
    /** Remove the stored draft and reset in-memory state. */
    clear,
  };
}
/** Submit the booking once, expose field errors, validate checkout hosts and handle accepted orders safely.
 * @param client - Stable client instance used for API requests.
 * @param redirect - Redirect supplied by the host.
 * @param checkoutHosts - Allowed HTTPS checkout hostnames. Defaults to checkout.stripe.com. Defaults to ["checkout.stripe.com"].
 * @param onAccepted - On accepted supplied by the host.
 * @param onFailure - On failure supplied by the host. */
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
  return {
    /** Submit an authenticated booking request. In useSubmitBooking, pass guest, challenge token and consent explicitly for guest submissions; consent defaults to false. */
    submit,
    /** Whether booking submission is in progress. */
    pending,
    /** Customer-visible error, or null. */
    error,
    /** Validation errors keyed by contact field. */
    fieldErrors,
    /** Accepted booking response, when available. */
    result,
    /** Clear the visible booking error and field errors. */
    clearError,
  };
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
    /** Loaded public event variants. */
    events,
    /** @deprecated Use events. Removed in 1.0. */
    tastings: events,
    /** Whether the read is pending. */
    loading,
    /** Customer-visible error, or null. */
    error,
  };
}

/** @deprecated Use useEvents. Removed in 1.0. */
export const useTastings = useEvents;
