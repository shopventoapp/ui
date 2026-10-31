"use client";
import {
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  dateInputConfirmation,
  dateInputPlaceholder,
  formatLocaleDateInput,
  maskLocaleDate,
  parseLocaleDate,
  useMessages,
  useShopventoLocale,
} from "./locale";

/** A country selector value and customer-visible label. */
export type CountryOption = {
  /** Current controlled value. */
  value: string;
  /** Accessible customer-visible label. */
  label: string;
};

const countryAliases: Record<string, string> = {
  "china, festland": "CN",
  deu: "DE",
  germany: "DE",
  deutschland: "DE",
  aut: "AT",
  austria: "AT",
  österreich: "AT",
  oesterreich: "AT",
  france: "FR",
  frankreich: "FR",
  spain: "ES",
  spanien: "ES",
  italy: "IT",
  italien: "IT",
  switzerland: "CH",
  schweiz: "CH",
  netherlands: "NL",
  niederlande: "NL",
  belgium: "BE",
  belgien: "BE",
  portugal: "PT",
  poland: "PL",
  polen: "PL",
  denmark: "DK",
  dänemark: "DK",
  sweden: "SE",
  schweden: "SE",
  norway: "NO",
  norwegen: "NO",
  finland: "FI",
  finnland: "FI",
  ireland: "IE",
  irland: "IE",
  "united kingdom": "GB",
  "great britain": "GB",
  uk: "GB",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  canada: "CA",
  australia: "AU",
  "new zealand": "NZ",
  czechia: "CZ",
  "czech republic": "CZ",
  hungary: "HU",
  greece: "GR",
};
/** Resolve known legacy values without changing the API option order. */
export function accountCountryOption(
  countries: readonly CountryOption[],
  value?: string | null,
) {
  const key = value?.trim().toLocaleLowerCase("de") ?? "";
  return countries.find(
    (country) =>
      country.value.toLocaleLowerCase("de") === key ||
      country.label.toLocaleLowerCase("de") === key ||
      country.value === countryAliases[key],
  );
}

