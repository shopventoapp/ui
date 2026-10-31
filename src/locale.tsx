"use client";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import {
  defaultAccountMessages,
  englishAccountMessages,
} from "./account-messages";
import {
  defaultBookingMessages,
  englishBookingMessages,
} from "./booking-messages";
import {
  defaultFormsMessages,
  defaultPaymentMessages,
  defaultVoucherMessages,
  englishFormsMessages,
  englishPaymentMessages,
  englishVoucherMessages,
} from "./common-messages";
import {
  defaultNewsletterLabels,
  englishNewsletterLabels,
} from "./newsletter-signup-labels";
import {
  defaultReservationLabels,
  englishReservationLabels,
} from "./reservation-form-labels";
import {
  defaultShopFlowLabels,
  englishShopFlowLabels,
} from "./shop-flow-labels";

/** Complete German message schema. Additional languages use the same keys. */
export const germanMessages = Object.freeze({
  /** Messages for shop. */
  shop: defaultShopFlowLabels,
  /** Messages for newsletter. */
  newsletter: defaultNewsletterLabels,
  /** Messages for reservation. */
  reservation: defaultReservationLabels,
  /** Messages for booking. */
  booking: defaultBookingMessages,
  /** Messages for account. */
  account: defaultAccountMessages,
  /** Messages for forms. */
  forms: defaultFormsMessages,
  /** Messages for payment. */
  payment: defaultPaymentMessages,
  /** Messages for voucher. */
  voucher: defaultVoucherMessages,
} as const);
/** A fully translated catalogue, typed against the German keys. */
export type ShopventoMessages = {
  [A in keyof typeof germanMessages]: {
    [K in keyof (typeof germanMessages)[A]]: string;
  };
};
/** Partial catalogues fall back to German for missing keys. */
export type ShopventoCatalogue = {
  [A in keyof ShopventoMessages]?: Partial<ShopventoMessages[A]>;
};
/** English copy shipped with the package. */
export const englishMessages: ShopventoMessages = Object.freeze({
  /** Messages for shop. */
  shop: englishShopFlowLabels,
  /** Messages for newsletter. */
  newsletter: englishNewsletterLabels,
  /** Messages for reservation. */
  reservation: englishReservationLabels,
  /** Messages for booking. */
  booking: englishBookingMessages,
  /** Messages for account. */
  account: englishAccountMessages,
  /** Messages for forms. */
  forms: englishFormsMessages,
  /** Messages for payment. */
  payment: englishPaymentMessages,
  /** Messages for voucher. */
  voucher: englishVoucherMessages,
});
/** Per-render language and optional host translations. No global registration is needed. */
export interface LocaleOptions {
  /** BCP 47 locale. German is the default; English is shipped. */
  locale?: string;
  /** Register or override any area for this render. Missing custom keys fall back to German. */
  messages?: ShopventoCatalogue;
}
type LocaleValue = { locale: string; messages: ShopventoMessages };
const defaultValue: LocaleValue = {
  /** Messages for locale. */
  locale: "de" /** Messages for messages. */,
  messages: germanMessages,
};
const LocaleContext = createContext<LocaleValue>(defaultValue);
function resolveArea(
  area: keyof ShopventoMessages,
  locale: string,
  custom?: ShopventoCatalogue,
) {
  const base =
    locale.toLowerCase().split("-")[0] === "en"
      ? englishMessages
      : germanMessages;
  const overrides = custom?.[area];
  if (!overrides) return base[area];
  return {
    ...base[area],
    ...Object.fromEntries(
      Object.entries(overrides).filter(([, value]) => value !== undefined),
    ),
  };
}
function resolveMessages(
  locale: string,
  custom?: ShopventoCatalogue,
): ShopventoMessages {
  return Object.fromEntries(
    Object.keys(germanMessages).map((area) => [
      area,
      resolveArea(area as keyof ShopventoMessages, locale, custom),
    ]),
  ) as ShopventoMessages;
}
/** Scope locale and host catalogues to one visitor, route or component subtree. */
export function ShopventoProvider({
  locale,
  messages,
  children,
}: LocaleOptions & { children: ReactNode }) {
  const parent = useContext(LocaleContext);
  const value = useMemo(() => {
    const language = locale ?? parent.locale;
    const inherited =
      locale === undefined || locale === parent.locale
        ? parent.messages
        : undefined;
    const merged = Object.fromEntries(
      Object.keys(germanMessages).map((area) => [
        area,
        {
          ...inherited?.[area as keyof ShopventoMessages],
          ...messages?.[area as keyof ShopventoMessages],
        },
      ]),
    ) as ShopventoCatalogue;
    return {
      /** Messages for locale. */
      locale: language /** Messages for messages. */,
      messages: resolveMessages(language, merged),
    };
  }, [locale, messages, parent]);
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
/** Read the locale belonging to the current render. */
export function useShopventoLocale(): LocaleValue {
  return useContext(LocaleContext);
}
function translator(
  table: Record<string, string>,
  overrides?: Partial<Record<string, string>>,
) {
  return (key: string, ...args: unknown[]) =>
    (overrides?.[key] ?? table[key] ?? key).replace(
      /\{(\d+)\}/g,
      (match, index: string) =>
        Number(index) < args.length ? String(args[Number(index)]) : match,
    );
}
/** Translate an area in React; legacy labels remain the final per-key override. */
export function useMessages(
  area: keyof ShopventoMessages,
  overrides?: Partial<Record<string, string>>,
) {
  return translator(useShopventoLocale().messages[area], overrides);
}
/** Translate pure helpers with an explicit per-call locale. */
export function getMessages(
  area: keyof ShopventoMessages,
  options: LocaleOptions = {},
  overrides?: Partial<Record<string, string>>,
) {
  return translator(
    resolveArea(area, options.locale ?? "de", options.messages),
    overrides,
  );
}
/** Format euro cents without changing authoritative server amounts. */
export function localeMoney(cents: number, locale = "de") {
  return new Intl.NumberFormat(locale, {
    /** Messages for style. */
    style: "currency",
    /** Messages for currency. */
    currency: "EUR",
  }).format(cents / 100);
}
/** Format a calendar date in UTC unless the caller supplies another time zone. */
export function localeDate(
  date: string | Date,
  locale = "de",
  options: Intl.DateTimeFormatOptions = {},
) {
  const value =
    typeof date === "string"
      ? new Date(date.length === 10 ? `${date}T12:00:00Z` : date)
      : date;
  return new Intl.DateTimeFormat(locale, {
    /** Messages for timeZone. */
    timeZone: "UTC",
    /** Messages for day. */
    day: "2-digit",
    /** Messages for month. */
    month: "2-digit",
    /** Messages for year. */
    year: "numeric",
    ...options,
  }).format(value);
}
/** Format a wall-clock time, with the historic Uhr suffix for German. */
export function localeTime(
  time: string,
  locale = "de",
  options: {
    /** Include the catalogue-owned time suffix, German Uhr by default. */
    suffix?: boolean;
    /** Per-render host overrides for the time suffix. */
    messages?: ShopventoCatalogue;
  } = {},
) {
  const valid = /^(?:[01]\d|2[0-3]):[0-5]\d/.test(time);
  const value = valid
    ? new Intl.DateTimeFormat(locale, {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(`2000-01-01T${time.slice(0, 5)}:00Z`))
    : time;
  return (
    value +
    (options.suffix === false
      ? ""
      : getMessages("forms", { locale, messages: options.messages })(" Uhr"))
  );
}
function dateOrder(locale: string): ("day" | "month" | "year")[] {
  return new Intl.DateTimeFormat(locale, {
    /** Messages for day. */
    day: "2-digit",
    /** Messages for month. */
    month: "2-digit",
    /** Messages for year. */
    year: "numeric",
    /** Messages for timeZone. */
    timeZone: "UTC",
  })
    .formatToParts(new Date("2001-11-22T12:00:00Z"))
    .filter((p) => ["day", "month", "year"].includes(p.type))
    .map((p) => p.type as "day" | "month" | "year");
}
/** Display the exact numeric input order accepted by this locale. */
export function dateInputPlaceholder(locale = "de") {
  return locale.toLowerCase().startsWith("de")
    ? "TT.MM.JJJJ"
    : dateOrder(locale)
        .map(
          (p) =>
            ({
              /** Messages for day. */
              day: "DD" /** Messages for month. */,
              month: "MM" /** Messages for year. */,
              year: "YYYY",
            })[p],
        )
        .join("/");
}
/** Native input validation follows the same numeric order as the date parser. */
export function dateInputPattern(locale = "de") {
  return locale.toLowerCase().startsWith("de")
    ? "[0-9]{2}[.][0-9]{2}[.][0-9]{4}"
    : `(${dateOrder(locale)
        .map((part) => (part === "year" ? "[0-9]{4}" : "[0-9]{2}"))
        .join("/")}|[0-9]{4}-[0-9]{2}-[0-9]{2})`;
}
/** Parse a strict local numeric date; non-German inputs also accept ISO dates. */
export function parseLocaleDate(value: string, locale = "de"): string {
  let iso = "";
  if (
    !locale.toLowerCase().startsWith("de") &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  )
    iso = value;
  else {
    const de = locale.toLowerCase().startsWith("de");
    const match = (
      de
        ? /^(\d{2})\.(\d{2})\.(\d{4})$/
        : new RegExp(
            `^${dateOrder(locale)
              .map((part) => (part === "year" ? "(\\d{4})" : "(\\d{2})"))
              .join("/")}$`,
          )
    ).exec(value);
    if (!match)
      throw new Error(
        getMessages("forms", { locale })(
          "Bitte gib das Datum als {0} ein.",
          dateInputPlaceholder(locale),
        ),
      );
    const fields = Object.fromEntries(
      (de ? ["day", "month", "year"] : dateOrder(locale)).map((key, index) => [
        key,
        match[index + 1],
      ]),
    );
    iso = `${fields.year}-${fields.month}-${fields.day}`;
  }
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== iso
  )
    throw new Error(
      getMessages("forms", { locale })("Bitte gib ein gültiges Datum ein."),
    );
  return iso;
}
/** Format a stored ISO date for an editable local numeric input. */
export function formatLocaleDateInput(iso: string, locale = "de") {
  if (!iso) return "";
  const parts = {
    /** Messages for year. */
    year: iso.slice(0, 4),
    /** Messages for month. */
    month: iso.slice(5, 7),
    /** Messages for day. */
    day: iso.slice(8, 10),
  };
  return (
    locale.toLowerCase().startsWith("de")
      ? ["day", "month", "year"]
      : dateOrder(locale)
  )
    .map((p) => parts[p as keyof typeof parts])
    .join(locale.toLowerCase().startsWith("de") ? "." : "/");
}
/** Mask a local numeric date, retaining complete ISO input for non-German locales. */
export function maskLocaleDate(value: string, locale = "de") {
  if (!locale.toLowerCase().startsWith("de") && /^\d{4}-/.test(value))
    return value.slice(0, 10);
  const de = locale.toLowerCase().startsWith("de");
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const fields = de ? ["day", "month", "year"] : dateOrder(locale);
  let offset = 0;
  return fields
    .map((part) => {
      const length = part === "year" ? 4 : 2;
      const field = digits.slice(offset, offset + length);
      offset += length;
      return field;
    })
    .filter(Boolean)
    .join(de ? "." : "/");
}

/** Confirm a valid typed date using a written month; incomplete dates have no preview. */
export function dateInputConfirmation(value: string, locale = "de") {
  try {
    return localeDate(parseLocaleDate(value, locale), locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
