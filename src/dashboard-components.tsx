"use client";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import type { AccountProfile } from "./account-client";
import { BookingIcon, bookingMoney } from "./calendar";
import type { AccountVoucher, DashboardClient } from "./dashboard-client";
import {
  accountEntries,
  accountFilters,
  filterEntries,
  historyMoney,
  overviewPriorities,
  voucherActive,
} from "./dashboard-state";
import {
  AccountCard,
  AccountCountdown,
  AccountEntryRow,
  AccountHead,
  type AccountHelp,
  AccountHelpCard,
  type AccountLabels,
  AccountQr,
  type AccountRoutes,
  AccountState,
  accountDate,
  useAccountResource,
} from "./dashboard-ui";
/** Shared authenticated profile, transport, labels, routes and help used by dashboard components. */
export interface DashboardProps {
  /** Stable client instance used for API requests. */
  client: DashboardClient;
  /** Authoritative authenticated profile; null represents a guest. */
  profile: AccountProfile;
  /** Host-owned copy overrides or account terminology. */
  labels: AccountLabels;
  /** Host-owned account routes. */
  routes: AccountRoutes;
  /** Host contact, opening hours and directions. */
  help: AccountHelp;
  /** Resolve an optional event image URL by identifier. Optional; omitted unless supplied by the host or backend. */
  eventImage?: (id: number) => string | undefined;
}
/** Render account navigation, counts, help and host-owned logout around dashboard content. */
export function AccountLayout({
  profile,
  routes,
  active,
  children,
  onLogout,
  help,
  counts = {},
}: {
  /** Authoritative authenticated profile; null represents a guest. */
  profile: AccountProfile;
  /** Host-owned account routes. */
  routes: AccountRoutes;
  /** Active account navigation section. */
  active: "overview" | "bookings" | "vouchers" | "settings";
  /** Host-supplied child content. */
  children: ReactNode;
  /** Perform the host logout action. */
  onLogout: () => void;
  /** Host contact, opening hours and directions. */
  help: AccountHelp;
  /** Optional host-provided navigation counts.
   * @defaultValue {} */
  counts?: Partial<Record<string, number>>;
}) {
  const nav = [
    ["overview", "Übersicht", "Übersicht", "calendar"],
    ["bookings", "Bestellungen & Buchungen", "Buchungen", "id"],
    ["vouchers", "Gutscheine", "Gutscheine", "gift"],
    ["settings", "Konto", "Konto", "users"],
  ] as const;
  const links = (mobile = false) => (
    <ul>
      {nav.map(([key, label, short, icon]) => (
        <li key={key}>
          <a
            href={routes[key]}
            aria-current={active === key ? "page" : undefined}
          >
            <BookingIcon name={icon} />
            <span>{mobile ? short : label}</span>
            {counts[key] ? <span className="count">{counts[key]}</span> : null}
          </a>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="sv-account sv-dashboard">
      <a className="skip-link" href="#account-main">
        Zum Inhalt springen
      </a>
      <div className="account">
        <aside className="account-side">
          <div className="identity">
            <span className="avatar">{profile.first_name?.slice(0, 1)}</span>
            <span>
              <strong>
                {profile.first_name} {profile.last_name}
              </strong>
              <br />
              <span className="tiny muted">{profile.email}</span>
            </span>
          </div>
          <nav className="side-nav" aria-label="Konto">
            {links()}
          </nav>
          <div className="side-card">
            <p>Wir helfen gern:</p>
            <a href={`tel:${help.phone}`}>{help.phoneLabel}</a>
            <br />
            <a href={`mailto:${help.email}`}>{help.email}</a>
            <br />
            <button className="btn-link" type="button" onClick={onLogout}>
              Abmelden
            </button>
          </div>
        </aside>
        <div id="account-main" className="main">
          {children}
        </div>
      </div>
      <nav className="tabbar" aria-label="Konto">
        {links(true)}
      </nav>
    </div>
  );
}
/** Load dashboard orders, bookings and reservations together.
 * @param client - Stable client instance used for API requests. */
export function useDashboardData(client: DashboardClient) {
  const orders = useAccountResource((s) => client.orders(s), [client]);
  const bookings = useAccountResource((s) => client.bookings(s), [client]);
  const reservations = useAccountResource(
    (s) => client.reservations(s),
    [client],
  );
  const vouchers = useAccountResource((s) => client.vouchers(s), [client]);
  return {
    /** List customer orders. Optional signal cancels the read. */
    orders,
    /** List customer event bookings. Optional signal cancels the read. */
    bookings,
    /** List customer table reservations. */
    reservations,
    /** List customer-owned vouchers. */
    vouchers,
    /** Entries returned by useDashboardData. */
    entries: accountEntries(
      orders.data ?? [],
      bookings.data ?? [],
      reservations.data ?? [],
    ),
  };
}
function ModuleState({
  resource,
}: {
  /** Resource in the module state contract. */
  resource: {
    /** Whether an asynchronous read is pending. */
    loading: boolean;
    /** Customer-visible error or error presentation flag. */
    error: string | null;
    /** Reload in the module state contract. */
    reload: () => void;
  };
}) {
  return resource.loading || resource.error ? (
    <AccountState
      loading={resource.loading}
      error={resource.error}
      retry={resource.reload}
    />
  ) : null;
}
/** Render prioritized upcoming account activity with host labels and routes.
 * @param props - Props supplied by the host. */
export function AccountOverview(props: DashboardProps) {
  const { client, profile, labels, routes, help, eventImage } = props;
  const data = useDashboardData(client);
  const priorities = overviewPriorities(data.entries);
  const upcoming = data.entries
    .filter(
      (e) =>
        e.type === "tastings" &&
        e.current &&
        e.booking?.customer_status === "CONFIRMED",
    )
    .sort((a, b) => a.next - b.next);
  const next = upcoming[0];
  const table = data.entries
    .filter((e) => e.type === "reservierungen" && e.current)
    .sort((a, b) => a.next - b.next)[0];
  const active = (data.vouchers.data ?? []).filter(voucherActive);
  const balance = active
    .filter((v) => v.type === "VALUE")
    .reduce((s, v) => s + v.remaining_value, 0);
  const hour = Number(
    new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
  const empty =
    !data.orders.loading &&
    !data.bookings.loading &&
    !data.reservations.loading &&
    !data.entries.length;
  return (
    <>
      <AccountHead
        title={
          empty
            ? "Willkommen,"
            : hour < 11
              ? "Guten Morgen,"
              : hour >= 18
                ? "Guten Abend,"
                : "Hallo,"
        }
        accent={`${profile.first_name ?? ""}.`}
        lead="Hier siehst Du auf einen Blick, was als Nächstes ansteht."
      />
      <div className="ov-grid">
        <div className="stack-lg">
          <ModuleState resource={data.orders} />
          <ModuleState resource={data.bookings} />
          {priorities.length > 0 && (
            <section>
              <div className="section-title">
                <h2>Jetzt wichtig</h2>
                <span className="label">
                  {priorities.length}{" "}
                  {priorities.length === 1 ? "Hinweis" : "Hinweise"}
                </span>
              </div>
              <ul className="todo">
                {priorities.map(({ entry, priority }) => (
                  <li className={`todo-item ${entry.tone}`} key={entry.id}>
                    <span className="ico">
                      <BookingIcon
                        name={
                          priority === 1
                            ? "alert"
                            : priority === 2
                              ? "gift"
                              : "clock"
                        }
                      />
                    </span>
                    <h3>
                      {priority === 2
                        ? `Bestellung ${entry.number} liegt zur Abholung bereit`
                        : priority === 5
                          ? "Widerruf für einzelne Artikel prüfen"
                          : `${entry.status}: ${entry.title}`}
                    </h3>
                    <p>
                      {priority === 2 &&
                      entry.order?.fulfillments.find(
                        (f) => f.status === "PICKUP_READY",
                      )?.pickup_deadline_at
                        ? `Abholen bis ${accountDate(entry.order.fulfillments.find((f) => f.status === "PICKUP_READY")?.pickup_deadline_at ?? "")}`
                        : priority === 5
                          ? "Die Fristen und zulässigen Artikel findest Du in den Details."
                          : "Alle Informationen findest Du in den Details."}
                    </p>
                    <div className="btn-row">
                      <a
                        className="btn btn-ghost"
                        href={`${routes.bookings}/${entry.id}`}
                      >
                        Details
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {next?.booking && (
            <article className="card hero-ticket">
              {eventImage?.(next.booking.tasting_id) && (
                <div
                  className="photo"
                  style={{
                    backgroundImage: `url('${eventImage(next.booking.tasting_id)}')`,
                  }}
                >
                  <AccountCountdown target={next.next} />
                </div>
              )}
              <div className="body">
                <p className="eyebrow">Dein nächstes {labels.event}</p>
                <h2 className="display h3">{next.title}</h2>
                <p>
                  {accountDate(next.date)},{" "}
                  {next.booking.start_time.slice(0, 5)} Uhr ·{" "}
                  {next.booking.participants}{" "}
                  {next.booking.participants === 1 ? "Platz" : "Plätze"}
                </p>
                <div className="btn-row">
                  <a
                    className="btn btn-primary"
                    href={`${routes.bookings}/${next.id}`}
                  >
                    Ticket zeigen
                  </a>
                  <a
                    className="btn-link"
                    href={`${routes.bookings}/${next.id}`}
                  >
                    Details
                  </a>
                </div>
              </div>
            </article>
          )}
          {upcoming.length > 1 && (
            <section>
              <div className="section-title">
                <h2>Weitere Termine</h2>
              </div>
              <ul className="list">
                {upcoming.slice(1).map((entry) => (
                  <AccountEntryRow
                    key={entry.id}
                    entry={entry}
                    routes={routes}
                    labels={labels}
                  />
                ))}
              </ul>
            </section>
          )}
          {empty && (
            <AccountCard title="Wie möchtest Du starten?">
              <a className="btn btn-primary" href={routes.events}>
                {labels.event} buchen
              </a>
              <a className="btn" href={routes.reserve}>
                Tisch reservieren
              </a>
              <a className="btn" href={routes.shop}>
                Im Shop stöbern
              </a>
            </AccountCard>
          )}
        </div>
        <div className="stack-lg">
          <ModuleState resource={data.vouchers} />
          {data.vouchers.data && (
            <AccountCard title="Gutscheine">
              <p className="display balance">{bookingMoney(balance)}</p>
              <p className="muted">
                Guthaben
                {active.some((v) => v.type === "TASTING") && (
                  <>
                    {" "}
                    und {active.filter((v) => v.type === "TASTING").length}{" "}
                    {active.filter((v) => v.type === "TASTING").length === 1
                      ? (labels.eventVoucherSingular ?? "Gutschein")
                      : labels.eventVoucher}
                  </>
                )}
              </p>
              <ul className="history">
                {active.slice(0, 3).map((v) => (
                  <li key={v.id ?? v.voucher_code}>
                    <a href={`${routes.vouchers}/${v.id}`}>
                      {v.article?.title ?? "Gutschein"}
                    </a>
                    <span>{bookingMoney(v.remaining_value)}</span>
                  </li>
                ))}
              </ul>
              <a className="btn btn-ghost" href={routes.vouchers}>
                Alle Gutscheine
              </a>
            </AccountCard>
          )}
          <ModuleState resource={data.reservations} />
          {table && (
            <ul className="list">
              <AccountEntryRow entry={table} routes={routes} labels={labels} />
            </ul>
          )}
          {data.orders.data && (
            <section>
              <div className="section-title">
                <h2>Letzte Bestellungen</h2>
                <a href={`${routes.bookings}?typ=bestellungen`}>Alle</a>
              </div>
              <ul className="list">
                {data.entries
                  .filter((e) => e.type === "bestellungen")
                  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
                  .slice(0, 3)
                  .map((entry) => (
                    <AccountEntryRow
                      key={entry.id}
                      entry={entry}
                      routes={routes}
                      labels={labels}
                    />
                  ))}
              </ul>
            </section>
          )}
          <AccountHelpCard help={help} />
        </div>
      </div>
    </>
  );
}
/** Render bookings, orders and reservations with date and type filters.
 * @param props - Props supplied by the host. */
export function AccountBookings(props: DashboardProps) {
  const { client, labels, routes } = props;
  const data = useDashboardData(client);
  const [filters, setFilters] = useState(accountFilters(""));
  useEffect(() => {
    const sync = () => setFilters(accountFilters(window.location.search));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const change = (key: "zeit" | "typ", value: string) => {
    const q = new URLSearchParams(window.location.search);
    q.set(key, value);
    history.replaceState(null, "", `${window.location.pathname}?${q}`);
    setFilters(accountFilters(q.toString()));
  };
  const pool = data.entries.filter(
    (e) => e.current === (filters.zeit === "aktuell"),
  );
  const list = filterEntries(data.entries, filters.zeit, filters.typ);
  const types = [
    ["alle", "Alle"],
    ["bestellungen", "Bestellungen"],
    ["tastings", labels.events],
    ["reservierungen", "Reservierungen"],
  ];
  let month = "";
  return (
    <>
      <AccountHead
        title="Bestellungen"
        accent="& Buchungen"
        lead={`Shop-Bestellungen, ${labels.event}-Tickets und Tischreservierungen an einem Ort.`}
      />
      <div className="filters">
        <fieldset className="seg" aria-label="Zeitraum">
          {["aktuell", "vergangen"].map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={filters.zeit === v}
              onClick={() => change("zeit", v)}
            >
              {v === "aktuell" ? "Aktuell" : "Vergangen"}
            </button>
          ))}
        </fieldset>
        <fieldset className="chips" aria-label="Art">
          {types.map(([key, label]) => (
            <button
              className="chip"
              type="button"
              key={key}
              aria-pressed={filters.typ === key}
              onClick={() => change("typ", key)}
            >
              {label}
              <span className="n">
                {pool.filter((e) => key === "alle" || e.type === key).length}
              </span>
            </button>
          ))}
        </fieldset>
      </div>
      <div aria-live="polite">
        <ModuleState resource={data.orders} />
        <ModuleState resource={data.bookings} />
        <ModuleState resource={data.reservations} />
        {!list.length &&
          !data.orders.loading &&
          !data.bookings.loading &&
          !data.reservations.loading && (
            <AccountState
              empty={
                filters.zeit === "aktuell"
                  ? "Gerade nichts geplant"
                  : "Noch nichts Vergangenes"
              }
            />
          )}
        <p className="small muted">
          {filters.zeit === "aktuell"
            ? "Sortiert nach dem, was als Nächstes ansteht."
            : "Neueste Einträge zuerst."}
        </p>
        <ul className="list">
          {list.map((entry) => {
            const nextMonth = new Intl.DateTimeFormat("de-DE", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(`${entry.date.slice(0, 10)}T12:00:00Z`));
            const heading = filters.zeit === "vergangen" && month !== nextMonth;
            month = nextMonth;
            return (
              <Fragment key={entry.id}>
                {heading && (
                  <li>
                    <h2 className="label month-label">{nextMonth}</h2>
                  </li>
                )}
                <AccountEntryRow
                  entry={entry}
                  labels={labels}
                  routes={routes}
                />
              </Fragment>
            );
          })}
        </ul>
      </div>
    </>
  );
}
/** Render one customer voucher using host terminology and routes. */
export function AccountVoucherCard({
  voucher: v,
  labels,
  routes,
  detail = false,
}: {
  /** Authoritative customer voucher. */
  voucher: AccountVoucher;
  /** Host-owned copy overrides or account terminology. */
  labels: AccountLabels;
  /** Host-owned account routes. */
  routes: AccountRoutes;
  /** Use the detailed voucher presentation.
   * @defaultValue false */
  detail?: boolean;
}) {
  const body = (
    <>
      <div className="v-top">
        <div>
          <div className="v-kind">
            {v.type === "TASTING"
              ? (labels.eventVoucherSingular ?? "Gutschein")
              : "Wertgutschein"}
          </div>
          <div className="v-title">{v.article?.title ?? "Gutschein"}</div>
        </div>
        {!voucherActive(v) && <span className="v-flag">Eingelöst</span>}
      </div>
      <div>
        <span className="v-amount">
          {bookingMoney(v.remaining_value)}
          <small>von {bookingMoney(v.value)}</small>
        </span>
        <div className="v-bar">
          <i
            style={{
              width: `${v.value > 0 ? Math.min(100, (v.remaining_value / v.value) * 100) : 0}%`,
            }}
          />
        </div>
      </div>
      <div className="v-foot">
        <span className="v-code">{v.voucher_code}</span>
      </div>
    </>
  );
  const className = `voucher ${v.type === "TASTING" ? "k-event" : ""} ${!voucherActive(v) ? "k-done" : ""}`;
  return detail ? (
    <div className={className}>{body}</div>
  ) : (
    <a href={`${routes.vouchers}/${v.id}`} className={className}>
      {body}
    </a>
  );
}
/** Render the authenticated customer voucher list. */
export function AccountVouchers({ client, labels, routes }: DashboardProps) {
  const resource = useAccountResource((s) => client.vouchers(s), [client]);
  const active = (resource.data ?? []).filter(voucherActive),
    done = (resource.data ?? []).filter((v) => !voucherActive(v));
  return (
    <>
      <AccountHead
        title="Deine"
        accent="Gutscheine"
        lead="Guthaben, Codes und Verlauf an einem Ort."
      />
      <ModuleState resource={resource} />
      {resource.data && (
        <>
          <AccountCard title="Verfügbar">
            <p className="display balance">
              {bookingMoney(
                active
                  .filter((v) => v.type === "VALUE")
                  .reduce((s, v) => s + v.remaining_value, 0),
              )}
            </p>
            <p className="muted">
              {active.some((v) => v.type === "VALUE") && (
                <>
                  aus {active.filter((v) => v.type === "VALUE").length}{" "}
                  {active.filter((v) => v.type === "VALUE").length === 1
                    ? "Wertgutschein"
                    : "Wertgutscheinen"}
                </>
              )}
              {active.some((v) => v.type === "TASTING") ? (
                <>
                  {active.some((v) => v.type === "VALUE") ? ", dazu " : ""}
                  {active.filter((v) => v.type === "TASTING").length}{" "}
                  {active.filter((v) => v.type === "TASTING").length === 1
                    ? (labels.eventVoucherSingular ?? "Gutschein")
                    : labels.eventVoucher}
                </>
              ) : (
                <>
                  {active.some((v) => v.type === "VALUE") ? " · " : ""}keine{" "}
                  {labels.eventVoucher}
                </>
              )}
            </p>
          </AccountCard>
          <div className="section-title">
            <h2>Aktiv</h2>
            <span className="label">{active.length}</span>
          </div>
          {!active.length ? (
            <AccountState empty="Noch keine aktiven Gutscheine" />
          ) : (
            <div className="voucher-grid three stack">
              {active.map((v) => (
                <AccountVoucherCard
                  key={v.id ?? v.voucher_code}
                  voucher={v}
                  labels={labels}
                  routes={routes}
                />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <details className="card">
              <summary className="card-pad">Eingelöst ({done.length})</summary>
              <div className="card-pad voucher-grid">
                {done.map((v) => (
                  <AccountVoucherCard
                    key={v.id ?? v.voucher_code}
                    voucher={v}
                    labels={labels}
                    routes={routes}
                  />
                ))}
              </div>
            </details>
          )}
          <div className="section-title">
            <h2>So löst Du ein</h2>
          </div>
          <AccountCard title="Einlösen">
            <p>{labels.voucherUse}</p>
            <p>
              Im Shop und bei der Buchung erscheinen Deine Gutscheine zur
              Auswahl.
            </p>
          </AccountCard>
        </>
      )}
    </>
  );
}
/** Load and render a customer voucher and its usage history by opaque identifier. */
export function AccountVoucherDetail({
  id,
  client,
  labels,
  routes,
  help,
}: DashboardProps & {
  /** Opaque backend identifier or accessible element ID. */
  id: string;
}) {
  const resource = useAccountResource(
    (s) => client.voucher(id, s),
    [client, id],
  );
  const history = useAccountResource(
    (s) => client.voucherHistory(id, s),
    [client, id],
  );
  const [message, setMessage] = useState("");
  const v = resource.data;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(v?.voucher_code ?? "");
      setMessage("Gutscheincode kopiert.");
    } catch {
      setMessage("Kopieren nicht möglich. Bitte markiere den Code.");
    }
  };
  const actions: Record<string, string> = {
    ISSUED: "Ausgestellt",
    PURCHASE: "Gekauft",
    REDEMPTION: "Eingelöst",
    MANUAL_REDEMPTION: "Eingelöst",
    ADD_CREDIT: "Guthaben hinzugefügt",
    RECHARGE: "Guthaben zurückgeladen",
    REFUND: "Gutschrift",
    INVALIDATED: "Gutschein gesperrt",
  };
  return (
    <>
      <AccountHead
        title={v ? bookingMoney(v.remaining_value) : "Dein Gutschein"}
        accent="Guthaben"
        back={[routes.vouchers, "Gutscheine"]}
      />
      <ModuleState resource={resource} />
      {v && (
        <div className="voucher-detail stack">
          <div className="stack">
            <AccountVoucherCard
              voucher={v}
              labels={labels}
              routes={routes}
              detail
            />
            <AccountCard title="Einlösen">
              <div className="pickup-code">
                <div className="qr-box">
                  <AccountQr code={v.voucher_code} label="Gutscheincode" />
                </div>
                <div className="stack">
                  <span className="label">Code</span>
                  <span className="code-big">{v.voucher_code}</span>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={copy}
                  >
                    Kopieren
                  </button>
                </div>
              </div>
              <p className="small muted">{labels.voucherUse}</p>
              {!v.article && (
                <p className="notice">
                  Dieser Gutschein lässt sich gerade nicht online einlösen.
                  Bitte kontaktiere uns.
                </p>
              )}
              <div className="btn-row">
                {voucherActive(v) && v.article && (
                  <a
                    className="btn btn-primary"
                    href={v.type === "TASTING" ? routes.events : routes.shop}
                  >
                    {v.type === "TASTING"
                      ? "Termin wählen"
                      : "Im Shop einlösen"}
                  </a>
                )}
                <a
                  className="btn btn-ghost"
                  href={`/api/shop/vouchers/pdf/${encodeURIComponent(v.voucher_code)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Drucken
                </a>
              </div>
              <p role="status">{message}</p>
            </AccountCard>
          </div>
          <div className="stack">
            <AccountCard title="Details">
              <dl className="kv">
                <dt>Wert</dt>
                <dd>{bookingMoney(v.value)}</dd>
                <dt>Restguthaben</dt>
                <dd>{bookingMoney(v.remaining_value)}</dd>
                <dt>Ausgestellt</dt>
                <dd>{accountDate(v.created_at)}</dd>
              </dl>
              {v.redeemable_for_text && <p>{v.redeemable_for_text}</p>}
            </AccountCard>
            <AccountCard title="Verlauf">
              <ModuleState resource={history} />
              {history.data && (
                <ul className="history">
                  {history.data.map((h) => (
                    <li key={h.id}>
                      <span className="h-what">
                        {actions[h.action] ??
                          (h.amount_cents < 0
                            ? "Eingelöst"
                            : "Guthabenänderung")}
                        {h.source === "STORE"
                          ? " vor Ort"
                          : h.source === "ONLINE"
                            ? " online"
                            : ""}
                      </span>
                      <span
                        className={`h-amt ${h.amount_cents > 0 ? "plus" : ""}`}
                      >
                        {historyMoney(h.amount_cents)}
                      </span>
                      <span className="h-when">
                        {accountDate(h.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AccountCard>
            <AccountHelpCard help={help} />
          </div>
        </div>
      )}
    </>
  );
}
