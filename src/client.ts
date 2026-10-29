import type {
  BookingRequest,
  BookingResponse,
  GuestBookingRequest,
  Location,
  Tasting as WireEvent,
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
/** @deprecated Use ShopEvent. Removed in 1.0. */
export type Tasting = ShopEvent;
export type ShopSettings = WireSettings & {
  guest_max_seats?: number;
  online_lead_hours?: number;
};
export interface VoucherCheck {
  voucher_code: string;
  kind?: string;
  /** Legacy codes are validated atomically by the booking endpoint. */
  pending?: boolean;
  remaining_value?: number;
  value?: number;
  redeemed?: boolean;
  redeemable_tasting_ids?: number[];
  redeemable_location_ids?: number[];
  redeemable_for_text?: string;
}
/** Pending backend deadline addition: timestamp must contain an offset. */
export type Timewindow = WireTimewindow & { booking_deadline?: string | null };
/** Wire contracts verified against tasting.py. Pending additions are explicitly marked. */
export interface Seat {
  voucher_code?: string;
  variant_id?: string;
}
/** Contact fields are derived from the generated guest request. */
export type GuestContact = Pick<
  GuestBookingRequest,
  "first_name" | "last_name" | "email" | "phone"
>;
export type GuestFieldErrors = Partial<Record<keyof GuestContact, string>>;
const safeGermanDetail = (detail: unknown): detail is string =>
  typeof detail === "string" &&
  /^(Online kannst Du|Direktbuchungen|Dieser Gutschein|Dieser Termin|Diesen Termin|Den Gutscheincode|Der Gutscheincode|Jeder Gutscheincode|Die gewählte Variante|Für diesen Termin|Bitte |Du |Dein[e ]|Diese Buchung|Die Zahlung|Da ist leider|Nur noch|Nicht genügend|Der Termin|Das Tasting|Tasting|Zu viele Anfragen)/u.test(
    detail,
  );
function validationMessages(
  error: unknown,
): Array<{ field?: string; message: string }> {
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
    if (safeGermanDetail(message)) return [{ field, message }];
    if (field === "email" && type === "value_error")
      return [{ field, message: "Bitte gib eine gültige E-Mail-Adresse an." }];
    if (
      (field === "first_name" || field === "last_name") &&
      type === "string_too_short"
    )
      return [{ field, message: "Bitte gib Deinen Namen an." }];
    return [];
  });
}
export function bookingFieldErrors(error: unknown): GuestFieldErrors {
  const errors: GuestFieldErrors = {};
  for (const { field, message } of validationMessages(error)) {
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
export class BookingApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(typeof detail === "string" ? detail : "Request failed");
  }
}
export function bookingErrorMessage(error: unknown): string {
  if (!(error instanceof BookingApiError))
    return "Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.";
  if (safeGermanDetail(error.detail)) return error.detail;
  if (error.status === 429)
    return "Zu viele Anfragen. Bitte versuche es in einer Minute erneut.";
  if (error.status === 422)
    return (
      validationMessages(error)
        .map(({ message }) => message)
        .filter(
          (message, index, messages) => messages.indexOf(message) === index,
        )
        .join(" ") || "Bitte prüfe Deine Eingaben und versuche es erneut."
    );
  if (error.status === 401 || error.status === 403)
    return "Die Anmeldung oder Sicherheitsprüfung ist nicht mehr gültig. Bitte lade die Seite neu.";
  return "Die Buchung konnte nicht abgeschlossen werden. Bitte versuche es erneut.";
}
export interface ClientOptions {
  baseUrl: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Authenticated consumers can supply a Bearer token without coupling to a router. */
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  credentials?: RequestCredentials;
}
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
    listEvents,
    getEvent,
    /** @deprecated Use listEvents. Removed in 1.0. */
    listTastings: listEvents,
    /** @deprecated Use getEvent. Removed in 1.0. */
    getTasting: getEvent,
    listTimewindows: (id: number, signal?: AbortSignal, locationId?: number) =>
      request<{ timewindows: Timewindow[]; total: number }>(
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
      return request<{ timewindows: Timewindow[]; total: number }>(
        `/tastings/timewindows?${new URLSearchParams({ location_id: String(locationId), start_date: startDate, ...(endDate ? { end_date: endDate } : {}) })}`,
        { signal },
      );
    },
    checkVoucher: (code: string, signal?: AbortSignal) =>
      request<VoucherCheck>(`/vouchers/${encodeURIComponent(code)}`, {
        signal,
      }),
    listLocations: (signal?: AbortSignal) =>
      request<{ locations: Location[]; total: number }>("/tastings/locations", {
        signal,
      }),
    getSettings: (signal?: AbortSignal) =>
      request<ShopSettings>("/settings", { signal }),
    submit: (body: BookingRequest) =>
      request<BookingResponse>("/tastings/bookings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    submitGuest: (body: GuestBookingRequest) =>
      request<BookingResponse>("/tastings/bookings/guest", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  };
}
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
export function berlinToday(now = Date.now()): string {
  return berlinTimestamp(now).slice(0, 10);
}
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
export function deadlinePassed(window: Timewindow, now = Date.now()): boolean {
  return (
    !!window.booking_deadline && Date.parse(window.booking_deadline) <= now
  );
}
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
