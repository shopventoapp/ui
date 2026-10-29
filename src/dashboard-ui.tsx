"use client";
import qrcode from "qrcode-generator";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { AccountApiError, accountErrorMessage } from "./account-client";
import { BookingIcon, bookingDate, bookingMoney } from "./calendar";
import type { AccountEntry } from "./dashboard-state";
/** Host-owned account nouns and optional age/birth date hints. */
export interface AccountLabels {
  /** Event in the account labels contract. */
  event: string;
  /** Preferred public event collection. */
  events: string;
  /** Event voucher in the account labels contract. */
  eventVoucher: string;
  /** Event voucher singular in the account labels contract. Optional; omitted unless supplied by the host or backend. */
  eventVoucherSingular?: string;
  /** Host-mapped product presentation data. */
  product: string;
  /** Products in the account labels contract. */
  products: string;
  /** Pickup in the account labels contract. */
  pickup: string;
  /** Voucher use in the account labels contract. */
  voucherUse: string;
  /** Newsletter adapter or host newsletter terminology. */
  newsletter: string;
  /** Age hint in the account labels contract. Optional; omitted unless supplied by the host or backend. */
  ageHint?: string;
  /** Birth date hint in the account labels contract. Optional; omitted unless supplied by the host or backend. */
  birthDateHint?: string;
}
/** Host routes used by dashboard navigation and detail links. */
export interface AccountRoutes {
  /** Use the overview legal-notes presentation. */
  overview: string;
  /** Bookings in the account routes contract. */
  bookings: string;
  /** Vouchers in the account routes contract. */
  vouchers: string;
  /** Authoritative public installation flags and booking limits. */
  settings: string;
  /** Preferred public event collection. */
  events: string;
  /** Shop in the account routes contract. */
  shop: string;
  /** Reserve in the account routes contract. */
  reserve: string;
  /** Password set in the account routes contract. */
  passwordSet: string;
}
/** Host-owned contact and location information displayed in account help. */
export interface AccountHelp {
  /** Host contact phone number or customer international phone field. */
  phone: string;
  /** Customer-visible phone link label. */
  phoneLabel: string;
  /** Email in the account help contract. */
  email: string;
  /** Address in the account help contract. */
  address: string;
  /** Host directions link. */
  routeUrl: string;
  /** Hours in the account help contract. Optional; omitted unless supplied by the host or backend. */
  hours?: string;
}
/** Format an account date for German display. */
export const accountDate = (date: string) => bookingDate(date.slice(0, 10));
/** Load a cancellable account resource when its host dependencies change.
 * @param load - Cancellable async resource loader.
 * @param dependencies - Host dependency values that reload the resource. Defaults to []. */
