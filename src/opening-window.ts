/** Weekly public opening interval with Monday represented by zero. */
export type OpeningHours = {
  weekday: number;
  opens: string;
  closes: string;
};
/** Inclusive ISO date range overriding regular opening hours. */
export type OpeningException = {
  from: string;
  until: string;
  opens?: string;
  closes?: string;
  label?: string;
  /** Local Berlin datetime bounds for a half-open private-event closure. */
  closed_from?: string;
  closed_until?: string;
  /** Optional source event identifier; only closed_from marks a timed closure. */
  private_event_id?: number | string;
};
/** A closure clipped to one local date; 24:00 denotes the following midnight. */
export type OpeningClosure = { starts: string; ends: string; label?: string };
/** Public weekly opening hours and date exceptions. */
export type OpeningSettings = {
  opening_hours?: OpeningHours[] | null;
  /** Preferred weekly intervals; null is unrestricted and [] is closed. */
  opening_intervals?: OpeningHours[] | null;
  opening_exceptions?: OpeningException[];
};
/** Validation bounds on this date, with the original overnight close for display. */
type OpeningInterval = {
  opens: string;
  closes: string;
  nextDayCloses?: string;
};
/** Resolved open, closed or unrestricted reservation window. */
export type OpeningWindow = (
  | {
      kind: "unrestricted";
    }
  | {
      kind: "closed";
      label?: string;
    }
  | {
      kind: "open";
      opens: string;
      closes: string;
      label?: string;
      /** Calendar-date windows; 24:00 is the exclusive next midnight. */
      intervals?: OpeningInterval[];
      nextDayCloses?: string;
    }
) & { closures?: OpeningClosure[] };

function isTimedClosure(entry: OpeningException): boolean {
  return Boolean(entry.closed_from);
}

function closureOnDate(
  entry: OpeningException,
  date: string,
): OpeningClosure | null {
  const start = (entry.closed_from || `${entry.from}T${entry.opens}`).slice(
    0,
    16,
  );
  const end = (entry.closed_until || `${entry.until}T${entry.closes}`).slice(
    0,
    16,
  );
  const dayStart = `${date}T00:00`;
  const dayEnd = `${date}T24:00`;
  if (end <= dayStart || start >= dayEnd) return null;
  const starts = start < dayStart ? "00:00" : start.slice(11, 16);
  const ends = end >= dayEnd ? "24:00" : end.slice(11, 16);
  if (starts >= ends) return null;
  return {
    starts,
    ends,
    ...(entry.label ? { label: entry.label } : {}),
  };
}

/** ISO calendar dates compare directly; UTC prevents browser timezone shifts. */
export function openingWindow(
  date: string,
  settings: OpeningSettings,
): OpeningWindow {
  const closures = (settings.opening_exceptions || [])
    .filter(isTimedClosure)
    .map((entry) => closureOnDate(entry, date))
    .filter((entry): entry is OpeningClosure => entry !== null);
  const result =
    settings.opening_intervals === undefined
      ? baseOpeningWindow(date, settings)
      : intervalOpeningWindow(date, settings);
  return closures.length ? { ...result, closures } : result;
}

function baseOpeningWindow(
  date: string,
  settings: OpeningSettings,
): OpeningWindow {
  const exception = settings.opening_exceptions?.find(
    (entry) =>
      !isTimedClosure(entry) && entry.from <= date && date <= entry.until,
  );
  if (exception) {
    const label = exception.label ? { label: exception.label } : {};
    return exception.opens && exception.closes
      ? {
          kind: "open",
          opens: exception.opens,
          closes: exception.closes,
          ...label,
        }
      : { kind: "closed", ...label };
  }
  // Exceptions apply even without weekly hours, as in the backend.
  if (settings.opening_hours == null) return { kind: "unrestricted" };
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const hours = settings.opening_hours.find(
    (entry) => entry.weekday === weekday,
  );
  return hours
    ? { kind: "open", opens: hours.opens, closes: hours.closes }
    : { kind: "closed" };
}

/** Resolve each opening date before carrying its overnight part forward. */
function intervalOpeningWindow(
  date: string,
  settings: OpeningSettings,
): OpeningWindow {
  const ownSettings = {
    ...settings,
    opening_hours: settings.opening_intervals,
  };
  const own = baseOpeningWindow(date, ownSettings);
  if (own.kind === "unrestricted") return own;
  const previousDate = new Date(`${date}T12:00:00Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const previous = previousDate.toISOString().slice(0, 10);
  const dayIntervals = (day: string) => {
    const resolved = baseOpeningWindow(day, ownSettings);
    if (resolved.kind !== "open") return [];
    const exception = settings.opening_exceptions?.some(
      (entry) =>
        !isTimedClosure(entry) && entry.from <= day && day <= entry.until,
    );
    const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
    return exception
      ? [resolved]
      : (settings.opening_intervals || []).filter(
          (entry) => entry.weekday === weekday,
        );
  };
  const intervals = [
    ...dayIntervals(previous)
      .filter(({ opens, closes }) => "00:00" < closes && closes < opens)
      .map(({ closes }) => ({ opens: "00:00", closes })),
    ...dayIntervals(date).map(({ opens, closes }) => ({
      opens,
      closes: closes <= opens ? "24:00" : closes,
      ...(closes <= opens ? { nextDayCloses: closes } : {}),
    })),
  ]
    .flatMap((interval) => withoutBerlinTransitionHour(date, interval))
    .sort((a, b) => a.opens.localeCompare(b.opens));
  if (!intervals.length)
    return {
      kind: "closed",
      ...(own.kind === "closed" && own.label ? { label: own.label } : {}),
    };
  const first = intervals[0];
  const label = own.kind === "open" && own.label ? { label: own.label } : {};
  // Keep the single-window result byte-compatible for existing tenants.
  return {
    kind: "open",
    opens: first.opens,
    closes: intervals.reduce(
      (end, item) => (item.closes > end ? item.closes : end),
      first.closes,
    ),
    ...label,
    ...(intervals.length > 1
      ? { intervals }
      : first.nextDayCloses
        ? { nextDayCloses: first.nextDayCloses }
        : {}),
  };
}

// Berlin's modern DST transitions skip or repeat 02:00-02:59. Test both
// possible offsets rather than depending on the browser's local timezone.
const berlinClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function withoutBerlinTransitionHour(
  date: string,
  interval: OpeningInterval,
): OpeningInterval[] {
  if (interval.opens >= "03:00" || interval.closes <= "02:00")
    return [interval];
  const candidates = ["00:30", "01:30"].filter(
    (utcTime) =>
      berlinClock.format(new Date(`${date}T${utcTime}:00Z`)) === "02:30",
  );
  if (candidates.length === 1) return [interval];
  return [
    ...(interval.opens < "02:00"
      ? [{ opens: interval.opens, closes: "02:00" }]
      : []),
    ...(interval.closes > "03:00" ? [{ ...interval, opens: "03:00" }] : []),
  ];
}

/** Validate a 24-hour time against an opening window, excluding the closing time. */
export function timeInOpeningWindow(
  time: string,
  window: OpeningWindow,
): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  if (
    window.closures?.some(
      (closure) => closure.starts <= time && time < closure.ends,
    )
  )
    return false;
  if (window.kind === "unrestricted") return true;
  return (
    window.kind === "open" &&
    (window.intervals || [window]).some(
      ({ opens, closes }) => opens <= time && time < closes,
    )
  );
}
