import { getMessages, type LocaleOptions } from "./locale";
import type {
  BookingRequest,
  BookingResponse,
  GuestBookingRequest,
  Location,
  ShopEvent as WireEvent,
  ShopSettings as WireSettings,
  Timewindow as WireTimewindow,
} from "./wire";

export type {
  BookingRequest,
  BookingResponse,
  GuestBookingRequest,
  Location,
  ShopSettings as WireSettings,
} from "./wire";
/** A public event variant using the unchanged backend field names. */
export type ShopEvent = WireEvent;
/** Public installation flags and optional runtime booking limits. */
export type ShopSettings = WireSettings & {
  /** Guest max seats in the shop settings contract. Optional; omitted unless supplied by the host or backend. */
  guest_max_seats?: number;
  /** Online lead hours in the shop settings contract. Optional; omitted unless supplied by the host or backend. */
  online_lead_hours?: number;
};
/** Public voucher lookup result. Pending legacy codes are validated atomically at submission. */
export interface VoucherCheck {
  /** Voucher code assigned to this seat; backend validation is authoritative. */
  voucher_code: string;
  /** Kind in the voucher check contract. Optional; omitted unless supplied by the host or backend. */
  kind?: string;
  /** Legacy codes are validated atomically by the booking endpoint. */
  pending?: boolean;
  /** Available voucher balance in integer cents when publicly returned. Optional; omitted unless supplied by the host or backend. */
  remaining_value?: number;
  /** Current controlled value. Optional; omitted unless supplied by the host or backend. */
  value?: number;
  /** Whether the backend reports this voucher as redeemed. Optional; omitted unless supplied by the host or backend. */
  redeemed?: boolean;
  /** Backend event identifiers where this voucher is accepted. Optional; omitted unless supplied by the host or backend. */
  redeemable_tasting_ids?: number[];
  /** Backend location identifiers where this voucher is accepted. Optional; omitted unless supplied by the host or backend. */
  redeemable_location_ids?: number[];
  /** Redeemable for text in the voucher check contract. Optional; omitted unless supplied by the host or backend. */
  redeemable_for_text?: string;
}
/** Pending backend deadline addition: timestamp must contain an offset. */
export type Timewindow = WireTimewindow & {
  /** Booking deadline in the timewindow contract. Optional; omitted unless supplied by the host or backend. */
  booking_deadline?: string | null;
};
/** Wire contracts verified against tasting.py. Pending additions are explicitly marked. */
export interface Seat {
  /** Voucher code assigned to this seat; backend validation is authoritative. Optional; omitted unless supplied by the host or backend. */
  voucher_code?: string;
  /** UUID of the chosen event variant. Optional; omitted unless supplied by the host or backend. */
  variant_id?: string;
}
/** Contact fields are derived from the generated guest request. */
export type GuestContact = Pick<
  GuestBookingRequest,
  "first_name" | "last_name" | "email" | "phone"
>;
/** Validation messages keyed by the guest contact field. */
export type GuestFieldErrors = Partial<Record<keyof GuestContact, string>>;
const safeGermanDetail = (detail: unknown): detail is string =>
  typeof detail === "string" &&
  /^(Online kannst Du|Direktbuchungen|Dieser Gutschein|Dieser Termin|Diesen Termin|Den Gutscheincode|Der Gutscheincode|Jeder Gutscheincode|Die gewählte Variante|Für diesen Termin|Bitte |Du |Dein[e ]|Diese Buchung|Die Zahlung|Da ist leider|Nur noch|Nicht genügend|Der Termin|Das Tasting|Tasting|Zu viele Anfragen)/u.test(
    detail,
  );
function validationMessages(
  error: unknown,
  options: LocaleOptions = {},
): Array<{
  /** Field in the validation messages contract. Optional; omitted unless supplied by the host or backend. */
  field?: string;
  /** Message in the validation messages contract. */
  message: string;
}> {
  const text = getMessages("booking", options);

  if (
    !(error instanceof BookingApiError) ||
    error.status !== 422 ||
    !Array.isArray(error.detail)
  )
    return [];
  return error.detail.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { loc, msg, type } = item as {
      loc?: unknown;
      msg?: unknown;
      type?: unknown;
    };
    const field = Array.isArray(loc) ? loc.at(-1) : undefined;
    const message =
      typeof msg === "string" ? msg.replace(/^Value error, /u, "") : msg;
    if (
      safeGermanDetail(message) &&
      (!(options.locale ?? "de").startsWith("en") || text(message) !== message)
    )
      return [{ field, message: text(message) }];
    if (field === "email" && type === "value_error")
      return [
        { field, message: text("Bitte gib eine gültige E-Mail-Adresse an.") },
      ];
    if (
      (field === "first_name" || field === "last_name") &&
      type === "string_too_short"
    )
      return [{ field, message: text("Bitte gib Deinen Namen an.") }];
    return [];
  });
}
/** Map supported backend validation failures onto guest contact fields.
 * @param error - Customer-visible error or error presentation flag. */
