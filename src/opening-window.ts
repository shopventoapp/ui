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
  opening_exceptions?: OpeningException[];
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
  const result = baseOpeningWindow(date, settings);
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
  return window.kind === "open" && window.opens <= time && time < window.closes;
}
