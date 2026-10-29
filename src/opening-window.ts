/** Weekly public opening interval with Monday represented by zero. */
export type OpeningHours = {
  /** Weekday for this public form or flow. */
  weekday: number /** Opens for this public form or flow. */;
  /** Opens for this public form or flow. */
  opens: string /** Closes for this public form or flow. */;
  /** Closes for this public form or flow. */
  closes: string;
};
/** Inclusive ISO date range overriding regular opening hours. */
export type OpeningException = {
  /** From for this public form or flow. */
  from: string;
  /** Until for this public form or flow. */
  until: string;
  /** Opens for this public form or flow. */
  opens?: string;
  /** Closes for this public form or flow. */
  closes?: string;
  /** Label for this public form or flow. */
  label?: string;
};
/** Public weekly opening hours and date exceptions. */
export type OpeningSettings = {
  /** Opening hours for this public form or flow. */
  opening_hours?: OpeningHours[] | null;
  /** Opening exceptions for this public form or flow. */
  opening_exceptions?: OpeningException[];
};
/** Resolved open, closed or unrestricted reservation window. */
export type OpeningWindow =
  | {
      /** Kind for this public form or flow. */ kind: "unrestricted";
    }
  | {
      /** Kind for this public form or flow. */
      kind: "closed" /** Label for this public form or flow. */;
      /** Label for this public form or flow. */
      label?: string;
    }
  | {
      /** Kind for this public form or flow. */
      kind: "open" /** Opens for this public form or flow. */;
      /** Opens for this public form or flow. */
      opens: string /** Closes for this public form or flow. */;
      /** Closes for this public form or flow. */
      closes: string /** Label for this public form or flow. */;
      /** Label for this public form or flow. */
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