export function useAccountResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  dependencies: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const previousDependencies = useRef<unknown[] | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Caller supplies stable resource dependencies.
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError(null);
    if (
      !previousDependencies.current ||
      dependencies.some(
        (value, index) =>
          !Object.is(value, previousDependencies.current?.[index]),
      )
    )
      setData(null);
    previousDependencies.current = dependencies;
    load(c.signal)
      .then((v) => {
        if (!c.signal.aborted) setData(v);
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(
            e instanceof AccountApiError && e.status === 404
              ? "Diesen Eintrag gibt es in diesem Konto nicht (mehr)."
              : accountErrorMessage(e),
          );
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [...dependencies, revision]);
  return {
    /** Loaded authoritative data, or null while unavailable. */
    data,
    /** Customer-visible error, or null. */
    error,
    /** Whether the read is pending. */
    loading,
    /** Reload the resource from its authoritative API. */
    reload: () => setRevision((n) => n + 1),
  };
}
/** Render loading, error, retry or empty account state. */
export function AccountState({
  loading,
  error,
  retry,
  empty,
}: {
  /** Whether an asynchronous read is pending. Optional; omitted unless supplied by the host or backend. */
  loading?: boolean;
  /** Customer-visible error or error presentation flag. Optional; omitted unless supplied by the host or backend. */
  error?: string | null;
  /** Retry a failed read. Optional; omitted unless supplied by the host or backend. */
  retry?: () => void;
  /** Customer-visible empty state message. Optional; omitted unless supplied by the host or backend. */
  empty?: string;
}) {
  return (
    <div className="card card-pad empty" role={error ? "alert" : "status"}>
      {loading ? (
        <>
          <div className="skeleton" />
          <p>Deine Daten werden geladen...</p>
        </>
      ) : (
        <>
          <p>{error ?? empty}</p>
          {error && (
            <button className="btn" type="button" onClick={retry}>
              Erneut versuchen
            </button>
          )}
        </>
      )}
    </div>
  );
}
/** Render a dashboard page title with optional lead and back navigation. */
export function AccountHead({
  title,
  accent,
  lead,
  back,
  eyebrow = "Mein Konto",
}: {
  /** Customer-visible heading or title supplied by the host. */
  title: string;
  /** Optional accented heading text. Optional; omitted unless supplied by the host or backend. */
  accent?: string;
  /** Optional introduction. Optional; omitted unless supplied by the host or backend. */
  lead?: string;
  /** Back-link label and URL pair. Optional; omitted unless supplied by the host or backend. */
  back?: [string, string];
  /** Short host-supplied heading context.
   * @defaultValue "Mein Konto" */
  eyebrow?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new page title must receive focus after settings navigation.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <header className="page-head">
      {back && (
        <a className="back" href={back[0]}>
          ‹ {back[1]}
        </a>
      )}
      <p className="eyebrow">{eyebrow}</p>
      <h1 ref={ref} tabIndex={-1} className="display h1">
        {title}
        {accent && (
          <>
            {" "}
            <em>{accent}</em>
          </>
        )}
      </h1>
      {lead && <p className="lead">{lead}</p>}
    </header>
  );
}
/** Group account content under a title. */
export function AccountCard({
  title,
  children,
}: {
  /** Customer-visible heading or title supplied by the host. */
  title: string;
  /** Host-supplied child content. */
  children: ReactNode;
}) {
  return (
    <section className="card card-pad stack">
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  );
}
/** Render the installation contact and directions. */
export function AccountHelpCard({
  help,
}: {
  /** Host contact, opening hours and directions. */
  help: AccountHelp;
}) {
  return (
    <AccountCard title="Hilfe & Kontakt">
      <p className="small muted">
        Fragen zu Deiner Bestellung oder Buchung? Ruf an oder schreib uns.
      </p>
      <a href={`tel:${help.phone}`}>{help.phoneLabel}</a>
      <a href={`mailto:${help.email}`}>{help.email}</a>
      {help.hours && <p className="small muted">{help.hours}</p>}
    </AccountCard>
  );
}
/** Encode the supplied ticket, pickup or voucher code locally as an accessible QR graphic. */
export function AccountQr({
  code,
  label,
}: {
  /** Ticket, pickup or voucher code encoded locally. */
  code: string;
  /** Accessible customer-visible label. */
  label: string;
}) {
  const qr = qrcode(0, "M");
  qr.addData(code);
  qr.make();
  const n = qr.getModuleCount();
  let path = "";
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.isDark(y, x)) path += `M${x} ${y}h1v1h-1z`;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`-4 -4 ${n + 8} ${n + 8}`}
      shapeRendering="crispEdges"
    >
      <title>{label}</title>
      <rect x={-4} y={-4} width={n + 8} height={n + 8} fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
}
/** Render a native modal account sheet with focus containment and restoration. */
export function AccountSheet({
  title,
  children,
  onClose,
}: {
  /** Customer-visible heading or title supplied by the host. */
  title: string;
  /** Host-supplied child content. */
  children: ReactNode;
  /** Close the modal in host state. */
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => trigger?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={id}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="sheet-inner">
        <div className="sheet-head">
          <h2 id={id} className="display h3">
            {title}
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Schließen"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="3" y1="3" x2="11" y2="11" />
              <line x1="11" y1="3" x2="3" y2="11" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
/** Display a live countdown until the supplied timestamp. */
export function AccountCountdown({
  target,
}: {
  /** Countdown target in Unix milliseconds. */
  target: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const minutes = Math.max(0, Math.floor((target - now) / 60000));
  return (
    <div className="countdown">
      <span className="eyebrow">Noch</span>
      <span className="cd-line">
        <span className="cd-num">{Math.floor(minutes / 1440)}</span>
        <span className="cd-unit">
          {Math.floor(minutes / 1440) === 1 ? "Tag" : "Tage"}
        </span>
      </span>
      <span className="cd-sub">
        und {Math.floor((minutes % 1440) / 60)} Std. {minutes % 60} Min.
      </span>
    </div>
  );
}
/** Render a normalized account activity row with host labels and routes. */
export function AccountEntryRow({
  entry,
  routes,
  labels,
}: {
  /** Normalized account activity to display. */
  entry: AccountEntry;
  /** Host-owned account routes. */
  routes: AccountRoutes;
  /** Host-owned copy overrides or account terminology. */
  labels: AccountLabels;
}) {
  const label =
    entry.type === "tastings"
      ? labels.event
      : entry.type === "reservierungen"
        ? "Tisch"
        : "Bestellung";
  return (
    <li>
      <a className="row" href={`${routes.bookings}/${entry.id}`}>
        <span
          className={`date-tile t-${entry.type === "tastings" ? "event t-tasting" : entry.type === "reservierungen" ? "table" : "order"}`}
          aria-hidden="true"
        >
          {entry.type === "bestellungen" ? (
            <BookingIcon name="gift" />
          ) : (
            <>
              <span className="d">{entry.date.slice(8, 10)}</span>
              <span className="m">
                {new Intl.DateTimeFormat("de-DE", {
                  month: "short",
                  timeZone: "UTC",
                }).format(new Date(`${entry.date.slice(0, 10)}T12:00:00Z`))}
              </span>
            </>
          )}
        </span>
        <span className="r-main">
          <span className="r-type">
            <span className="tag">{label}</span>
            <span className="tiny muted code">{entry.number}</span>
          </span>
          <span className="r-title">{entry.title}</span>
          <span className="r-sub">
            {accountDate(entry.date)}
            {entry.type !== "bestellungen" &&
              `, ${entry.date.slice(11, 16)} Uhr`}
          </span>
        </span>
        <span className="r-side">
          <span className={`pill ${entry.tone}`}>{entry.status}</span>
          {entry.amount !== undefined && (
            <span className="r-amount">{bookingMoney(entry.amount)}</span>
          )}
        </span>
        <span className="chev">›</span>
      </a>
    </li>
  );
}
