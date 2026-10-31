"use client";
import { useEffect, useRef, useState } from "react";
import type { AccountClient, AccountProfile } from "./account-client";
import { AccountAccess } from "./account-entry";
import { type BookingLabels, mergeBookingLabels } from "./booking-labels";
import { writeBookingResult } from "./booking-storage";
import {
  AvailabilityBadge,
  availability,
  BookingDialog,
  type BookingFormat,
  BookingIcon,
  BookingModeNotice,
  bookingDate,
  bookingMode,
  bookingMoney,
  bookingTime,
  type CalendarInput,
  DateList,
  DateTile,
  type EventColors,
  eventsFrom,
  SeatStepper,
} from "./calendar";
import {
  BookingApiError,
  type BookingClient,
  bookingErrorMessage,
  type GuestContact,
  type Seat,
  type VoucherCheck,
} from "./client";
import { useSubmitBooking } from "./hooks";
import {
  getMessages,
  type LocaleOptions,
  ShopventoProvider,
  useMessages,
  useShopventoLocale,
} from "./locale";
import { Turnstile } from "./turnstile";
/** Tab-scoped booking draft. Phone, consent and challenge tokens are not persisted. */
export interface FlowDraft {
  /** Backend timewindow identifier, not the materialized row ID. */
  windowId: string;
  /** Booked places, or requested seat count depending on the signature. */
  seats: Seat[];
  /** Guest contact fields. */
  contact: GuestContact;
  /** Optional booking notes, subject to the component and backend limits. */
  notes: string;
  /** Voucher codes in submission order. */
  codes: string[];
  /** Last update as Unix milliseconds. */
  updated: number;
}
/** Build an installation- and location-scoped storage key for a multi-step draft.
 * @param installation - Installation supplied by the host.
 * @param location - Selected installation location. */
export function bookingDraftKey(installation: string, location: number) {
  return `vv:booking:v2:${installation}:${location}`;
}
/** Read a valid booking draft less than 24 hours old; return null for invalid or unavailable storage.
 * @param key - Key supplied by the host. */
export function readFlowDraft(key: string): FlowDraft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (
      d &&
      typeof d.windowId === "string" &&
      Array.isArray(d.seats) &&
      d.seats.length > 0 &&
      d.seats.length <= 1000 &&
      d.seats.every(
        (s: Seat) =>
          s &&
          typeof s === "object" &&
          (s.variant_id === undefined || typeof s.variant_id === "string"),
      ) &&
      typeof d.notes === "string" &&
      Array.isArray(d.codes) &&
      d.codes.every((c: unknown) => typeof c === "string") &&
      d.contact &&
      ["first_name", "last_name", "email"].every(
        (k) => typeof d.contact[k] === "string",
      ) &&
      Number.isFinite(d.updated) &&
      Date.now() - d.updated < 86400000
    )
      return d;
  } catch {
    /* Storage can be unavailable. */
  }
  return null;
}
/** Persist a flow draft without phone, consent or security tokens.
 * @param key - Key supplied by the host.
 * @param draft - Draft supplied by the host. */
export function writeFlowDraft(key: string, draft: FlowDraft) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        ...draft,
        contact: { ...draft.contact, phone: undefined },
      }),
    );
  } catch {
    /* The flow still works in memory. */
  }
}
/** Start a date and seat selection while retaining permitted contact and notes.
 * @param key - Key supplied by the host.
 * @param windowId - Backend timewindow identifier, not the materialized row ID.
 * @param seats - Booked places, or requested seat count depending on the signature.
 * @param variantId - Variant id supplied by the host. */
