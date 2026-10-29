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
import { Turnstile } from "./turnstile";
export interface FlowDraft {
  windowId: string;
  seats: Seat[];
  contact: GuestContact;
  notes: string;
  codes: string[];
  updated: number;
}
export function bookingDraftKey(installation: string, location: number) {
  return `vv:booking:v2:${installation}:${location}`;
}
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
export interface BookingTexts {
  withdrawal: string;
  minimum: string;
  reschedule: string;
  notesHint?: string;
  phone?: string;
  phoneLabel?: string;
  groupUrl?: string;
  address?: string;
  voucher?: string;
  intolerance?: string;
}
export function LegalNotes({
  minAge,
  texts,
  review = false,
  heading = true,
  overview = false,
}: {
  minAge?: number;
  texts: BookingTexts;
  review?: boolean;
  heading?: boolean;
  overview?: boolean;
}) {
  const items: Array<{
    icon: "id" | "calendar" | "users" | "gift" | "alert";
    title: string;
    text: string;
  }> = [
    ...(minAge != null
      ? [
          {
            icon: "id" as const,
            title: `Ab ${minAge} Jahren`,
            text: `Teilnahme ab ${minAge} Jahren. Mit der Buchung bestätigst Du, dass alle Gäste mindestens ${minAge} Jahre alt sind.`,
          },
        ]
      : []),
    { icon: "users", title: "Mindestzahl Gäste", text: texts.minimum },
    {
      icon: "calendar",
      title: "Fester Termin, kein Widerruf",
      text: `${texts.withdrawal} ${texts.reschedule}`,
    },
    ...(overview && texts.voucher
      ? [
          {
            icon: "gift" as const,
            title: "Gutscheine einlösen",
            text: texts.voucher,
          },
        ]
      : []),
    ...(overview && texts.intolerance
      ? [
          {
            icon: "alert" as const,
            title: "Wünsche und besondere Hinweise",
            text: texts.intolerance,
          },
        ]
      : []),
  ];
  return (
    <div className={overview ? "good-to-know" : "legal"}>
      {heading && <h3>{review ? "Bevor Du buchst" : "Gut zu wissen"}</h3>}
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
export function normalizeBookingPhone(value: string, prefix: string) {
  const clean = value
    .replace(/\(0\)/g, "")
    .replace(/[\s().-]/g, "")
    .replace(/^00/, "+");
  return clean.startsWith("+") ? clean : prefix + clean.replace(/^0/, "");
}
export function voucherProblem(
  check: VoucherCheck,
  eventId: number,
  locationId: number | null | undefined,
) {
  if (check.redeemed) return "Dieser Gutschein wurde bereits eingelöst.";
  if (check.remaining_value !== undefined && check.remaining_value <= 0)
    return "Dieser Gutschein hat kein Guthaben mehr.";
  if (
    check.redeemable_tasting_ids?.length &&
    !check.redeemable_tasting_ids.includes(eventId)
  )
    return "Dieser Gutschein gilt nicht für diesen Termin.";
  if (
    check.redeemable_location_ids?.length &&
    (locationId == null || !check.redeemable_location_ids.includes(locationId))
  )
    return "Dieser Gutschein gilt nicht für diesen Standort.";
  return null;
}
export function bookingVoucherAllocation(
  seatPrices: readonly number[],
  orderedCodes: readonly string[],
  checks: Readonly<Record<string, VoucherCheck>>,
) {
  const remaining = [...seatPrices];
  const deductions = orderedCodes.map((code) => ({ code, amount: 0 }));
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
  return { deductions, pending, amountToPay };
}
/** Bound untrusted URL input before placing it in a controlled text field. */
export function voucherCodeFromQuery(value: string | null | undefined): string {
  return value &&
    !/[\r\n]/.test(value) &&
    /^[A-Za-z0-9][A-Za-z0-9 _./+?&=-]{0,99}$/.test(value)
    ? value
    : "";
}
export interface BookingFlowProps {
  labels?: Partial<BookingLabels>;
  initialVoucherCode?: string;

  client: BookingClient;
  data: CalendarInput;
  draftKey: string;
  step: number;
  onStep: (step: number) => void;
  calendarUrl: string;
  loginUrl: string;
  accountClient?: AccountClient;
  onAuthenticated?: () => void;
  accountReturnPath?: string;
  successUrl: string;
  termsUrl: string;
  privacyUrl: string;
  siteKey?: string;
  profile?: AccountProfile | null;
  sessionLoading?: boolean;
  texts: BookingTexts;
  image?: string;
  onReloadAvailability?: () => void;
  onSignOut?: () => void | Promise<void>;
  countryCodes?: readonly string[];
  format?: BookingFormat;
  colors?: EventColors;
  onRedirect?: (url: string) => void;
}
export function BookingFlow({
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
  const copy = mergeBookingLabels(labels);
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
            } else issues[c] = bookingErrorMessage(e);
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
    return <p role="status">Deine Auswahl wird geladen.</p>;
  if (!draft)
    return (
      <div className="empty">
        <h1>Noch nichts ausgewählt</h1>
        <p>Such Dir zuerst einen Termin aus.</p>
        <a className="btn btn-primary" href={calendarUrl}>
          Zu den Terminen
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
        <h1>Termin nicht mehr verfügbar</h1>
        <p>
          Deine Angaben haben wir behalten. Wähle bitte einen anderen Termin.
        </p>
        <a className="btn btn-primary" href={calendarUrl}>
          Anderen Termin wählen
        </a>
      </div>
    );
  const max = Math.min(data.settings.guest_max_seats ?? 8, w.free_spots || 1);
  const a = availability(w, count, lead);
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
        ? "Bitte melde Dich an oder wähle die Buchung als Gast."
        : "Bitte melde Dich an, um die Buchung fortzusetzen.";
      return e;
    }
    if (!contact.first_name.trim())
      e.first_name = "Bitte gib Deinen Vornamen ein.";
    if (!contact.last_name.trim())
      e.last_name = "Bitte gib Deinen Nachnamen ein.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email))
      e.email = "Bitte gib eine gültige E-Mail-Adresse ein.";
    if (
      draft.contact.phone &&
      !/^\+[1-9][0-9]{6,14}$/.test(
        normalizeBookingPhone(draft.contact.phone, countryCode),
      )
    )
      e.phone = "Bitte gib eine gültige Telefonnummer ein.";
    return e;
  };
  const seatErrors = () => {
    const e: Record<string, string> = {};
    if (!a.bookable)
      e.seats = "Bitte wähle einen Termin mit genügend freien Plätzen.";
    if (
      draft.seats.some(
        (s) =>
          s.variant_id && !variants.some((v) => v.variant_id === s.variant_id),
      )
    )
      e.seats =
        "Eine gewählte Variante ist nicht mehr verfügbar. Bitte wähle die Plätze erneut.";
    if (mode === "paused") e.seats = "Online-Buchung ist gerade pausiert.";
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
      e.code =
        "Bitte löse den eingetragenen Gutschein ein oder leere das Feld.";
    if (checking) e.code = "Deine Gutscheine werden gerade geprüft.";
    if (draft.codes.some((c) => voucherIssues[c]))
      e.code = "Bitte prüfe Deine Gutscheine.";
    if (draft.codes.length > count)
      e.code =
        "Du kannst auf der aktuellen Buchung höchstens einen Gutschein pro Platz verwenden.";
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
      setErrors({ code: "Bitte gib Deinen Gutscheincode ein." });
      return;
    }
    if (draft.codes.includes(entered)) {
      setErrors({ code: "Dieser Gutschein ist schon hinzugefügt." });
      return;
    }
    if (draft.codes.length >= count) {
      setErrors({ code: "Jeder Platz hat schon einen Gutschein." });
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
      );
      if (problem) {
        setErrors({ code: problem });
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
        code:
          e instanceof Error && e.message === "used"
            ? "Dieser Gutschein wurde bereits eingelöst."
            : bookingErrorMessage(e),
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
      e.consent = "Bitte bestätige die Bedingungen und den Datenschutz.";
    if (!profile && !guestAllowed) e.account = "Bitte melde Dich an.";
    if (!profile && !token)
      e.security = "Bitte bestätige die Sicherheitsprüfung.";
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
      <h2>Bitte prüf Deine Angaben</h2>
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
      <p>Deine Angaben bleiben erhalten.</p>
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
                {n} × {variants.length > 1 ? v.variant_name : "Platz"}
              </span>
              <span>{bookingMoney(n * v.price, format)}</span>
            </div>
          )
        );
      })}
      {allocation.deductions.map(({ code, amount }) => (
        <div key={code}>
          <span>Gutschein {code}</span>
          <span>
            {!checks[code] || checks[code].pending
              ? "Wird bei der Buchung geprüft"
              : amount > 0
                ? `−${bookingMoney(amount, format)}`
                : "Für diese Buchung nicht benötigt"}
          </span>
        </div>
      ))}
      {allocation.pending && (
        <p className="hint">
          {draft.codes.length}{" "}
          {draft.codes.length === 1 ? "Gutschein" : "Gutscheine"}. Den
          Restbetrag bestätigt Stripe nach der verbindlichen Gutscheinprüfung.
        </p>
      )}
      <div className="grand">
        <span>{allocation.pending ? "Höchstens zu zahlen" : "Zu zahlen"}</span>
        <strong>{bookingMoney(allocation.amountToPay, format)}</strong>
      </div>
      <p className="hint">
        inkl. MwSt. · {count} {count === 1 ? "Platz" : "Plätze"}
      </p>
    </div>
  );
  const summary = (
    <div className="card summary">
      <div className="su-head">
        {image && <img className="su-ph" src={image} alt="" />}
        <div>
          <p className="eyebrow">Deine Auswahl</p>
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
            <span>{bookingTime(w)}</span>
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
        <h1>Bitte prüfe Deine Buchung</h1>
        <p>{submission.error}</p>
        <p>Buchungsnummer: {submission.result.order_number}</p>
      </div>
    );
  return (
    <>
      <a className="back" href={calendarUrl}>
        ‹ Alle Termine
      </a>
      <p className="eyebrow">Buchung</p>
      <ol className="progress" aria-label="Fortschritt">
        {["Plätze", "Deine Daten", "Prüfen & buchen"].map((label, i) => (
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
        ))}
      </ol>
      <div className="book-layout">
        <div>
          <h1 className="display h2" ref={heading} tabIndex={-1}>
            {step === 1 ? (
              <>
                Wie viele <em>Plätze?</em>
              </>
            ) : step === 2 ? (
              <>
                Deine <em>Daten</em>
              </>
            ) : (
              <>
                Prüfen und <em>buchen</em>
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
                {conflict ? "Gerade war jemand schneller." : a.text}
              </strong>
              {conflict && <p>{a.text}</p>}
              <p>Deine Angaben haben wir behalten.</p>
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
                  Plätze anpassen
                  {a.state === "short"
                    ? `: Auf ${w.free_spots} ${w.free_spots === 1 ? "Platz" : "Plätze"} reduzieren`
                    : ""}
                </button>
              )}
              <button
                type="button"
                className="btn-link"
                onClick={() => setChangingDate(true)}
              >
                Anderen Termin wählen
              </button>
              {texts.phone && (
                <a href={`tel:${texts.phone}`}>Telefonisch anfragen</a>
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
                    <h2>Termin</h2>
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
                          {bookingTime(w)} · {location?.location_street}
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
                      <BookingIcon name="calendar" /> Termin ändern
                    </button>
                  </section>
                  <section className="block" id="f-seats">
                    <h2>Plätze</h2>
                    {variants.length > 1 && (
                      <p>
                        Wähl für jeden Platz die Variante. Ihr könnt gemischt
                        buchen.
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
                            <p>{bookingMoney(v.price, format)} pro Person</p>
                            <SeatStepper
                              label={
                                variants.length > 1
                                  ? (v.variant_name ?? "Variante")
                                  : "Plätze"
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
                                    seats: "Wähle mindestens einen Platz.",
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
                      Bis zu {data.settings.guest_max_seats ?? 8} Plätze pro
                      Buchung.{" "}
                      {texts.groupUrl && (
                        <a href={texts.groupUrl}>
                          Mehr Personen? Frag uns als Gruppe an.
                        </a>
                      )}
                    </p>
                  </section>
                  <section className="block">
                    <h2>
                      Gutschein <small>(optional)</small>
                    </h2>
                    <p>
                      Mehrere Codes nacheinander eingeben. Aktuell ein Gutschein
                      pro Platz.
                    </p>
                    {mode === "voucher" && missingVouchers > 0 && (
                      <p className="hint" role="status">
                        {copy.eventVoucherMissing(missingVouchers)}
                      </p>
                    )}
                    {rateLimited.length > 0 && (
                      <p className="hint" role="status">
                        Bitte warte kurz. Wir prüfen Deine Gutscheine beim
                        Bezahlen verbindlich.{" "}
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
                          In einer Minute erneut prüfen
                        </button>
                      </p>
                    )}
                    <div className="code-field">
                      <label className="sr-only" htmlFor="f-code">
                        Gutscheincode
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
                        {checking ? "Prüfen" : "Einlösen"}
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
                                    ? `Wertgutschein, ${bookingMoney(checks[c].remaining_value ?? 0, format)} von ${bookingMoney(checks[c].value ?? checks[c].remaining_value ?? 0, format)} Guthaben`
                                    : "Prüfen und verrechnen wir beim Bezahlen.")}
                            </small>
                          </span>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Gutschein ${c} entfernen`}
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
                    <h2>Wer bucht?</h2>
                    {profile ? (
                      <div className="signed-in">
                        <strong>
                          {contact.first_name} {contact.last_name}
                        </strong>
                        <p>{contact.email}</p>
                        <p>Die Buchung landet in Deinem Konto.</p>
                        {onSignOut && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => void onSignOut()}
                          >
                            Nicht Du? Abmelden
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
                                Anmelden
                              </a>
                              {guestAllowed && (
                                <button
                                  type="button"
                                  className="btn-link"
                                  onClick={() => setWho("guest")}
                                >
                                  Als Gast fortfahren
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {who === "guest" && guestAllowed && (
                          <div className="form-grid two">
                            {(
                              [
                                ["first_name", "Vorname", "given-name"],
                                ["last_name", "Nachname", "family-name"],
                                ["email", "E-Mail-Adresse", "email"],
                                ["phone", "Telefon (optional)", "tel-national"],
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
                                        aria-label="Ländervorwahl"
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
                                      ? "Hierhin schicken wir Bestätigung, Ticket und den Link zu Deiner Buchung."
                                      : key === "phone"
                                        ? "Nur für kurzfristige Änderungen am Termin."
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
                      Hinweis für uns <small>(optional)</small>
                    </h2>
                    <label className="sr-only" htmlFor="f-notes">
                      Hinweis für uns
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
                    <h2 className="sr-only">Deine Angaben</h2>
                    {[
                      [
                        "Termin",
                        `${bookingDate(w.date, false, format.locale)}, ${bookingTime(w)} · ${location?.location_street ?? location?.location_name ?? ""}`,
                        1,
                      ],
                      [
                        "Plätze",
                        variants.length === 1
                          ? `${count} ${count === 1 ? "Platz" : "Plätze"}`
                          : variants
                              .map(
                                (v) =>
                                  `${draft.seats.filter((s) => (s.variant_id ?? null) === (v.variant_id ?? null)).length} × ${v.variant_name ?? "Platz"}`,
                              )
                              .filter((s) => !s.startsWith("0 ×"))
                              .join(", "),
                        1,
                      ],
                      ...(draft.codes.length
                        ? [["Gutscheine", draft.codes.join(", "), 1]]
                        : []),
                      [
                        "Kontakt",
                        `${contact.first_name} ${contact.last_name}, ${contact.email}`,
                        2,
                      ],
                      ...(draft.notes ? [["Hinweis", draft.notes, 2]] : []),
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
                          Ändern<span className="sr-only">: {label}</span>
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
                        Ich akzeptiere die{" "}
                        <a href={termsUrl} target="_blank" rel="noreferrer">
                          AGB
                        </a>{" "}
                        und habe die{" "}
                        <a href={privacyUrl} target="_blank" rel="noreferrer">
                          Datenschutzerklärung
                        </a>{" "}
                        gelesen.
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
                            Die Sicherheitsprüfung ist nicht eingerichtet.
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
                        ? "Einen Moment"
                        : "Zahlungspflichtig buchen"}
                    </button>
                    <p className="pay-note">
                      {draft.codes.length
                        ? "Deine Gutscheine werden verbindlich geprüft. Ist alles gedeckt, wird nichts abgebucht."
                        : "Im nächsten Schritt bezahlst Du sicher über Stripe."}
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
                      Zurück
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
                      ? "Weiter zu Deinen Daten"
                      : "Weiter zur Übersicht"}{" "}
                    <BookingIcon name="arrow" />
                  </button>
                </div>
              )}
            </fieldset>
          </form>
        </div>
        <aside className="book-aside desk-only" aria-label="Deine Auswahl">
          {summary}
          {step < 3 && (
            <LegalNotes minAge={data.settings.min_customer_age} texts={texts} />
          )}
        </aside>
      </div>
      {changingDate && (
        <BookingDialog
          title="Termin ändern"
          onClose={() => setChangingDate(false)}
        >
          <p>Plätze, Gutscheine und Deine Daten bleiben erhalten.</p>
          <DateList
            windows={data.windows.filter(
              (candidate) =>
                candidate.tasting_id === w.tasting_id &&
                availability(candidate, count, lead).bookable,
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
          <a href={calendarUrl}>Alle Termine ansehen</a>
        </BookingDialog>
      )}
      {showSummary && (
        <BookingDialog
          title="Deine Auswahl"
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
            aria-label="Deine Auswahl anzeigen"
          >
            <strong>
              {allocation.pending && "Höchstens "}
              {bookingMoney(allocation.amountToPay, format)}
            </strong>
            <p>
              {count} {count === 1 ? "Platz" : "Plätze"} ·{" "}
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
            Weiter
          </button>
        </div>
      )}
    </>
  );
}
