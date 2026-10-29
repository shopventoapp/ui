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
};
/** Public weekly opening hours and date exceptions. */
export type OpeningSettings = {
  opening_hours?: OpeningHours[] | null;
  opening_exceptions?: OpeningException[];
};
/** Resolved open, closed or unrestricted reservation window. */
export type OpeningWindow =
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
    };

/** ISO calendar dates compare directly; UTC prevents browser timezone shifts. */
export function openingWindow(
  date: string,
  settings: OpeningSettings,
): OpeningWindow {
  const exception = settings.opening_exceptions?.find(
    (entry) => entry.from <= date && date <= entry.until,
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
  if (window.kind === "unrestricted") return true;
  return window.kind === "open" && window.opens <= time && time < window.closes;
}