export function startFlowDraft(
  key: string,
  windowId: string,
  seats: number,
  variantId?: string | null,
) {
  const old = readFlowDraft(key);
  const d: FlowDraft = {
    windowId,
    seats: Array.from({ length: seats }, () =>
      variantId ? { variant_id: variantId } : {},
    ),
    contact: old?.contact ?? { first_name: "", last_name: "", email: "" },
    notes: old?.notes ?? "",
    codes: old?.codes ?? [],
    updated: Date.now(),
  };
  writeFlowDraft(key, d);
  return d;
}
/** Host-owned legal and editorial text displayed during booking. */
export interface BookingTexts {
  /** Withdrawal in the booking texts contract. */
  withdrawal: string;
  /** Minimum in the booking texts contract. */
  minimum: string;
  /** Reschedule in the booking texts contract. */
  reschedule: string;
  /** Notes hint in the booking texts contract. Optional; omitted unless supplied by the host or backend. */
  notesHint?: string;
  /** Host contact phone number or customer international phone field. Optional; omitted unless supplied by the host or backend. */
  phone?: string;
  /** Customer-visible phone link label. Optional; omitted unless supplied by the host or backend. */
  phoneLabel?: string;
  /** Group url in the booking texts contract. Optional; omitted unless supplied by the host or backend. */
  groupUrl?: string;
  /** Address in the booking texts contract. Optional; omitted unless supplied by the host or backend. */
  address?: string;
  /** Authoritative customer voucher. Optional; omitted unless supplied by the host or backend. */
  voucher?: string;
  /** Intolerance in the booking texts contract. Optional; omitted unless supplied by the host or backend. */
  intolerance?: string;
}
/** Render host-supplied legal notes and the runtime minimum age. */
export function LegalNotes({
  minAge,
  texts,
  review = false,
  heading = true,
  overview = false,
}: {
  /** Runtime minimum age supplied by the backend. Optional; omitted unless supplied by the host or backend. */
  minAge?: number;
  /** Host-owned legal and editorial booking copy. */
  texts: BookingTexts;
  /** Use the booking review presentation.
   * @defaultValue false */
  review?: boolean;
  /** Show the legal-notes heading.
   * @defaultValue true */
  heading?: boolean;
  /** Use the overview legal-notes presentation.
   * @defaultValue false */
  overview?: boolean;
}) {
  const text = useMessages("booking");

  const items: Array<{
    /** Availability icon name. */
    icon: "id" | "calendar" | "users" | "gift" | "alert";
    title: string;

    /** Customer-visible German availability message. */
    text: string;
  }> = [
    ...(minAge != null
      ? [
          {
            /** Availability icon name. */
            icon: "id" as const,
            title: text("Ab {0} Jahren", minAge),

            /** Customer-visible German availability message. */
            text: text(
              "Teilnahme ab {0} Jahren. Mit der Buchung bestätigst Du, dass alle Gäste mindestens {1} Jahre alt sind.",
              minAge,
              minAge,
            ),
          },
        ]
      : []),
    {
      /** Availability icon name. */
      icon: "users",
      title: text("Mindestzahl Gäste"),
      /** Customer-visible German availability message. */
      text: texts.minimum,
    },
    {
      /** Availability icon name. */
      icon: "calendar",
      title: text("Fester Termin, kein Widerruf"),

      /** Customer-visible German availability message. */
      text: `${texts.withdrawal} ${texts.reschedule}`,
    },
    ...(overview && texts.voucher
      ? [
          {
            /** Availability icon name. */
            icon: "gift" as const,
            title: text("Gutscheine einlösen"),

            /** Customer-visible German availability message. */
            text: texts.voucher,
          },
        ]
      : []),
    ...(overview && texts.intolerance
      ? [
          {
            /** Availability icon name. */
            icon: "alert" as const,
            title: text("Wünsche und besondere Hinweise"),

            /** Customer-visible German availability message. */
            text: texts.intolerance,
          },
        ]
      : []),
  ];
  return (
    <div className={overview ? "good-to-know" : "legal"}>
      {heading && (
        <h3>
          {review ? text("Bevor Du buchst") : text(text("Gut zu wissen"))}
        </h3>
      )}
      {overview ? (
        items.map((item) => (
          <div className="gtk-item" key={item.title}>
            <span className="gi">
              <BookingIcon name={item.icon} />
            </span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </div>
        ))
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.title}>
              <BookingIcon name={item.icon} />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
/** Normalize a host-supplied international dialing prefix and phone input.
 * @param value - Current controlled value.
 * @param prefix - International dialing prefix supplied by the host. */
export function normalizeBookingPhone(value: string, prefix: string) {
  const clean = value
    .replace(/\(0\)/g, "")
    .replace(/[\s().-]/g, "")
    .replace(/^00/, "+");
  return clean.startsWith("+") ? clean : prefix + clean.replace(/^0/, "");
}
/** Explain whether a checked voucher is depleted or inapplicable to the event or location.
 * @param check - Public result of checking one voucher.
 * @param eventId - Public event identifier used to select variants and availability.
 * @param locationId - Positive installation location identifier used to filter availability. */
export function voucherProblem(
  check: VoucherCheck,
  eventId: number,
  locationId: number | null | undefined,
  options: LocaleOptions = {},
) {
  const text = getMessages("booking", options);

  if (check.redeemed) return text("Dieser Gutschein wurde bereits eingelöst.");
  if (check.remaining_value !== undefined && check.remaining_value <= 0)
    return text("Dieser Gutschein hat kein Guthaben mehr.");
  if (
    check.redeemable_tasting_ids?.length &&
    !check.redeemable_tasting_ids.includes(eventId)
  )
    return text("Dieser Gutschein gilt nicht für diesen Termin.");
  if (
    check.redeemable_location_ids?.length &&
    (locationId == null || !check.redeemable_location_ids.includes(locationId))
  )
    return text("Dieser Gutschein gilt nicht für diesen Standort.");
  return null;
}
/** Apply checked event vouchers to assigned seats, then value vouchers in submission order. Backend totals remain authoritative.
 * @param seatPrices - Per-seat prices in integer cents.
 * @param orderedCodes - Voucher codes in submission order.
 * @param checks - Public lookup results keyed by voucher code. */
export function bookingVoucherAllocation(
  seatPrices: readonly number[],
  orderedCodes: readonly string[],
  checks: Readonly<Record<string, VoucherCheck>>,
) {
  const remaining = [...seatPrices];
  const deductions = orderedCodes.map((code) => ({
    /** Voucher code used for this deduction. */
    code,
    /** Amount deducted in integer cents. */
    amount: 0,
  }));
  let pending = false;
  for (const [index, code] of orderedCodes.entries()) {
    const check = checks[code];
    if (!check || check.pending) {
      pending = true;
      continue;
    }
    if (check.kind === "SINGLE_PURPOSE") {
      const amount = Math.min(
        Math.max(0, check.remaining_value ?? 0),
        remaining[index] ?? 0,
      );
      deductions[index].amount = amount;
      if (index < remaining.length) remaining[index] -= amount;
    }
  }
  for (const [index, code] of orderedCodes.entries()) {
    const check = checks[code];
    if (!check || check.pending || check.kind === "SINGLE_PURPOSE") continue;
    let balance = Math.max(0, check.remaining_value ?? 0);
    for (let seat = 0; seat < remaining.length && balance > 0; seat++) {
      const amount = Math.min(balance, remaining[seat]);
      remaining[seat] -= amount;
      balance -= amount;
      deductions[index].amount += amount;
    }
  }
  let amountToPay = remaining.reduce((sum, amount) => sum + amount, 0);
  if (amountToPay > 0 && amountToPay < 50) {
    // Release value-voucher funding in reverse order for Stripe's minimum charge.
    for (
      let index = deductions.length - 1;
      index >= 0 && amountToPay < 50;
      index--
    ) {
      if (checks[deductions[index].code]?.kind === "SINGLE_PURPOSE") continue;
      const released = Math.min(deductions[index].amount, 50 - amountToPay);
      deductions[index].amount -= released;
      amountToPay += released;
    }
  }
  return {
    /** Deductions returned by bookingVoucherAllocation. */
    deductions,
    /** Whether booking submission is in progress. */
    pending,
    /** Amount to pay returned by bookingVoucherAllocation. */
    amountToPay,
  };
}
/** Bound untrusted URL input before placing it in a controlled text field. */
export function voucherCodeFromQuery(value: string | null | undefined): string {
  return value &&
    !/[\r\n]/.test(value) &&
    /^[A-Za-z0-9][A-Za-z0-9 _./+?&=-]{0,99}$/.test(value)
    ? value
    : "";
}
/** Host routing, session, availability and copy needed by the multi-step booking flow. */
export interface BookingFlowProps extends LocaleOptions {
  /** Host-owned copy overrides or account terminology. Optional; omitted unless supplied by the host or backend. */
  labels?: Partial<BookingLabels>;
  /** Optional prefilled voucher code; still checked by the backend. Optional; omitted unless supplied by the host or backend. */
  initialVoucherCode?: string;

  /** Stable client instance used for API requests. */
  client: BookingClient;
  /** Fresh events, windows, settings and locations supplied by the host. */
  data: CalendarInput;
  /** Installation- and location-scoped sessionStorage key. */
  draftKey: string;
  /** Current host-owned booking step. */
  step: number;
  /** Navigate to the requested host-owned booking step. */
  onStep: (step: number) => void;
  /** Host calendar route. */
  calendarUrl: string;
  /** Host sign-in route. */
  loginUrl: string;
  /** Account client in the booking flow props contract. Optional; omitted unless supplied by the host or backend. */
  accountClient?: AccountClient;
  /** Refresh the host session after successful authentication. Optional; omitted unless supplied by the host or backend. */
  onAuthenticated?: () => void;
  /** Safe host account return path.
   * @defaultValue "/konto" */
  accountReturnPath?: string;
  /** Host route for accepted booking results. */
  successUrl: string;
  /** Host terms and conditions URL. */
  termsUrl: string;
  /** Host privacy policy URL. */
  privacyUrl: string;
  /** Public Turnstile site key; never pass the private secret. Optional; omitted unless supplied by the host or backend. */
  siteKey?: string;
  /** Authoritative authenticated profile; null represents a guest. Optional; omitted unless supplied by the host or backend. */
  profile?: AccountProfile | null;
  /** Session loading in the booking flow props contract. Optional; omitted unless supplied by the host or backend. */
  sessionLoading?: boolean;
  /** Host-owned legal and editorial booking copy. */
  texts: BookingTexts;
  /** Host image URL. Optional; omitted unless supplied by the host or backend. */
  image?: string;
  /** Reload authoritative availability after a seat conflict. Optional; omitted unless supplied by the host or backend. */
  onReloadAvailability?: () => void;
  /** Perform the host sign-out action. Optional; omitted unless supplied by the host or backend. */
  onSignOut?: () => void | Promise<void>;
  /** Allowed international dialing prefixes.
   * @defaultValue [] */
  countryCodes?: readonly string[];
  /** Optional locale and currency formatting settings.
   * @defaultValue {} */
  format?: BookingFormat;
  /** Optional CSS colors keyed by event identifier.
   * @defaultValue {} */
  colors?: EventColors;
  /** Navigate to a validated checkout URL; defaults to window.location.assign.
   * @defaultValue Host browser navigation. */
  onRedirect?: (url: string) => void;
}
/** Render the host-routed booking steps with account access, vouchers, review and submission. */
function BookingFlowContent({
  labels,
  initialVoucherCode,
  client,
  data,
  draftKey,
  step,
  onStep,
  calendarUrl,
  loginUrl,
  accountClient,
  onAuthenticated,
  accountReturnPath = "/konto",
  successUrl,
  termsUrl,
  privacyUrl,
  siteKey,
  profile,
  sessionLoading,
  texts,
  image,
  onReloadAvailability,
  onSignOut,
  countryCodes = [],
  format = {},
  colors = {},
  onRedirect = (url) => window.location.assign(url),
}: BookingFlowProps) {
  const options = useShopventoLocale();
  format = { ...format, locale: format.locale ?? options.locale };

  const text = useMessages("booking");

  const copy = mergeBookingLabels(labels, options);
  const [changingDate, setChangingDate] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [draft, setDraft] = useState<FlowDraft | null>(null);
  const [restored, setRestored] = useState(false);
  const [code, setCode] = useState(() =>
    voucherCodeFromQuery(initialVoucherCode),
  );
  const [checking, setChecking] = useState(false);
  const voucherCache = useRef<Record<string, VoucherCheck>>({});
  const voucherRateLimits = useRef(new Set<string>());
  const [retryChecks, setRetryChecks] = useState(0);
  const [rateLimited, setRateLimited] = useState<string[]>([]);
  const pendingFocus = useRef<string | null>(null);
  const [checks, setChecks] = useState<Record<string, VoucherCheck>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [securityRevision, setSecurityRevision] = useState(0);
  const [who, setWho] = useState("account");
  const [countryCode, setCountryCode] = useState(countryCodes[0] ?? "");
  const previousStep = useRef(step);
  const [focusErrors, setFocusErrors] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [voucherIssues, setVoucherIssues] = useState<Record<string, string>>(
    {},
  );
  const errorBox = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const submission = useSubmitBooking(
    client,
    onRedirect,
    ["checkout.stripe.com"],
    (response) => {
      const w = data.windows.find((w) => w.timewindow_id === draft?.windowId);
      const t = eventsFrom(data).find((t) => t.tasting_id === w?.tasting_id);
      const location = data.locations.find(
        (l) => l.id === w?.franchise_location_id,
      );
      if (draft && w && t)
        writeBookingResult(draftKey, {
          window: w,
          title: t.tasting_name,
          location,
          order_number: response.order_number,
          guestEmail: profile ? undefined : draft.contact.email,
          seatCount: draft.seats.length,
          updated: Date.now(),
        });
    },
    (error) => {
      if (
        error instanceof BookingApiError &&
        [400, 409].includes(error.status)
      ) {
        const detail = typeof error.detail === "string" ? error.detail : "";
        setConflict(
          /(nicht genügend|nicht genug|nur noch|ausgebucht|freie[nr]? Plätze|Platz frei|Plätze zur Zahlung reserviert)/iu.test(
            detail,
          ) && !/gutschein/iu.test(detail),
        );
        onReloadAvailability?.();
      }
      setFocusErrors((n) => n + 1);
    },
  );
  useEffect(() => {
    voucherCache.current = {};
    voucherRateLimits.current.clear();
    setRateLimited([]);
    setDraft(readFlowDraft(draftKey));
    setRestored(true);
  }, [draftKey]);
  useEffect(() => {
    if (draft) writeFlowDraft(draftKey, draft);
  }, [draft, draftKey]);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus();
    if (pendingFocus.current && !sessionLoading && restored) {
      const field = document.getElementById(pendingFocus.current);
      if (field) {
        field.focus();
        pendingFocus.current = null;
      }
    }
    previousStep.current = step;
    setConsent(false);
    setToken("");
  }, [step, restored, sessionLoading]);
  useEffect(() => {
    if (focusErrors) errorBox.current?.focus();
  }, [focusErrors]);
  useEffect(() => () => voucherRequest.current?.abort(), []);
  const restoredCodes = draft?.codes;
  const voucherRequest = useRef<AbortController | null>(null);
  const restoredWindow = data.windows.find(
    (candidate) => candidate.timewindow_id === draft?.windowId,
  );
  useEffect(() => {
    if (bookingMode(data.settings) !== "full") setWho("account");
  }, [data.settings]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry rechecks unknown or failed voucher results.
  useEffect(() => {
    if (!restoredCodes || !restoredWindow) return;
    const controller = new AbortController();
    voucherRequest.current?.abort();
    voucherRequest.current = controller;
    if (!restoredCodes.length) {
      voucherRequest.current = null;
      setChecking(false);
      setChecks({});
      setVoucherIssues({});
      setRateLimited([]);
      return;
    }
    const unknown = restoredCodes.filter((c) => !voucherCache.current[c]);
    setChecking(unknown.length > 0);
    const validate = async () => {
      const results: Record<string, VoucherCheck> = {},
        issues: Record<string, string> = {};
      const limited: string[] = [];
      await Promise.all(
        restoredCodes.map(async (c) => {
          try {
            const result =
              voucherCache.current[c] ??
              (await client.checkVoucher(c, controller.signal));
            if (controller.signal.aborted) return;
            voucherCache.current[c] = result;
            results[c] = result;
            if (voucherRateLimits.current.has(c)) limited.push(c);
            const issue = voucherProblem(
              result,
              restoredWindow.tasting_id,
              restoredWindow.franchise_location_id,
              options,
            );
            if (issue) issues[c] = issue;
          } catch (e) {
            if (e instanceof BookingApiError && e.status === 404) {
              results[c] = { voucher_code: c, pending: true };
              if (!controller.signal.aborted)
                voucherCache.current[c] = results[c];
            } else if (e instanceof BookingApiError && e.status === 429) {
              results[c] = { voucher_code: c, pending: true };
              if (!controller.signal.aborted) {
                voucherCache.current[c] = results[c];
                voucherRateLimits.current.add(c);
              }
              limited.push(c);
            } else issues[c] = bookingErrorMessage(e, options);
          }
        }),
      );
      if (!controller.signal.aborted) {
        setRateLimited(limited);
        setChecks(results);
        setVoucherIssues(issues);
        voucherRequest.current = null;
        setChecking(false);
      }
    };
    void validate();
    return () => {
      controller.abort();
      if (voucherRequest.current === controller) {
        voucherRequest.current = null;
        setChecking(false);
      }
    };
  }, [restoredCodes, restoredWindow, client, retryChecks]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A different date clears the previous booking rejection.
  useEffect(() => {
    setConflict(false);
    setErrors({});
    submission.clearError();
  }, [draft?.windowId, submission.clearError]);
  const update = (patch: Partial<FlowDraft>) =>
    setDraft((d) => (d ? { ...d, ...patch, updated: Date.now() } : d));
  if (!restored || sessionLoading)
    return <p role="status">{text("Deine Auswahl wird geladen.")}</p>;
  if (!draft)
    return (
      <div className="empty">
        <h1>{text("Noch nichts ausgewählt")}</h1>
        <p>{text("Such Dir zuerst einen Termin aus.")}</p>
        <a className="btn btn-primary" href={calendarUrl}>
          {text("Zu den Terminen")}
        </a>
      </div>
    );
  const w = data.windows.find((w) => w.timewindow_id === draft.windowId);
  const variants = eventsFrom(data).filter(
    (t) => t.tasting_id === w?.tasting_id,
  );
  const lead = data.settings.online_lead_hours ?? 24;
  const count = draft.seats.length;
  if (!w || !variants.length)
    return (
      <div className="notice">
        <h1>{text("Termin nicht mehr verfügbar")}</h1>
        <p>
          {text(
            "Deine Angaben haben wir behalten. Wähle bitte einen anderen Termin.",
          )}
        </p>
        <a className="btn btn-primary" href={calendarUrl}>
          {text("Anderen Termin wählen")}
        </a>
      </div>
    );
  const max = Math.min(data.settings.guest_max_seats ?? 8, w.free_spots || 1);
  const a = availability(w, count, lead, Date.now(), options);
  const location = data.locations.find((l) => l.id === w.franchise_location_id);
  const contact = profile
    ? {
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        email: profile.email ?? "",
      }
    : draft.contact;
  const seatPrice = (seat: Seat) =>
    (variants.find((v) => v.variant_id === seat.variant_id) ?? variants[0])
      .price;
  // Share the submit order so tasting vouchers cover exactly their assigned seat.
  const orderedSeats = [...draft.seats].sort(
    (a, b) => seatPrice(b) - seatPrice(a),
  );
  const orderedCodes = [...draft.codes].sort(
    (a, b) =>
      Number(checks[b]?.kind === "SINGLE_PURPOSE") -
      Number(checks[a]?.kind === "SINGLE_PURPOSE"),
  );
  const allocation = bookingVoucherAllocation(
    orderedSeats.map(seatPrice),
    orderedCodes,
    checks,
  );
  const guestAllowed =
    data.settings.guest_booking_enabled && data.settings.direct_booking_enabled;
  const mode = bookingMode(data.settings);
  const direct = data.settings.direct_booking_enabled;
  const contactErrors = () => {
    const e: Record<string, string> = {};
    if (profile) return e;
    if (!guestAllowed || (step === 2 && who === "account")) {
      e.account = guestAllowed
        ? text("Bitte melde Dich an oder wähle die Buchung als Gast.")
        : text("Bitte melde Dich an, um die Buchung fortzusetzen.");
      return e;
    }
    if (!contact.first_name.trim())
      e.first_name = text("Bitte gib Deinen Vornamen ein.");
    if (!contact.last_name.trim())
      e.last_name = text("Bitte gib Deinen Nachnamen ein.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email))
      e.email = text("Bitte gib eine gültige E-Mail-Adresse ein.");
    if (
      draft.contact.phone &&
      !/^\+[1-9][0-9]{6,14}$/.test(
        normalizeBookingPhone(draft.contact.phone, countryCode),
      )
    )
      e.phone = text("Bitte gib eine gültige Telefonnummer ein.");
    return e;
  };
  const seatErrors = () => {
    const e: Record<string, string> = {};
    if (!a.bookable)
      e.seats = text("Bitte wähle einen Termin mit genügend freien Plätzen.");
    if (
      draft.seats.some(
        (s) =>
          s.variant_id && !variants.some((v) => v.variant_id === s.variant_id),
      )
    )
      e.seats = text(
        "Eine gewählte Variante ist nicht mehr verfügbar. Bitte wähle die Plätze erneut.",
      );
    if (mode === "paused")
      e.seats = text("Online-Buchung ist gerade pausiert.");
    if (
      !direct &&
      (draft.codes.length !== count ||
        draft.codes.some(
          (c) =>
            (checks[c]?.kind !== "SINGLE_PURPOSE" && !checks[c]?.pending) ||
            voucherIssues[c],
        ))
    )
      e.code = copy.eventVoucherRequired;
    if (code.trim() && !draft.codes.includes(code.trim()))
      e.code = text(
        "Bitte löse den eingetragenen Gutschein ein oder leere das Feld.",
      );
    if (checking) e.code = text("Deine Gutscheine werden gerade geprüft.");
    if (draft.codes.some((c) => voucherIssues[c]))
      e.code = text("Bitte prüfe Deine Gutscheine.");
    if (draft.codes.length > count)
      e.code = text(
        "Du kannst auf der aktuellen Buchung höchstens einen Gutschein pro Platz verwenden.",
      );
    return e;
  };
  const next = () => {
    const e = step === 1 ? seatErrors() : contactErrors();
    setErrors(e);
    if (Object.keys(e).length) setFocusErrors((n) => n + 1);
    if (!Object.keys(e).length) onStep(step + 1);
  };
  const addCode = async () => {
    if (checking || voucherRequest.current) return;
    const controller = new AbortController();
    const entered = code.trim();
    if (!entered) {
      setErrors({
        /** Voucher code used for this deduction. */
        code: text("Bitte gib Deinen Gutscheincode ein."),
      });
      return;
    }
    if (draft.codes.includes(entered)) {
      setErrors({
        /** Voucher code used for this deduction. */
        code: text("Dieser Gutschein ist schon hinzugefügt."),
      });
      return;
    }
    if (draft.codes.length >= count) {
      setErrors({
        /** Voucher code used for this deduction. */
        code: text("Jeder Platz hat schon einen Gutschein."),
      });
      return;
    }
    voucherRequest.current = controller;
    setChecking(true);
    setErrors({});
    try {
      const check =
        voucherCache.current[entered] ??
        (await client.checkVoucher(entered, controller.signal));
      if (controller.signal.aborted) return;
      const problem = voucherProblem(
        check,
        w.tasting_id,
        w.franchise_location_id,
        options,
      );
      if (problem) {
        setErrors({
          /** Voucher code used for this deduction. */
          code: problem,
        });
        return;
      }
      setVoucherIssues((issues) => {
        const next = { ...issues };
        delete next[entered];
        return next;
      });
      voucherCache.current[entered] = check;
      setChecks((c) => ({ ...c, [entered]: check }));
      update({ codes: [...draft.codes, entered] });
      setCode("");
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof BookingApiError && e.status === 404) {
        const pending = { voucher_code: entered, pending: true };
        voucherCache.current[entered] = pending;
        setChecks((c) => ({ ...c, [entered]: pending }));
        update({ codes: [...draft.codes, entered] });
        setCode("");
        return;
      }
      if (e instanceof BookingApiError && e.status === 429) {
        const pending = { voucher_code: entered, pending: true };
        voucherCache.current[entered] = pending;
        voucherRateLimits.current.add(entered);
        setRateLimited((codes) => [...codes, entered]);
        setChecks((checks) => ({ ...checks, [entered]: pending }));
        update({ codes: [...draft.codes, entered] });
        setCode("");
        return;
      }
      setErrors({
        /** Voucher code used for this deduction. */
        code:
          e instanceof Error && e.message === "used"
            ? text("Dieser Gutschein wurde bereits eingelöst.")
            : bookingErrorMessage(e, options),
      });
    } finally {
      if (voucherRequest.current === controller) {
        voucherRequest.current = null;
        setChecking(false);
      }
    }
  };
  const finish = async () => {
    const e = { ...seatErrors(), ...contactErrors() };
    if (!consent)
      e.consent = text("Bitte bestätige die Bedingungen und den Datenschutz.");
    if (!profile && !guestAllowed) e.account = text("Bitte melde Dich an.");
    if (!profile && !token)
      e.security = text("Bitte bestätige die Sicherheitsprüfung.");
    setErrors(e);
    if (Object.keys(e).length) {
      setFocusErrors((n) => n + 1);
      return;
    }
    const seats = orderedSeats.map((s, i) => ({
      ...s,
      ...(orderedCodes[i] ? { voucher_code: orderedCodes[i] } : {}),
    }));
    const response = await submission.submit(
      {
        timewindow_id: draft.windowId,
        seats,
        contact: {
          ...draft.contact,
          ...contact,
          phone: draft.contact.phone
            ? normalizeBookingPhone(draft.contact.phone, countryCode)
            : undefined,
        },
        notes: draft.notes,
      },
      !profile,
      token,
      consent,
    );
    if (response) {
      if (!response.checkout_url)
        onRedirect(
          `${successUrl}?order_number=${encodeURIComponent(response.order_number)}`,
        );
    } else {
      setToken("");
      setSecurityRevision((n) => n + 1);
    }
  };
  const missingVouchers = Math.max(
    0,
    count -
      draft.codes.filter(
        (c) =>
          (checks[c]?.kind === "SINGLE_PURPOSE" || checks[c]?.pending) &&
          !voucherIssues[c],
      ).length,
  );
  const errorSummary = (Object.keys(errors).length > 0 || submission.error) && (
    <div className="err-summary" ref={errorBox} tabIndex={-1} role="alert">
      <h2>{text("Bitte prüf Deine Angaben")}</h2>
      <ul>
        {Object.entries(errors).map(([key, text]) => (
          <li key={key}>
            <a
              onClick={(event) => {
                const target =
                  key === "seats" || key === "code"
                    ? 1
                    : [
                          "first_name",
                          "last_name",
                          "email",
                          "phone",
                          "account",
                        ].includes(key)
                      ? 2
                      : 3;
                if (
                  ["first_name", "last_name", "email", "phone"].includes(key) &&
                  !profile &&
                  guestAllowed
                )
                  setWho("guest");
                if (target !== step) {
                  event.preventDefault();
                  pendingFocus.current = `f-${key}`;
                  onStep(target);
                }
              }}
              href={
                (key === "seats" || key === "code"
                  ? 1
                  : [
                        "first_name",
                        "last_name",
                        "email",
                        "phone",
                        "account",
                      ].includes(key)
                    ? 2
                    : 3) === step
                  ? `#f-${key}`
                  : `?schritt=${key === "seats" || key === "code" ? 1 : 2}#f-${key}`
              }
            >
              {text}
            </a>
          </li>
        ))}
      </ul>
      {submission.error && (
        <p>
          {/gutschein/iu.test(submission.error) ? (
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                if (step === 1) document.getElementById("f-code")?.focus();
                else {
                  pendingFocus.current = "f-code";
                  onStep(1);
                }
              }}
            >
              {submission.error}
            </button>
          ) : (
            submission.error
          )}
        </p>
      )}
      <p>{text("Deine Angaben bleiben erhalten.")}</p>
    </div>
  );
  const priceLines = (
    <div className="lines">
      {variants.map((v) => {
        const n = draft.seats.filter(
          (s) => (s.variant_id ?? null) === (v.variant_id ?? null),
        ).length;
        return (
          n > 0 && (
            <div key={v.variant_id ?? "base"}>
              <span>
                {n} × {variants.length > 1 ? v.variant_name : text("Platz")}
              </span>
              <span>{bookingMoney(n * v.price, format)}</span>
            </div>
          )
        );
      })}
      {allocation.deductions.map(({ code, amount }) => (
        <div key={code}>
          <span>
            {text("Gutschein ")}
            {code}
          </span>
          <span>
            {!checks[code] || checks[code].pending
              ? text("Wird bei der Buchung geprüft")
              : amount > 0
                ? `−${bookingMoney(amount, format)}`
                : text("Für diese Buchung nicht benötigt")}
          </span>
        </div>
      ))}
      {allocation.pending && (
        <p className="hint">
          {draft.codes.length}{" "}
          {draft.codes.length === 1 ? text("Gutschein") : text("Gutscheine")}
          {text(
            ". Den Restbetrag bestätigt Stripe nach der verbindlichen Gutscheinprüfung.",
          )}
        </p>
      )}
      <div className="grand">
        <span>
          {allocation.pending ? text("Höchstens zu zahlen") : text("Zu zahlen")}
        </span>
        <strong>{bookingMoney(allocation.amountToPay, format)}</strong>
      </div>
      <p className="hint">
        {text("inkl. MwSt. · ")}
        {count} {count === 1 ? text("Platz") : text("Plätze")}
      </p>
    </div>
  );
  const summary = (
    <div className="card summary">
      <div className="su-head">
        {image && <img className="su-ph" src={image} alt="" />}
        <div>
          <p className="eyebrow">{text("Deine Auswahl")}</p>
          <h2 className="su-title">{variants[0].tasting_name}</h2>
        </div>
      </div>
      <div className="su-body">
        <div className="su-meta">
          <span>
            <BookingIcon name="calendar" />
            <span>{bookingDate(w.date, false, format.locale)}</span>
          </span>
          <span>
            <BookingIcon name="clock" />
            <span>{bookingTime(w, options)}</span>
          </span>
          <span>
            <BookingIcon name="pin" />
            <span>
              {location?.location_street}, {location?.location_city}
            </span>
          </span>
        </div>
        {priceLines}
      </div>
    </div>
  );
  if (submission.result && submission.error)
    return (
      <div className="notice" role="alert">
        <h1>{text("Bitte prüfe Deine Buchung")}</h1>
        <p>{submission.error}</p>
        <p>
          {text("Buchungsnummer: ")}
          {submission.result.order_number}
        </p>
      </div>
    );
  return (
    <>
      <a className="back" href={calendarUrl}>
        {text("‹ Alle Termine")}
      </a>
      <p className="eyebrow">{text("Buchung")}</p>
      <ol className="progress" aria-label={text("Fortschritt")}>
        {[text("Plätze"), text("Deine Daten"), text("Prüfen & buchen")].map(
          (label, i) => (
            <li
              key={label}
              className={step === i + 1 ? "now" : step > i + 1 ? "done" : ""}
              aria-current={step === i + 1 ? "step" : undefined}
            >
              {step > i + 1 ? (
                <button type="button" onClick={() => onStep(i + 1)}>
                  {i + 1}. {label}
                </button>
              ) : (
                <span>
                  {i + 1}. {label}
                </span>
              )}
            </li>
          ),
        )}
      </ol>
      <div className="book-layout">
        <div>
          <h1 className="display h2" ref={heading} tabIndex={-1}>
            {step === 1 ? (
              <>
                {text("Wie viele ")}
                <em>{text("Plätze?")}</em>
              </>
            ) : step === 2 ? (
              <>
                {text("Deine ")}
                <em>{text("Daten")}</em>
              </>
            ) : (
              <>
                {text("Prüfen und ")}
                <em>{text("buchen")}</em>
              </>
            )}
          </h1>
          <BookingModeNotice
            settings={data.settings}
            phone={texts.phone}
            phoneLabel={texts.phoneLabel}
            labels={labels}
          />
          {(conflict || !a.bookable) && (
            <div className="notice" role="alert">
              <strong>
                {conflict ? text("Gerade war jemand schneller.") : a.text}
              </strong>
              {conflict && <p>{a.text}</p>}
              <p>{text("Deine Angaben haben wir behalten.")}</p>
              {(w.free_spots ?? 0) > 0 && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    update({
                      seats: draft.seats.slice(
                        0,
                        Math.min(w.free_spots ?? 0, count),
                      ),
                      codes: draft.codes.slice(
                        0,
                        Math.min(w.free_spots ?? 0, count),
                      ),
                    });
                    setConflict(false);
                    setErrors({});
                    submission.clearError();
                    onStep(1);
                  }}
                >
                  {text("Plätze anpassen")}
                  {a.state === "short"
                    ? text(
                        ": Auf {0} {1} reduzieren",
                        w.free_spots,
                        text(w.free_spots === 1 ? "Platz" : "Plätze"),
                      )
                    : ""}
                </button>
              )}
              <button
                type="button"
                className="btn-link"
                onClick={() => setChangingDate(true)}
              >
                {text("Anderen Termin wählen")}
              </button>
              {texts.phone && (
                <a href={`tel:${texts.phone}`}>
                  {text("Telefonisch anfragen")}
                </a>
              )}
            </div>
          )}
          {errorSummary}
          <form
            className="book-main"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 3) next();
              else void finish();
            }}
          >
            <fieldset className="flow-fields" disabled={submission.pending}>
              {step === 1 && (
                <>
                  <section className="block">
                    <h2>{text("Termin")}</h2>
                    <div className="date-summary">
                      <DateTile
                        color={colors[w.tasting_id]}
                        window={w}
                        locale={format.locale}
                      />
                      <div>
                        <strong>
                          {bookingDate(w.date, false, format.locale)}
                        </strong>
                        <p>
                          {bookingTime(w, options)} ·{" "}
                          {location?.location_street}
                        </p>
                        <AvailabilityBadge
                          window={w}
                          seats={count}
                          leadHours={lead}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setChangingDate(true)}
                    >
                      <BookingIcon name="calendar" /> {text(" Termin ändern")}
                    </button>
                  </section>
                  <section className="block" id="f-seats">
                    <h2>{text("Plätze")}</h2>
                    {variants.length > 1 && (
                      <p>
                        {text(
                          "Wähl für jeden Platz die Variante. Ihr könnt gemischt buchen.",
                        )}
                      </p>
                    )}
                    {variants.map((v) => {
                      const quantity = draft.seats.filter(
                        (s) =>
                          (s.variant_id ?? null) === (v.variant_id ?? null),
                      ).length;
                      return (
                        <div className="seat-row" key={v.variant_id ?? "base"}>
                          <div>
                            <p>
                              {bookingMoney(v.price, format)}{" "}
                              {text(" pro Person")}
                            </p>
                            <SeatStepper
                              label={
                                variants.length > 1
                                  ? (v.variant_name ?? text("Variante"))
                                  : text("Plätze")
                              }
                              value={quantity}
                              min={variants.length === 1 ? 1 : 0}
                              max={quantity + Math.max(0, max - count)}
                              onChange={(n) => {
                                const rest = draft.seats.filter(
                                  (s) =>
                                    (s.variant_id ?? null) !==
                                    (v.variant_id ?? null),
                                );
                                const seats = [
                                  ...rest,
                                  ...Array.from({ length: n }, () =>
                                    v.variant_id
                                      ? { variant_id: v.variant_id }
                                      : {},
                                  ),
                                ];
                                if (!seats.length) {
                                  setErrors({
                                    seats: text(
                                      "Wähle mindestens einen Platz.",
                                    ),
                                  });
                                  return;
                                }
                                update({ seats });
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <p className="hint">
                      {text("Bis zu ")}
                      {data.settings.guest_max_seats ?? 8}{" "}
                      {text(" Plätze pro Buchung.")}{" "}
                      {texts.groupUrl && (
                        <a href={texts.groupUrl}>
                          {text("Mehr Personen? Frag uns als Gruppe an.")}
                        </a>
                      )}
                    </p>
                  </section>
                  <section className="block">
                    <h2>
                      {text("Gutschein ")}
                      <small>{text("(optional)")}</small>
                    </h2>
                    <p>
                      {text(
                        "Mehrere Codes nacheinander eingeben. Aktuell ein Gutschein pro Platz.",
                      )}
                    </p>
                    {mode === "voucher" && missingVouchers > 0 && (
                      <p className="hint" role="status">
                        {copy.eventVoucherMissing(missingVouchers)}
                      </p>
                    )}
                    {rateLimited.length > 0 && (
                      <p className="hint" role="status">
                        {text(
                          "Bitte warte kurz. Wir prüfen Deine Gutscheine beim Bezahlen verbindlich.",
                        )}{" "}
                        <button
                          type="button"
                          className="btn-link"
                          disabled={checking}
                          onClick={() => {
                            for (const c of rateLimited) {
                              delete voucherCache.current[c];
                              voucherRateLimits.current.delete(c);
                            }
                            setRetryChecks((n) => n + 1);
                          }}
                        >
                          {text("In einer Minute erneut prüfen")}
                        </button>
                      </p>
                    )}
                    <div className="code-field">
                      <label className="sr-only" htmlFor="f-code">
                        {text("Gutscheincode")}
                      </label>
                      <input
                        className="input"
                        id="f-code"
                        value={code}
                        maxLength={255}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={!!errors.code}
                        aria-describedby={
                          errors.code ? "code-error" : undefined
                        }
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void addCode();
                          }
                        }}
                      />
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={checking || draft.codes.length >= count}
                        onClick={() => void addCode()}
                      >
                        {checking ? text("Prüfen") : text("Einlösen")}
                      </button>
                    </div>
                    {errors.code && (
                      <p id="code-error" className="error-text">
                        {errors.code}
                      </p>
                    )}
                    <ul className="code-list" aria-live="polite">
                      {draft.codes.map((c) => (
                        <li className="code-item" key={c}>
                          <BookingIcon
                            name={voucherIssues[c] ? "alert" : "gift"}
                          />
                          <span>
                            {c}
                            <br />
                            <small>
                              {voucherIssues[c] ??
                                (checks[c]?.kind === "SINGLE_PURPOSE"
                                  ? copy.eventVoucherDescription
                                  : checks[c]?.kind
                                    ? text(
                                        "Wertgutschein, {0} von {1} Guthaben",
                                        bookingMoney(
                                          checks[c].remaining_value ?? 0,
                                          format,
                                        ),
                                        bookingMoney(
                                          checks[c].value ??
                                            checks[c].remaining_value ??
                                            0,
                                          format,
                                        ),
                                      )
                                    : text(
                                        "Prüfen und verrechnen wir beim Bezahlen.",
                                      ))}
                            </small>
                          </span>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={text("Gutschein {0} entfernen", c)}
                            onClick={() => {
                              setVoucherIssues((issues) => {
                                const next = { ...issues };
                                delete next[c];
                                return next;
                              });
                              setErrors({});
                              submission.clearError();
                              setChecks((checks) => {
                                const next = { ...checks };
                                delete next[c];
                                return next;
                              });
                              update({
                                codes: draft.codes.filter((code) => code !== c),
                              });
                              document.getElementById("f-code")?.focus();
                            }}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
              {step === 2 && (
                <>
                  <section className="block">
                    <h2>{text("Wer bucht?")}</h2>
                    {profile ? (
                      <div className="signed-in">
                        <strong>
                          {contact.first_name} {contact.last_name}
                        </strong>
                        <p>{contact.email}</p>
                        <p>{text("Die Buchung landet in Deinem Konto.")}</p>
                        {onSignOut && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => void onSignOut()}
                          >
                            {text("Nicht Du? Abmelden")}
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div id="f-account" tabIndex={-1}>
                          {accountClient ? (
                            <AccountAccess
                              client={accountClient}
                              returnPath={accountReturnPath}
                              onAuthenticated={() => onAuthenticated?.()}
                              onGuest={
                                guestAllowed ? () => setWho("guest") : undefined
                              }
                              termsUrl={termsUrl}
                              privacyUrl={privacyUrl}
                            />
                          ) : (
                            <>
                              <a className="btn btn-primary" href={loginUrl}>
                                {text("Anmelden")}
                              </a>
                              {guestAllowed && (
                                <button
                                  type="button"
                                  className="btn-link"
                                  onClick={() => setWho("guest")}
                                >
                                  {text("Als Gast fortfahren")}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {who === "guest" && guestAllowed && (
                          <div className="form-grid two">
                            {(
                              [
                                ["first_name", text("Vorname"), "given-name"],
                                ["last_name", text("Nachname"), "family-name"],
                                ["email", text("E-Mail-Adresse"), "email"],
                                [
                                  "phone",
                                  text("Telefon (optional)"),
                                  "tel-national",
                                ],
                              ] as const
                            ).map(([key, label, autocomplete]) => (
                              <div
                                className={`field ${key === "email" || key === "phone" ? "span-2" : ""}`}
                                key={key}
                              >
                                <label htmlFor={`f-${key}`}>{label}</label>
                                <div
                                  className={
                                    key === "phone" && countryCodes.length > 0
                                      ? "phone-group"
                                      : undefined
                                  }
                                >
                                  {key === "phone" &&
                                    countryCodes.length > 0 && (
                                      <select
                                        className="select"
                                        aria-label={text("Ländervorwahl")}
                                        value={countryCode}
                                        onChange={(e) =>
                                          setCountryCode(e.target.value)
                                        }
                                      >
                                        {countryCodes.map((prefix) => (
                                          <option key={prefix}>{prefix}</option>
                                        ))}
                                      </select>
                                    )}
                                  <input
                                    id={`f-${key}`}
                                    className="input"
                                    autoComplete={autocomplete}
                                    type={
                                      key === "email"
                                        ? "email"
                                        : key === "phone"
                                          ? "tel"
                                          : "text"
                                    }
                                    maxLength={key === "phone" ? 60 : 200}
                                    value={draft.contact[key] ?? ""}
                                    aria-invalid={!!errors[key]}
                                    aria-describedby={`h-${key}`}
                                    onChange={(e) =>
                                      update({
                                        contact: {
                                          ...draft.contact,
                                          [key]: e.target.value,
                                        },
                                      })
                                    }
                                  />
                                </div>
                                <p
                                  className={
                                    errors[key] ? "error-text" : "hint"
                                  }
                                  id={`h-${key}`}
                                >
                                  {errors[key] ??
                                    (key === "email"
                                      ? text(
                                          "Hierhin schicken wir Bestätigung, Ticket und den Link zu Deiner Buchung.",
                                        )
                                      : key === "phone"
                                        ? text(
                                            "Nur für kurzfristige Änderungen am Termin.",
                                          )
                                        : "")}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                  <section className="block">
                    <h2>
                      {text("Hinweis für uns ")}
                      <small>{text("(optional)")}</small>
                    </h2>
                    <label className="sr-only" htmlFor="f-notes">
                      {text("Hinweis für uns")}
                    </label>
                    <textarea
                      className="textarea"
                      id="f-notes"
                      maxLength={300}
                      value={draft.notes}
                      aria-describedby="notes-hint"
                      onChange={(e) => update({ notes: e.target.value })}
                    />
                    <p id="notes-hint" className="hint">
                      {texts.notesHint} <span>{draft.notes.length}/300</span>
                    </p>
                  </section>
                </>
              )}
              {step === 3 && (
                <>
                  <section className="block">
                    <h2 className="sr-only">{text("Deine Angaben")}</h2>
                    {[
                      [
                        text("Termin"),
                        `${bookingDate(w.date, false, format.locale)}, ${bookingTime(w, options)} · ${location?.location_street ?? location?.location_name ?? ""}`,
                        1,
                      ],
                      [
                        text("Plätze"),
                        variants.length === 1
                          ? `${count} ${count === 1 ? text("Platz") : text("Plätze")}`
                          : variants
                              .map(
                                (v) =>
                                  `${draft.seats.filter((s) => (s.variant_id ?? null) === (v.variant_id ?? null)).length} × ${v.variant_name ?? text("Platz")}`,
                              )
                              .filter((s) => !s.startsWith("0 ×"))
                              .join(", "),
                        1,
                      ],
                      ...(draft.codes.length
                        ? [[text("Gutscheine"), draft.codes.join(", "), 1]]
                        : []),
                      [
                        "Kontakt",
                        `${contact.first_name} ${contact.last_name}, ${contact.email}`,
                        2,
                      ],
                      ...(draft.notes
                        ? [[text("Hinweis"), draft.notes, 2]]
                        : []),
                    ].map(([label, value, target]) => (
                      <div className="seat-row" key={label}>
                        <div>
                          <p className="label">{label}</p>
                          <p>{value}</p>
                        </div>
                        <button
                          className="btn-link"
                          type="button"
                          onClick={() => onStep(Number(target))}
                        >
                          {text("Ändern")}
                          <span className="sr-only">: {label}</span>
                        </button>
                      </div>
                    ))}
                    <div className="mobile-only">{priceLines}</div>
                  </section>
                  <section className="block">
                    <LegalNotes
                      minAge={data.settings.min_customer_age}
                      texts={texts}
                      review
                    />
                    <label className="check">
                      <input
                        id="f-consent"
                        type="checkbox"
                        checked={consent}
                        aria-invalid={!!errors.consent}
                        aria-describedby={
                          errors.consent ? "consent-error" : undefined
                        }
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      <span>
                        {text("Ich akzeptiere die")}{" "}
                        <a href={termsUrl} target="_blank" rel="noreferrer">
                          {text("AGB")}
                        </a>{" "}
                        {text("und habe die")}{" "}
                        <a href={privacyUrl} target="_blank" rel="noreferrer">
                          {text("Datenschutzerklärung")}
                        </a>{" "}
                        {text("gelesen.")}
                      </span>
                    </label>
                    {errors.consent && (
                      <p className="error-text" id="consent-error">
                        {errors.consent}
                      </p>
                    )}
                    <div id="f-security" tabIndex={-1}>
                      {!profile &&
                        (siteKey || data.settings.turnstile_site_key ? (
                          <Turnstile
                            key={securityRevision}
                            siteKey={
                              (data.settings.turnstile_site_key || siteKey) ??
                              ""
                            }
                            onToken={setToken}
                          />
                        ) : (
                          <p role="alert">
                            {text(
                              "Die Sicherheitsprüfung ist nicht eingerichtet.",
                            )}
                          </p>
                        ))}
                      {errors.security && (
                        <p className="error-text">{errors.security}</p>
                      )}
                    </div>
                    <button
                      className="btn btn-primary btn-block"
                      type="submit"
                      disabled={
                        submission.pending ||
                        mode === "paused" ||
                        !a.bookable ||
                        !!submission.result
                      }
                    >
                      {submission.pending
                        ? text("Einen Moment")
                        : text("Zahlungspflichtig buchen")}
                    </button>
                    <p className="pay-note">
                      {draft.codes.length
                        ? text(
                            "Deine Gutscheine werden verbindlich geprüft. Ist alles gedeckt, wird nichts abgebucht.",
                          )
                        : text(
                            "Im nächsten Schritt bezahlst Du sicher über Stripe.",
                          )}
                    </p>
                  </section>
                </>
              )}
              {step < 3 && (
                <div className="btn-row">
                  {step > 1 && (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => onStep(step - 1)}
                    >
                      {text("Zurück")}
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={
                      mode === "paused" ||
                      (step === 1 &&
                        mode === "voucher" &&
                        Object.keys(seatErrors()).length > 0)
                    }
                  >
                    {step === 1
                      ? text("Weiter zu Deinen Daten")
                      : text("Weiter zur Übersicht")}{" "}
                    <BookingIcon name="arrow" />
                  </button>
                </div>
              )}
            </fieldset>
          </form>
        </div>
        <aside
          className="book-aside desk-only"
          aria-label={text("Deine Auswahl")}
        >
          {summary}
          {step < 3 && (
            <LegalNotes minAge={data.settings.min_customer_age} texts={texts} />
          )}
        </aside>
      </div>
      {changingDate && (
        <BookingDialog
          title={text("Termin ändern")}
          onClose={() => setChangingDate(false)}
        >
          <p>{text("Plätze, Gutscheine und Deine Daten bleiben erhalten.")}</p>
          <DateList
            windows={data.windows.filter(
              (candidate) =>
                candidate.tasting_id === w.tasting_id &&
                availability(candidate, count, lead, Date.now(), options)
                  .bookable,
            )}
            events={variants}
            locations={data.locations}
            seats={count}
            leadHours={lead}
            onSelect={(candidate) => {
              update({ windowId: candidate.timewindow_id });
              setChangingDate(false);
            }}
          />
          <a href={calendarUrl}>{text("Alle Termine ansehen")}</a>
        </BookingDialog>
      )}
      {showSummary && (
        <BookingDialog
          title={text("Deine Auswahl")}
          onClose={() => setShowSummary(false)}
        >
          {summary}
          <LegalNotes minAge={data.settings.min_customer_age} texts={texts} />
        </BookingDialog>
      )}
      {step < 3 && (
        <div className="bottom-bar">
          <button
            className="summary-toggle"
            type="button"
            onClick={() => setShowSummary(true)}
            aria-label={text("Deine Auswahl anzeigen")}
          >
            <strong>
              {allocation.pending && text("Höchstens ")}
              {bookingMoney(allocation.amountToPay, format)}
            </strong>
            <p>
              {count} {count === 1 ? text("Platz") : text("Plätze")} ·{" "}
              {bookingDate(w.date, true, format.locale)}
            </p>
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={
              mode === "paused" ||
              (step === 1 &&
                mode === "voucher" &&
                Object.keys(seatErrors()).length > 0)
            }
            onClick={next}
          >
            {text("Weiter")}
          </button>
        </div>
      )}
    </>
  );
}

/** Render BookingFlow in a per-visitor or per-route language scope. */
export function BookingFlow(
  props: Parameters<typeof BookingFlowContent>[0] & LocaleOptions,
) {
  return (
    <ShopventoProvider
      locale={props.locale ?? props.format?.locale}
      messages={props.messages}
    >
      <BookingFlowContent {...props} />
    </ShopventoProvider>
  );
}