/** The public settings API orders the installation country first. */
export function CountrySelect({
  countries,
  defaultValue,
  error,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "defaultValue"> & {
  /** Host-configured country values and labels. */
  countries: readonly CountryOption[];
  /** Initial uncontrolled field value. Optional; omitted unless supplied by the host or backend. */
  defaultValue?: string | null;
  /** Customer-visible error or error presentation flag. Optional; omitted unless supplied by the host or backend. */
  error?: string;
}) {
  const text = useMessages("account");

  const id = useId();
  const initial =
    accountCountryOption(countries, defaultValue)?.value ||
    defaultValue?.trim() ||
    countries[0]?.value ||
    "";
  const [selected, setSelected] = useState(initial);
  const raw = String(props.value ?? selected);
  const current = accountCountryOption(countries, raw)?.value ?? raw;
  const unknown = current && !countries.some((c) => c.value === current);
  return (
    <>
      <select
        autoComplete="country"
        {...props}
        aria-invalid={!!error}
        aria-describedby={
          [props["aria-describedby"], error ? `${id}-error` : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        value={current}
        onChange={(event) => {
          setSelected(event.target.value);
          props.onChange?.(event);
        }}
      >
        {unknown && <option value={current}>{current}</option>}
        {!current && <option value="">{text("Bitte wähle ein Land")}</option>}
        {countries.map((country) => (
          <option key={country.value} value={country.value}>
            {country.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${id}-error`} className="error-text">
          {error}
        </span>
      )}
    </>
  );
}

/** Format typed digits in the selected locale, with the historic German caret behavior.
 * @param value - Current controlled value. */
export function maskBirthDate(value: string, locale = "de") {
  if (!locale.startsWith("de")) return maskLocaleDate(value, locale);
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  const normalized = iso
    ? `${iso[3]}${iso[2]}${iso[1]}`
    : german
      ? `${german[1].padStart(2, "0")}${german[2].padStart(2, "0")}${german[3]}`
      : value;
  const digits = normalized.replace(/\D/g, "").slice(0, 8);
  return (
    digits.slice(0, 2) +
    (digits.length >= 2 ? `.${digits.slice(2, 4)}` : "") +
    (digits.length >= 4 ? `.${digits.slice(4)}` : "")
  );
}
/** Convert an ISO date into a numeric input value for the selected locale.
 * @param value - Current controlled value. */
export function birthDateFromISO(value?: string | null, locale = "de") {
  if (!locale.startsWith("de"))
    return formatLocaleDateInput(value ?? "", locale);
  return value
    ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`
    : "";
}
/** Null signals an incomplete or malformed entry; empty stays optional. */
export function birthDateToISO(value: string, locale = "de"): string | null {
  if (!locale.startsWith("de")) {
    if (!value) return "";
    try {
      return parseLocaleDate(value, locale);
    } catch {
      return null;
    }
  }
  if (!value) return "";
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return null;
  return `${value.slice(6)}-${value.slice(3, 5)}-${value.slice(0, 2)}`;
}

/** Render a controlled locale-aware birth date field. */
export function BirthDateInput({
  value,
  onValueChange,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  /** Current controlled value. */
  value: string;
  /** Receive the updated formatted date value. */
  onValueChange: (value: string) => void;
}) {
  const { locale } = useShopventoLocale();
  const confirmationId = useId();
  const confirmation = dateInputConfirmation(value, locale);
  const input = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<{ caret: number } | null>(null);
  useLayoutEffect(() => {
    if (selection)
      input.current?.setSelectionRange(selection.caret, selection.caret);
  }, [selection]);
  function update(raw: string, position: number, inputType?: string) {
    if (!locale.startsWith("de")) {
      onValueChange(maskBirthDate(raw, locale));
      return;
    }
    // Forward deletion crosses a separator by removing the next digit.
    if (
      inputType === "deleteContentForward" &&
      value[position] === "." &&
      raw === value.slice(0, position) + value.slice(position + 1)
    ) {
      onValueChange(
        maskBirthDate(
          (value.slice(0, position) + value.slice(position + 2)).replace(
            /\D/g,
            "",
          ),
        ),
      );
      setSelection({ caret: position });
      return;
    }
    // IMEs can delete a separator without sending a Backspace keydown.
    if (
      value[position] === "." &&
      raw === value.slice(0, position) + value.slice(position + 1)
    ) {
      onValueChange(
        maskBirthDate(
          (raw.slice(0, position - 1) + raw.slice(position)).replace(/\D/g, ""),
        ),
      );
      setSelection({ caret: Math.max(0, position - 1) });
      return;
    }
    // A single inserted digit overwrites the next digit in a complete date.
    if (
      value.replace(/\D/g, "").length === 8 &&
      /\d/.test(raw[position - 1] ?? "") &&
      raw ===
        value.slice(0, position - 1) +
          raw[position - 1] +
          value.slice(position - 1)
    ) {
      const next = raw.slice(position).search(/\d/);
      if (next >= 0)
        raw = raw.slice(0, position + next) + raw.slice(position + next + 1);
    }
    const converted =
      inputType === "insertFromPaste" &&
      /^(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})$/.test(raw.trim());
    const digitsBefore = Math.min(
      raw.slice(0, position).replace(/\D/g, "").length,
      8,
    );
    const masked = maskBirthDate(converted ? raw : raw.replace(/\D/g, ""));
    const caret = Math.min(
      digitsBefore + (digitsBefore >= 2 ? 1 : 0) + (digitsBefore >= 4 ? 1 : 0),
      masked.length,
    );
    onValueChange(masked);
    setSelection({
      caret: converted && position === raw.length ? masked.length : caret,
    });
  }
  return (
    <>
      <input
        {...props}
        aria-describedby={
          [props["aria-describedby"], confirmation ? confirmationId : ""]
            .filter(Boolean)
            .join(" ") || undefined
        }
        ref={input}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder={dateInputPlaceholder(locale)}
        value={value}
        onChange={(event) =>
          update(
            event.target.value,
            event.target.selectionStart ?? event.target.value.length,
            (event.nativeEvent as InputEvent).inputType,
          )
        }
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (event.defaultPrevented) return;
          const start = event.currentTarget.selectionStart ?? 0;
          const end = event.currentTarget.selectionEnd ?? start;
          // Remove the preceding digit as well when Backspace crosses an auto-inserted dot.
          if (
            locale.startsWith("de") &&
            event.key === "Backspace" &&
            start === end &&
            value[start - 1] === "."
          ) {
            event.preventDefault();
            update(
              value.slice(0, start - 2) + value.slice(start),
              start - 2,
              "deleteContentBackward",
            );
          }
        }}
      />
      {confirmation && (
        <span id={confirmationId} role="status" className="hint">
          {confirmation}
        </span>
      )}
    </>
  );
}