export function bookingFieldErrors(
  error: unknown,
  options: LocaleOptions = {},
): GuestFieldErrors {
  const errors: GuestFieldErrors = {};
  for (const { field, message } of validationMessages(error, options)) {
    if (
      field === "first_name" ||
      field === "last_name" ||
      field === "email" ||
      field === "phone"
    )
      errors[field] = message;
  }
  return errors;
}
/** An unsuccessful booking API response, retaining its status and parsed detail. */
export class BookingApiError extends Error {
  constructor(
    /** HTTP response status code. */
    public status: number,

    /** Parsed backend error detail, retained for customer-safe error handling. */
    public detail: unknown,
  ) {
    super(typeof detail === "string" ? detail : "Request failed");
  }
}
/** Turn a booking failure into localized customer-safe copy, preserving supported validation messages.
 * @param error - Customer-visible error or error presentation flag. */
export function bookingErrorMessage(
  error: unknown,
  options: LocaleOptions = {},
): string {
  const text = getMessages("booking", options);

  if (!(error instanceof BookingApiError))
    return text("Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.");
  if (
    safeGermanDetail(error.detail) &&
    (!(options.locale ?? "de").startsWith("en") ||
      text(error.detail) !== error.detail)
  )
    return text(error.detail);
  if (error.status === 429)
    return text("Zu viele Anfragen. Bitte versuche es in einer Minute erneut.");
  if (error.status === 422)
    return (
      validationMessages(error, options)
        .map(({ message }) => message)
        .filter(
          (message, index, messages) => messages.indexOf(message) === index,
        )
        .join(" ") || text("Bitte prüfe Deine Eingaben und versuche es erneut.")
    );
  if (error.status === 401 || error.status === 403)
    return text(
      "Die Anmeldung oder Sicherheitsprüfung ist nicht mehr gültig. Bitte lade die Seite neu.",
    );
  return text(
    "Die Buchung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
  );
}
/** Transport and authentication options for direct booking API calls. */
export interface ClientOptions {
  /** Installation origin without /api/shop. Use an empty string for same-origin shop calls. */
  baseUrl: string;
  /** Optional host fetch implementation. Optional; omitted unless supplied by the host or backend. */
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Authenticated consumers can supply a Bearer token without coupling to a router. */
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  /** Cookie policy for direct booking fetches; public calls default to omit. Optional; omitted unless supplied by the host or backend. */
  credentials?: RequestCredentials;
}
/** Create the public booking transport. The base URL is the installation origin; public requests omit cookies by default.
 * @param options - Options supplied by the host. */
