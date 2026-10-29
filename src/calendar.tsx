"use client";
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { type BookingLabels, mergeBookingLabels } from "./booking-labels";
import {
  type BookingClient,
  berlinToday,
  bookingErrorMessage,
  deadlinePassed,
  type Location,
  type ShopEvent,
  type ShopSettings,
  type Timewindow,
  windowStarted,
  windowTooSoon,
} from "./client";
/** Formatting options for booking money and dates. */
export interface BookingFormat {
  /** Date/number locale. Defaults to de-DE. Optional; omitted unless supplied by the host or backend. */
  locale?: string;
  /** Currency code. Defaults to EUR. Optional; omitted unless supplied by the host or backend. */
  currency?: string;
}
/** Format an integer-cent amount with the supplied locale and currency. */
export const bookingMoney = (
  cents: number,
  { locale = "de-DE", currency = "EUR" }: BookingFormat = {},
) =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    cents / 100,
  );
/** Format an ISO calendar date in the requested locale. */
export const bookingDate = (date: string, short = false, locale = "de-DE") =>
  new Intl.DateTimeFormat(locale, {
    weekday: short ? "short" : "long",
    day: "numeric",
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" as const }),
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
/** Format the start and end time of a slot. */
export const bookingTime = (w: Pick<Timewindow, "start_time" | "end_time">) =>
  `${w.start_time.slice(0, 5)}${w.end_time ? ` bis ${w.end_time.slice(0, 5)}` : ""} Uhr`;
/** Effective online booking mode derived from the installation flags. */
export type BookingMode = "full" | "account" | "voucher" | "paused";
/** Resolve guest, account-only, voucher-only or paused mode from the installation flags.
 * @param settings - Authoritative public installation flags and booking limits. */
export function bookingMode(settings?: ShopSettings): BookingMode {
  if (!settings) return "paused";
  if (!settings.direct_booking_enabled) return "voucher";
  return settings.guest_booking_enabled ? "full" : "account";
}
/** Explain the effective booking mode with optional contact information and copy overrides. */
export function BookingModeNotice({
  settings,
  phone,
  phoneLabel,
  labels,
}: {
  /** Authoritative public installation flags and booking limits. */
  settings: ShopSettings;
  /** Host contact phone number or customer international phone field. Optional; omitted unless supplied by the host or backend. */
  phone?: string;
  /** Customer-visible phone link label. Optional; omitted unless supplied by the host or backend. */
  phoneLabel?: string;
  /** Host-owned copy overrides or account terminology. Optional; omitted unless supplied by the host or backend. */
  labels?: Partial<BookingLabels>;
}) {
  const copy = mergeBookingLabels(labels);
  const mode = bookingMode(settings);
  if (mode === "full") return null;
  return (
    <div
      className={`notice ${mode === "paused" ? "warn" : "info"}`}
      role="status"
    >
      <BookingIcon name="info" />
      <div>
        <p>
          <strong>
            {mode === "paused"
              ? "Online-Buchung ist gerade pausiert."
              : mode === "voucher"
                ? "Online buchst Du gerade nur mit Gutschein."
                : "Online buchst Du gerade mit Deinem Konto."}
          </strong>
        </p>
        {mode === "paused" && (
          <p className="small">
            Die Termine siehst Du trotzdem. Buchen kannst Du{" "}
            {phone ? (
              <>
                telefonisch unter{" "}
                <a href={`tel:${phone.replace(/\s/g, "")}`}>
                  {phoneLabel ?? phone}
                </a>{" "}
                oder{" "}
              </>
            ) : null}
            direkt bei uns im Laden.
          </p>
        )}
        {mode === "voucher" && (
          <p className="small">{copy.eventVoucherNotice}</p>
        )}
      </div>
    </div>
  );
}
/** CSS colors keyed by public event identifier. */
export type EventColors = Record<number, string>;
/** Create the inline custom property for an event color. */
export const eventStyle = (color?: string) =>
  ({
    ...(color === undefined ? {} : { "--sv-event": color }),
  }) as CSSProperties;
/** Render a decorative booking icon with an optional CSS class. */
export function BookingIcon({
  name,
  className = "i",
}: {
  /** Selected icon or backend name. */
  name:
    | "calendar"
    | "gift"
    | "arrow"
    | "check"
    | "clock"
    | "pin"
    | "users"
    | "id"
    | "info"
    | "alert"
    | "phone"
    | "glass"
    | "plate"
    | "plus"
    | "minus"
    | "close";
  /** Additional host CSS class.
   * @defaultValue "i" */
  className?: string;
}) {
  const paths = {
    plus: "M5 12h14M12 5v14",
    minus: "M5 12h14",
    close: "M6 6l12 12M6 18L18 6",
    calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z",
    gift: "M3 8h18v4H3ZM5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3Zm0 0h4a3 3 0 1 0-3-3Z",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    check: "m5 12 4 4L19 6",
    clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
    pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    users:
      "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m20 0v-3a4 4 0 0 0-3-4M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-4a4 4 0 0 1 0 8",
    id: "M3 5h18v14H3ZM8 9h2m-3 6h4m4-6h3m-3 4h3",
    info: "M12 11v6m0-10v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
    alert: "m12 3 10 18H2Zm0 6v5m0 3v1",
    phone: "M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c-9 3-19-7-16-16Z",
    glass: "M7 3h10l1 7a6 6 0 0 1-12 0Zm5 13v6m-4 0h8",
    plate:
      "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z",
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
/** Classify a timewindow using capacity, lead time and backend booking deadlines.
 * @param w - W supplied by the host.
 * @param seats - Booked places, or requested seat count depending on the signature. Defaults to 1.
 * @param leadHours - Minimum Berlin wall-clock lead time in hours. Defaults to 24. Defaults to 24.
 * @param now - Current instant as milliseconds since the Unix epoch. Defaults to Date.now(). Defaults to Date.now(). */
export function availability(
  w: Timewindow,
  seats = 1,
  leadHours = 24,
  now = Date.now(),
) {
  if (windowStarted(w, now))
    return {
      /** Availability state used for visual treatment. */
      state: "past",
      /** Availability icon name. */
      icon: "◷",
      /** Customer-visible German availability message. */
      text: "Vorbei",
      /** Whether this slot can be selected for the requested seats. */
      bookable: false,
    };
  if (!w.free_spots || w.availabilityStatus === "not_available")
    return {
      /** Availability state used for visual treatment. */
      state: "full",
      /** Availability icon name. */
      icon: "⊘",
      /** Customer-visible German availability message. */
      text: "Ausgebucht",
      /** Whether this slot can be selected for the requested seats. */
      bookable: false,
    };
  if (windowTooSoon(w, now, leadHours) || deadlinePassed(w, now))
    return {
      /** Availability state used for visual treatment. */
      state: "closed",

      /** Availability icon name. */
      icon: "☎",

      /** Customer-visible German availability message. */
      text: "Nur telefonisch",

      /** Whether this slot can be selected for the requested seats. */
      bookable: false,
    };
  if (w.free_spots < seats)
    return {
      /** Availability state used for visual treatment. */
      state: "short",

      /** Availability icon name. */
      icon: "♙",

      /** Customer-visible German availability message. */
      text: `Nur ${w.free_spots} ${w.free_spots === 1 ? "Platz" : "Plätze"} frei`,

      /** Whether this slot can be selected for the requested seats. */
      bookable: false,
    };
  return {
    /** State returned by availability. */
    state: w.free_spots <= 4 ? "few" : "free",
    /** Icon returned by availability. */
    icon: w.free_spots <= 4 ? "⌛" : "✓",
    /** Text returned by availability. */
    text:
      w.free_spots <= 4
        ? `Nur noch ${w.free_spots} ${w.free_spots === 1 ? "Platz" : "Plätze"}`
        : "Plätze frei",
    /** Bookable returned by availability. */
    bookable: true,
  };
}
/** Display a window availability label for the requested number of seats. */
export function AvailabilityBadge({
  window: w,
  seats = 1,
  leadHours = 24,
}: {
  /** Selected dated timewindow. */
  window: Timewindow;
  /** Booked places, or requested seat count depending on the signature.
   * @defaultValue 1 */
  seats?: number;
  /** Minimum Berlin wall-clock lead time in hours. Defaults to 24.
   * @defaultValue 24 */
  leadHours?: number;
}) {
  const a = availability(w, seats, leadHours);
  return (
    <span className={`avail s-${a.state}`}>
      <BookingIcon
        name={
          a.state === "free"
            ? "check"
            : a.state === "closed"
              ? "phone"
              : a.state === "past"
                ? "clock"
                : a.state === "short"
                  ? "users"
                  : "alert"
        }
      />{" "}
      {a.text}
    </span>
  );
}
/** Render a controlled seat counter bounded by the supplied minimum and maximum. */
export function SeatStepper({
  value,
  onChange,
  min = 1,
  max = 8,
  label = "Plätze",
  hint,
}: {
  /** Current controlled value. */
  value: number;
  /** Receive the updated controlled value. */
  onChange: (n: number) => void;
  /** Inclusive minimum selectable value.
   * @defaultValue 1 */
  min?: number;
  /** Inclusive maximum selectable value.
   * @defaultValue 8 */
  max?: number;
  /** Accessible customer-visible label.
   * @defaultValue "Plätze" */
  label?: string;
  /** Optional customer-visible helper text. Optional; omitted unless supplied by the host or backend. */
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="bp-row">
      <div>
        <span id={id}>{label}</span>
        {hint && <p className="hint">{hint}</p>}
      </div>
      <fieldset className="stepper" aria-labelledby={id}>
        <button
          type="button"
          aria-label={`Einen Platz weniger: ${label}`}
          aria-disabled={value <= min}
          onClick={() => value > min && onChange(value - 1)}
        >
          <BookingIcon name="minus" />
        </button>
        <output aria-live="polite">{value}</output>
        <button
          type="button"
          aria-label={`Einen Platz mehr: ${label}`}
          aria-disabled={value >= max}
          onClick={() => value < max && onChange(value + 1)}
        >
          <BookingIcon name="plus" />
        </button>
      </fieldset>
    </div>
  );
}
/** Event collection accepted by the calendar components. */
export type EventCollection = {
  /** Public event collection. */
  events: ShopEvent[];
};
/** Read the event collection from calendar input. */
export const eventsFrom = (data: EventCollection): ShopEvent[] => data.events;
/** Loaded calendar data with event variants and availability. */
export interface CalendarData {
  /** Preferred public event collection. */
  events: ShopEvent[];
  /** Dated availability returned by the API. */
  windows: Timewindow[];
  /** Authoritative public installation flags and booking limits. */
  settings: ShopSettings;
  /** Public installation locations. */
  locations: Location[];
}
/** Event data accepted by calendar components. */
export type CalendarInput = CalendarData;
/** Load the events, dated availability, locations and settings for a location and optional date range. */
export function useCalendar({
  client,
  locationId,
  from = berlinToday(),
  to,
}: {
  /** Stable client instance used for API requests. */
  client: BookingClient;
  /** Positive installation location identifier used to filter availability. */
  locationId: number;
  /** First ISO date to load. Defaults to today in Europe/Berlin.
   * @defaultValue berlinToday() */
  from?: string;
  /** Optional last ISO date to load. Optional; omitted unless supplied by the host or backend. */
  to?: string;
}) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const range = useRef<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Revision triggers an explicit reload.
  useEffect(() => {
    const controller = new AbortController();
    const key = `${locationId}:${from}:${to ?? ""}`;
    if (range.current !== key) {
      setData(null);
      range.current = key;
    }
    setError(null);
    Promise.all([
      client.listEvents(controller.signal),
      client.listLocationTimewindows(locationId, {
        startDate: from,
        endDate: to,
        signal: controller.signal,
      }),
      client.getSettings(controller.signal),
      client.listLocations(controller.signal),
    ])
      .then(([events, result, settings, locations]) => {
        if (!controller.signal.aborted)
          setData({
            events,

            /** Loaded dated event availability. */
            windows: result.timewindows.sort((a, b) =>
              `${a.date} ${a.start_time}`.localeCompare(
                `${b.date} ${b.start_time}`,
              ),
            ),
            settings,

            /** Public installation locations. */
            locations: locations.locations,
          });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(bookingErrorMessage(e));
      });
    return () => controller.abort();
  }, [client, locationId, from, to, revision]);
  return {
    /** Loaded authoritative data, or null while unavailable. */
    data,
    /** Customer-visible error, or null. */
    error,
    /** Whether the read is pending. */
    loading: !data && !error,
    /** Reload the resource from its authoritative API. */
    reload: () => setRevision((n) => n + 1),
  };
}
/** Display a dated slot using an optional event color and locale. */
export function DateTile({
  window: w,
  color,
  locale = "de-DE",
}: {
  /** Selected dated timewindow. */
  window: Timewindow;
  /** Optional CSS color for the event. Optional; omitted unless supplied by the host or backend. */
  color?: string;
  /** Date/number locale. Defaults to de-DE.
   * @defaultValue "de-DE" */
  locale?: string;
}) {
  const d = new Date(`${w.date}T12:00:00Z`);
  return (
    <span className="date-tile" style={eventStyle(color)} aria-hidden="true">
      <span className="wd">
        {d.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })}
      </span>
      <strong className="d">{d.getUTCDate()}</strong>
      <span className="m">
        {d.toLocaleDateString(locale, { month: "short", timeZone: "UTC" })}
      </span>
    </span>
  );
}
/** Render bookable dates with optional month grouping, event colors and host selection callback. */
export function DateList({
  windows,
  events,
  locations = [],
  seats = 1,
  leadHours = 24,
  onSelect,
  colors = {},
  format = {},
  groupMonths = true,
}: {
  /** Dated availability returned by the API. */
  windows: Timewindow[];
  /** Public installation locations.
   * @defaultValue [] */
  locations?: Location[];
  /** Booked places, or requested seat count depending on the signature.
   * @defaultValue 1 */
  seats?: number;
  /** Minimum Berlin wall-clock lead time in hours. Defaults to 24.
   * @defaultValue 24 */
  leadHours?: number;
  /** Receive the selected dated timewindow. */
  onSelect: (w: Timewindow) => void;
  /** Optional CSS colors keyed by event identifier.
   * @defaultValue {} */
  colors?: EventColors;
  /** Optional locale and currency formatting settings.
   * @defaultValue {} */
  format?: BookingFormat;
  /** Group the date list by calendar month.
   * @defaultValue true */
  groupMonths?: boolean;
} & EventCollection) {
  const eventRows = eventsFrom({ events });
  let month = "";
  return (
    <div className="agenda">
      {windows.length === 0 && (
        <p role="status">Gerade sind keine Termine geplant.</p>
      )}
      {windows.map((w) => {
        const group = w.date.slice(0, 7);
        const heading = group !== month;
        month = group;
        const t = eventRows.find((t) => t.tasting_id === w.tasting_id);
        const l = locations.find((l) => l.id === w.franchise_location_id);
        return (
          <div key={w.timewindow_id}>
            {heading && groupMonths && (
              <h2 className="label month-label">
                {new Date(`${group}-01T12:00:00Z`).toLocaleDateString(
                  format.locale ?? "de-DE",
                  {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  },
                )}
              </h2>
            )}
            <button
              className="ag-row"
              style={eventStyle(colors[w.tasting_id])}
              type="button"
              onClick={() => onSelect(w)}
            >
              <DateTile
                window={w}
                color={colors[w.tasting_id]}
                locale={format.locale}
              />
              <span className="ag-main">
                <strong>{t?.tasting_name ?? w.event_name}</strong>
                <span className="muted">
                  {bookingDate(w.date, true, format.locale)}, {bookingTime(w)}
                  {l && ` · ${l.location_street ?? l.location_name}`}
                </span>
              </span>
              <span className="ag-side">
                <AvailabilityBadge
                  window={w}
                  seats={seats}
                  leadHours={leadHours}
                />
                {t && <span>{bookingMoney(t.price, format)}</span>}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
/** Render a month grid and delegate date selection and month navigation to the host. */
export function MonthCalendar({
  month,
  windows,
  events,
  seats = 1,
  leadHours = 24,
  onSelect,
  compact = false,
  onMonthChange,
  locations = [],
  colors = {},
  format = {},
}: {
  /** Visible month in YYYY-MM format. */
  month: string;
  /** Dated availability returned by the API. */
  windows: Timewindow[];
  /** Booked places, or requested seat count depending on the signature.
   * @defaultValue 1 */
  seats?: number;
  /** Minimum Berlin wall-clock lead time in hours. Defaults to 24.
   * @defaultValue 24 */
  leadHours?: number;
  /** Receive the selected dated timewindow. */
  onSelect: (w: Timewindow) => void;
  /** Use the compact month layout.
   * @defaultValue false */
  compact?: boolean;
  /** Receive the requested ISO year-month for host navigation. Optional; omitted unless supplied by the host or backend. */
  onMonthChange?: (month: string) => void;
  /** Public installation locations.
   * @defaultValue [] */
  locations?: Location[];
  /** Optional CSS colors keyed by event identifier.
   * @defaultValue {} */
  colors?: EventColors;
  /** Optional locale and currency formatting settings.
   * @defaultValue {} */
  format?: BookingFormat;
} & EventCollection) {
  const eventRows = eventsFrom({ events });
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const [day, setDay] = useState("");
  const grid = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  useEffect(() => {
    if (pendingFocus.current) {
      const target = grid.current?.querySelector<HTMLButtonElement>(
        `[data-day="${day}"]`,
      );
      if (target && day.startsWith(month)) {
        target.focus();
        pendingFocus.current = false;
      }
    }
  }, [month, day]);
  const focusDay = day.startsWith(month)
    ? day
    : (windows.find((w) => w.date.startsWith(month))?.date ?? `${month}-01`);
  const selectDay = (key: string) => {
    setDay(key);
    const matches = windows.filter((w) => w.date === key);
    if (compact && matches.length === 1) onSelect(matches[0]);
  };
  const onDayKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const buttons = Array.from(
      grid.current?.querySelectorAll<HTMLButtonElement>(".cal-daybtn") ?? [],
    );
    const i = buttons.indexOf(e.target as HTMLButtonElement);
    if (i < 0) return;
    const delta: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -((i + offset) % 7),
      End: 6 - ((i + offset) % 7),
    };
    if (e.key in delta) {
      e.preventDefault();
      const target =
        buttons[Math.max(0, Math.min(buttons.length - 1, i + delta[e.key]))];
      setDay(target.dataset.day ?? "");
      target.focus();
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const d = new Date(first);
      d.setUTCMonth(d.getUTCMonth() + (e.key === "PageUp" ? -1 : 1));
      const nextMonth = d.toISOString().slice(0, 7);
      const targetDay = Math.min(
        i + 1,
        new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      );
      pendingFocus.current = true;
      setDay(`${nextMonth}-${String(targetDay).padStart(2, "0")}`);
      onMonthChange?.(nextMonth);
    }
  };
  return (
    <>
      <section
        className={`cal ${compact ? "mini-cal" : ""}`}
        aria-label={`Monatskalender ${first.toLocaleDateString(format.locale ?? "de-DE", { month: "long", year: "numeric", timeZone: "UTC" })}`}
      >
        <div className="cal-dow" aria-hidden="true">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div ref={grid} className="cal-grid">
          {Array.from(
            { length: Math.ceil((offset + days) / 7) * 7 },
            (_, i) => {
              const n = i - offset + 1;
              if (n < 1 || n > days)
                return (
                  <div className="cal-cell out" key={`${month}-empty-${n}`} />
                );
              const key = `${month}-${String(n).padStart(2, "0")}`;
              const list = windows.filter((w) => w.date === key);
              return (
                <div
                  className={`cal-cell ${key < berlinToday() ? "past" : ""} ${key === berlinToday() ? "today" : ""}`}
                  key={key}
                >
                  <button
                    type="button"
                    className="cal-daybtn"
                    onKeyDown={onDayKeyDown}
                    data-day={key}
                    onFocus={() => setDay(key)}
                    tabIndex={key === focusDay ? 0 : -1}
                    aria-pressed={key === focusDay}
                    aria-label={`${bookingDate(key, false, format.locale)}: ${list.length ? list.map((w) => `${eventRows.find((t) => t.tasting_id === w.tasting_id)?.tasting_name ?? w.event_name}, ${w.start_time.slice(0, 5)}, ${availability(w, seats, leadHours).text}`).join("; ") : "kein Termin"}`}
                    onClick={() => selectDay(key)}
                  >
                    <span className="cal-num">{n}</span>
                    <span className="cal-dots">
                      {list.slice(0, 3).map((w) => (
                        <span
                          key={w.timewindow_id}
                          style={eventStyle(colors[w.tasting_id])}
                          className={`cal-dot s-${availability(w, seats, leadHours).state}`}
                        />
                      ))}
                    </span>
                  </button>
                  <span className="cal-num desk">{n}</span>
                  <div className="cal-evs">
                    {list.map((w) => (
                      <button
                        type="button"
                        style={eventStyle(colors[w.tasting_id])}
                        className={`cal-ev s-${availability(w, seats, leadHours).state}`}
                        key={w.timewindow_id}
                        onClick={() => onSelect(w)}
                        aria-label={`${bookingDate(key, false, format.locale)}, ${bookingTime(w)}: ${eventRows.find((t) => t.tasting_id === w.tasting_id)?.tasting_name ?? w.event_name}. ${availability(w, seats, leadHours).text}`}
                      >
                        <strong>{w.start_time.slice(0, 5)}</strong>{" "}
                        {eventRows.find((t) => t.tasting_id === w.tasting_id)
                          ?.tasting_name ?? w.event_name}
                        <AvailabilityBadge
                          window={w}
                          seats={seats}
                          leadHours={leadHours}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </section>
      <div className="cal-legend">
        <span className="legend-item">
          <BookingIcon name="check" /> Plätze frei
        </span>
        <span className="legend-item">
          <BookingIcon name="alert" /> Wenige Plätze / ausgebucht
        </span>
        <span className="legend-item">
          <BookingIcon name="phone" /> Nur telefonisch
        </span>
      </div>
      <div className={compact ? "day-panel" : "day-panel mobile-only"}>
        <h3 className="label">{bookingDate(focusDay, true, format.locale)}</h3>
        {compact ? (
          windows
            .filter((w) => w.date === focusDay)
            .map((w) => (
              <button
                key={w.timewindow_id}
                className="time-chip"
                type="button"
                onClick={() => onSelect(w)}
              >
                {eventRows.find((t) => t.tasting_id === w.tasting_id)
                  ?.tasting_name ?? w.event_name}
                , {bookingTime(w)}{" "}
                <AvailabilityBadge
                  window={w}
                  seats={seats}
                  leadHours={leadHours}
                />
              </button>
            ))
        ) : (
          <DateList
            windows={windows.filter((w) => w.date === focusDay)}
            events={eventRows}
            locations={locations}
            seats={seats}
            leadHours={leadHours}
            onSelect={onSelect}
            colors={colors}
            format={format}
            groupMonths={false}
          />
        )}
      </div>
    </>
  );
}
/** Render a selected date in a modal sheet with seats, availability and booking-mode guidance. */
export function DateSheet({
  window: w,
  variants,
  location,
  settings,
  initialSeats = 2,
  onClose,
  onContinue,
  detailUrl,
  phone,
  phoneLabel,
  labels,
  nextWindow,
  onSelect,
  windows = [],
  color,
  format = {},
}: {
  /** Selected dated timewindow. */
  window: Timewindow;
  /** Public event variants with backend prices. */
  variants: ShopEvent[];
  /** Selected installation location. Optional; omitted unless supplied by the host or backend. */
  location?: Location;
  /** Authoritative public installation flags and booking limits. */
  settings: ShopSettings;
  /** Initial selected seat count.
   * @defaultValue 2 */
  initialSeats?: number;
  /** Close the modal in host state. */
  onClose: () => void;
  /** Receive the selected window and seat count to continue booking. */
  onContinue: (w: Timewindow, seats: number) => void;
  /** Optional host event details URL. Optional; omitted unless supplied by the host or backend. */
  detailUrl?: string;
  /** Host contact phone number or customer international phone field. Optional; omitted unless supplied by the host or backend. */
  phone?: string;
  /** Customer-visible phone link label. Optional; omitted unless supplied by the host or backend. */
  phoneLabel?: string;
  /** Host-owned copy overrides or account terminology. Optional; omitted unless supplied by the host or backend. */
  labels?: Partial<BookingLabels>;
  /** Optional next available timewindow. Optional; omitted unless supplied by the host or backend. */
  nextWindow?: Timewindow;
  /** Receive the selected dated timewindow. Optional; omitted unless supplied by the host or backend. */
  onSelect?: (window: Timewindow) => void;
  /** Dated availability returned by the API.
   * @defaultValue [] */
  windows?: Timewindow[];
  /** Optional CSS color for the event. Optional; omitted unless supplied by the host or backend. */
  color?: string;
  /** Optional locale and currency formatting settings.
   * @defaultValue {} */
  format?: BookingFormat;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const max = Math.min(settings.guest_max_seats ?? 8, w.free_spots || 1);
  const [seats, setSeats] = useState(Math.max(1, Math.min(initialSeats, max)));
  const copy = mergeBookingLabels(labels);
  const mode = bookingMode(settings);
  const alternative =
    windows.find(
      (candidate) =>
        candidate.tasting_id === w.tasting_id &&
        candidate.timewindow_id !== w.timewindow_id &&
        candidate.date >= w.date &&
        availability(candidate, seats, settings.online_lead_hours).bookable,
    ) ??
    (nextWindow &&
    availability(nextWindow, seats, settings.online_lead_hours).bookable
      ? nextWindow
      : undefined);
  const a = availability(w, seats, settings.online_lead_hours);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => {
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="sheet sv-redesign"
      aria-labelledby={title}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="sheet-inner">
        <div className="sheet-head">
          <div>
            <p className="eyebrow">Termin</p>
            <h2 id={title}>{variants[0]?.tasting_name ?? w.event_name}</h2>
          </div>
          <button
            className="icon-btn"
            type="button"
            onClick={onClose}
            aria-label="Schließen"
          >
            <BookingIcon name="close" />
          </button>
        </div>
        <div className="date-summary">
          <DateTile window={w} color={color} locale={format.locale} />
          <div>
            <strong>{bookingDate(w.date, false, format.locale)}</strong>
            <p>{bookingTime(w)}</p>
            <p className="muted">
              {location?.location_street ?? location?.location_name}
            </p>
          </div>
        </div>
        <AvailabilityBadge
          window={w}
          seats={seats}
          leadHours={settings.online_lead_hours}
        />
        {(w.free_spots ?? 0) > 0 &&
          a.state !== "closed" &&
          a.state !== "past" && (
            <SeatStepper
              value={seats}
              max={max}
              onChange={setSeats}
              hint={
                max === 1
                  ? "Noch 1 Platz verfügbar."
                  : `Bis zu ${max} Plätze pro Buchung.`
              }
            />
          )}
        <BookingModeNotice
          settings={settings}
          phone={phone}
          phoneLabel={phoneLabel}
          labels={labels}
        />
        {a.bookable && mode !== "paused" ? (
          <>
            <p>
              {variants.length > 1 &&
                " Die Variante wählst Du im nächsten Schritt."}
            </p>
            <div className="bp-row">
              <span>
                {seats} {seats === 1 ? "Platz" : "Plätze"}
              </span>
              <strong>
                {variants.length > 1 && "ab "}
                {bookingMoney(
                  Math.min(...variants.map((v) => v.price)) * seats,
                  format,
                )}
              </strong>
            </div>
            <button
              className="btn btn-primary btn-block"
              type="button"
              onClick={() => onContinue(w, seats)}
            >
              Weiter zur Buchung <BookingIcon name="arrow" />
            </button>
          </>
        ) : (
          <div className="notice">
            <p>
              {mode === "paused"
                ? "Kontaktiere uns für Deine Buchung."
                : a.state === "full"
                  ? "Manchmal wird kurzfristig ein Platz frei. Ruf uns gern an."
                  : a.state === "short"
                    ? a.text
                    : a.state === "closed"
                      ? `Bis ${settings.online_lead_hours ?? 24} Stunden vor Beginn buchst Du online, danach telefonisch.`
                      : "Dieser Termin kann nicht online gebucht werden. Wähle einen anderen Termin oder kontaktiere uns."}
            </p>
            {a.state === "short" && (
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setSeats(Math.max(1, w.free_spots ?? 0))}
              >
                Auf {w.free_spots} {w.free_spots === 1 ? "Platz" : "Plätze"}{" "}
                reduzieren
              </button>
            )}
            {mode !== "paused" && alternative && onSelect && (
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => onSelect(alternative)}
              >
                Nächster Termin:{" "}
                {bookingDate(alternative.date, true, format.locale)}
              </button>
            )}
            {phone && <a href={`tel:${phone}`}>Telefonisch anfragen</a>}
          </div>
        )}
        {detailUrl && (
          <a className="btn-link mono-link" href={detailUrl}>
            {copy.eventDetails} <BookingIcon name="arrow" />
          </a>
        )}
      </div>
    </dialog>
  );
}

/** Host-neutral modal reused for changing dates and opening the mobile summary. */
export function BookingDialog({
  title,
  onClose,
  children,
}: {
  /** Customer-visible heading or title supplied by the host. */
  title: string;
  /** Close the modal in host state. */
  onClose: () => void;
  /** Host-supplied child content. */
  children: import("react").ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => trigger?.focus();
  }, []);
  return (
    <dialog
      className="sv-redesign sheet"
      ref={dialog}
      aria-labelledby={id}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="sheet-inner">
        <div className="sheet-head">
          <h2 id={id}>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Schließen"
            onClick={onClose}
          >
            <BookingIcon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
