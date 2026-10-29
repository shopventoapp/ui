"use client";
import qrcode from "qrcode-generator";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { AccountApiError, accountErrorMessage } from "./account-client";
import { BookingIcon, bookingDate, bookingMoney } from "./calendar";
import type { AccountEntry } from "./dashboard-state";
export interface AccountLabels {
  event: string;
  events: string;
  eventVoucher: string;
  eventVoucherSingular?: string;
  product: string;
  products: string;
  pickup: string;
  voucherUse: string;
  newsletter: string;
  ageHint?: string;
  birthDateHint?: string;
}
export interface AccountRoutes {
  overview: string;
  bookings: string;
  vouchers: string;
  settings: string;
  events: string;
  shop: string;
  reserve: string;
  passwordSet: string;
}
export interface AccountHelp {
  phone: string;
  phoneLabel: string;
  email: string;
  address: string;
  routeUrl: string;
  hours?: string;
}
export const accountDate = (date: string) => bookingDate(date.slice(0, 10));
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
  return { data, error, loading, reload: () => setRevision((n) => n + 1) };
}
export function AccountState({
  loading,
  error,
  retry,
  empty,
}: {
  loading?: boolean;
  error?: string | null;
  retry?: () => void;
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
export function AccountHead({
  title,
  accent,
  lead,
  back,
  eyebrow = "Mein Konto",
}: {
  title: string;
  accent?: string;
  lead?: string;
  back?: [string, string];
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
export function AccountCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="card card-pad stack">
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  );
}
export function AccountHelpCard({ help }: { help: AccountHelp }) {
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
export function AccountQr({ code, label }: { code: string; label: string }) {
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
export function AccountSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
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
export function AccountCountdown({ target }: { target: number }) {
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
export function AccountEntryRow({
  entry,
  routes,
  labels,
}: {
  entry: AccountEntry;
  routes: AccountRoutes;
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