export function createBookingClient(options: ClientOptions) {
  const transport = options.fetch ?? globalThis.fetch;
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await options.getAccessToken?.();
    const response = await transport(
      `${options.baseUrl.replace(/\/+$/, "")}/api/shop${path}`,
      {
        ...init,
        credentials: options.credentials ?? "omit",
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        /** Parsed backend error detail, retained for customer-safe error handling. */
        detail?: unknown;
        error?: unknown;
      };
      const raw = body.detail ?? body.error;
      const detail =
        response.status === 429 && typeof raw === "string"
          ? raw.replace(/^Rate limit exceeded: /u, "")
          : raw;
      throw new BookingApiError(response.status, detail);
    }
    return response.json() as Promise<T>;
  }
  const listEvents = (signal?: AbortSignal) =>
    request<ShopEvent[]>("/tastings/", { signal });
  // There is no public detail route. One event can have multiple variant rows.
  const getEvent = async (id: number, signal?: AbortSignal) =>
    (await listEvents(signal)).filter((event) => event.tasting_id === id);
  return {
    /** List public event variants. Optional signal cancels the request. */
    listEvents,
    /** Filter the public list by event identifier; there is no public detail endpoint. */
    getEvent,
    /** List slots for one event. Date defaults to today in Europe/Berlin; optional location filters availability. */
    listTimewindows: (id: number, signal?: AbortSignal, locationId?: number) =>
      request<{
        /** Dated event slots returned by the backend. */
        timewindows: Timewindow[];
        /** Total number of returned records. */
        total: number;
      }>(
        `/tastings/timewindows?tasting_id=${id}&start_date=${berlinToday()}${locationId === undefined ? "" : `&location_id=${locationId}`}`,
        { signal },
      ),
    /** Discover timewindows across all events at one location. */
    listLocationTimewindows: (
      locationId: number,
      {
        startDate = berlinToday(),
        endDate,
        signal,
      }: { startDate?: string; endDate?: string; signal?: AbortSignal } = {},
    ) => {
      if (!Number.isInteger(locationId) || locationId < 1)
        throw new TypeError("Location ID must be a positive integer");
      return request<{
        /** Dated event slots returned by the backend. */
        timewindows: Timewindow[];
        /** Total number of returned records. */
        total: number;
      }>(
        `/tastings/timewindows?${new URLSearchParams({ location_id: String(locationId), start_date: startDate, ...(endDate ? { end_date: endDate } : {}) })}`,
        { signal },
      );
    },
    /** Check a public voucher code; final redemption happens atomically at booking. */
    checkVoucher: (code: string, signal?: AbortSignal) =>
      request<VoucherCheck>(`/vouchers/${encodeURIComponent(code)}`, {
        signal,
      }),
    /** List public event locations. Optional signal cancels the request. */
    listLocations: (signal?: AbortSignal) =>
      request<{
        /** Public installation locations. */
        locations: Location[];
        /** Total number of returned records. */
        total: number;
      }>("/tastings/locations", {
        signal,
      }),
    /** Read public installation settings. Optional signal cancels the request. */
    getSettings: (signal?: AbortSignal) =>
      request<ShopSettings>("/settings", { signal }),
    /** Submit an authenticated booking request. In useSubmitBooking, pass guest, challenge token and consent explicitly for guest submissions; consent defaults to false. */
    submit: (body: BookingRequest) =>
      request<BookingResponse>("/tastings/bookings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    /** Submit guest contact, seats, live challenge token and current consent. */
    submitGuest: (body: GuestBookingRequest) =>
      request<BookingResponse>("/tastings/bookings/guest", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  };
}
/** Public booking client contract used by the storefront clients. */
export type BookingClient = ReturnType<typeof createBookingClient>;
/** Backend timewindow dates and times use Europe/Berlin local time. */
function berlinTimestamp(now: number): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(now));
}
/** Return the calendar date in Europe/Berlin for the supplied instant.
 * @param now - Current instant as milliseconds since the Unix epoch. Defaults to Date.now(). Defaults to Date.now(). */
export function berlinToday(now = Date.now()): string {
  return berlinTimestamp(now).slice(0, 10);
}
/** Check whether the slot has started in Europe/Berlin.
 * @param window - Selected dated timewindow.
 * @param now - Current instant as milliseconds since the Unix epoch. Defaults to Date.now(). Defaults to Date.now(). */
export function windowStarted(window: Timewindow, now = Date.now()): boolean {
  const start = `${window.date} ${window.start_time.length === 5 ? `${window.start_time}:00` : window.start_time.slice(0, 8)}`;
  return start <= berlinTimestamp(now);
}
/** Match the backend's naive Europe/Berlin datetime subtraction, including DST. */
export function windowTooSoon(
  window: Timewindow,
  now = Date.now(),
  leadHours = 24,
): boolean {
  const start = Date.parse(`${window.date}T${window.start_time}Z`);
  const localNow =
    Date.parse(`${berlinTimestamp(now).replace(" ", "T")}Z`) + (now % 1000);
  return (
    !Number.isFinite(start) || start - localNow < leadHours * 60 * 60 * 1000
  );
}
/** Check the optional backend booking deadline against an instant.
 * @param window - Selected dated timewindow.
 * @param now - Current instant as milliseconds since the Unix epoch. Defaults to Date.now(). Defaults to Date.now(). */
export function deadlinePassed(window: Timewindow, now = Date.now()): boolean {
  return (
    !!window.booking_deadline && Date.parse(window.booking_deadline) <= now
  );
}
/** Check start time, lead time, capacity and deadline for the requested seats.
 * @param window - Selected dated timewindow.
 * @param seats - Booked places, or requested seat count depending on the signature. Defaults to 1.
 * @param now - Current instant as milliseconds since the Unix epoch. Defaults to Date.now(). Defaults to Date.now(). */
export function windowBookable(
  window: Timewindow,
  seats = 1,
  now = Date.now(),
): boolean {
  return (
    !windowTooSoon(window, now) &&
    (window.free_spots ?? 0) >= seats &&
    window.availabilityStatus !== "not_available" &&
    !deadlinePassed(window, now)
  );
}
