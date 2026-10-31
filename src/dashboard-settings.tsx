"use client";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  AccountApiError,
  accountBirthDateError,
  accountErrorMessage,
  accountFieldErrors,
  accountPasswordRules,
} from "./account-client";
import {
  accountCountryOption,
  BirthDateInput,
  birthDateFromISO,
  birthDateToISO,
  CountrySelect,
} from "./account-fields";
import { BookingIcon } from "./calendar";
import type { NewsletterAdapter, ShippingAddress } from "./dashboard-client";
import type { DashboardProps } from "./dashboard-components";
import {
  AccountCard,
  AccountHead,
  AccountSheet,
  AccountState,
  useAccountResource,
} from "./dashboard-ui";
import {
  dateInputPlaceholder,
  useMessages,
  useShopventoLocale,
} from "./locale";

const get = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
/** Normalize an account phone field using the host dialing prefix.
 * @param value - Current controlled value.
 * @param prefix - International dialing prefix supplied by the host. */
export function normalizeAccountPhone(value: string, prefix: string) {
  if (!value.trim()) return "";
  if (/[^\d\s()+\-/]/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  const result = value.trim().startsWith("+")
    ? `+${digits}`
    : digits.startsWith("00")
      ? `+${digits.slice(2)}`
      : `${prefix}${digits.replace(/^0+/, "")}`;
  return /^\+[1-9]\d{6,14}$/.test(result) ? result : null;
}
function Field({
  name,
  label,
  value = "",
  type = "text",
  required = false,
  error,
  autoComplete,
}: {
  /** Selected icon or backend name. */
  name: string;
  /** Accessible customer-visible label. */
  label: string;
  /** Current controlled value.
   * @defaultValue "" */
  value?: string | null;
  /** Type in the field contract.
   * @defaultValue "text" */
  type?: string;
  /** Required in the field contract.
   * @defaultValue false */
  required?: boolean;
  /** Customer-visible error or error presentation flag. Optional; omitted unless supplied by the host or backend. */
  error?: string;
  /** Auto complete in the field contract. Optional; omitted unless supplied by the host or backend. */
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        name={name}
        defaultValue={value ?? ""}
        type={type}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <span id={`${id}-error`} className="error-text">
          {error}
        </span>
      )}
    </div>
  );
}
function useSave() {
  const options = useShopventoLocale();

  const text = useMessages("account");

  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => {
    if (Object.keys(fields).length)
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [fields]);
  return {
    form,
    busy,
    error,
    message,
    fields,
    setFields,
    setError,
    run: async (
      fn: () => Promise<unknown>,
      success = text("Gespeichert."),
      errorMessage = (error: unknown) =>
        accountErrorMessage(error, false, undefined, options),
    ) => {
      setBusy(true);
      setError("");
      setMessage("");
      setFields({});
      try {
        await fn();
        setMessage(success);
        return true;
      } catch (e) {
        setFields(accountFieldErrors(e, options));
        setError(errorMessage(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
  };
}
function SaveStatus({
  save,
}: {
  /** Save in the save status contract. */
  save: ReturnType<typeof useSave>;
}) {
  return (
    <>
      {save.error && <p role="alert">{save.error}</p>}
      <p role="status">{save.message}</p>
    </>
  );
}
function Personal({
  minimumAge,
  onChanged,
  ...props
}: DashboardProps & {
  /** Runtime minimum age supplied by the host. */
  minimumAge: number;
  /** Refresh authoritative host data after a successful mutation. */
  onChanged: () => void;
}) {
  const options = useShopventoLocale();

  const text = useMessages("account");

  const { profile, client, labels } = props;
  const save = useSave();
  const [prefix, setPrefix] = useState("+49"),
    [phone, setPhone] = useState(profile.phone ?? "");
  const [birth, setBirth] = useState(
    birthDateFromISO(profile.birth_date, options.locale),
  );
  const id = useId();
  const normalizedPhone = normalizeAccountPhone(phone, prefix);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const errors: Record<string, string> = {};
    const isoBirth = birthDateToISO(birth, options.locale);
    const birthError =
      isoBirth === null
        ? text("Bitte gib ein gültiges Datum im Format TT.MM.JJJJ ein.")
        : accountBirthDateError(isoBirth, minimumAge, undefined, options);
    if (birthError) errors.birth_date = birthError;
    const normalized = normalizeAccountPhone(phone, prefix);
    if (normalized === null)
      errors.phone = text("Bitte gib eine gültige Telefonnummer ein.");
    for (const key of ["first_name", "last_name"])
      if (!get(data, key)) errors[key] = text("Bitte füll dieses Feld aus.");
    save.setFields(errors);
    if (Object.keys(errors).length) {
      save.setError(text("Bitte prüfe Deine Eingaben."));
      setTimeout(
        () => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        0,
      );
      return;
    }
    if (
      await save.run(() =>
        client.updateProfile({
          first_name: get(data, "first_name"),
          last_name: get(data, "last_name"),
          birth_date: isoBirth || null,
          phone: normalized || null,
        }),
      )
    )
      onChanged();
  };
  return (
    <form
      ref={save.form}
      className="card card-pad form"
      noValidate
      onSubmit={submit}
    >
      <div className="form-grid two">
        <Field
          name="first_name"
          label={text("Vorname")}
          value={profile.first_name}
          autoComplete="given-name"
          error={save.fields.first_name}
        />
        <Field
          name="last_name"
          label={text("Nachname")}
          value={profile.last_name}
          autoComplete="family-name"
          error={save.fields.last_name}
        />
        <div className="field">
          <label htmlFor={`${id}-birth-input`}>
            {text("Geburtsdatum (optional)")}
          </label>
          <BirthDateInput
            id={`${id}-birth-input`}
            className="input"
            name="birth_date"
            value={birth}
            onValueChange={setBirth}
            aria-invalid={!!save.fields.birth_date}
            aria-describedby={`${id}-birth-format ${id}-birth`}
          />
          <span id={`${id}-birth-format`} className="hint">
            {text(text("Format: {0}."), dateInputPlaceholder(options.locale))}
          </span>
          <span
            id={`${id}-birth`}
            className={save.fields.birth_date ? "error-text" : "hint"}
          >
            {save.fields.birth_date ??
              labels.birthDateHint ??
              text(
                "Dein Geburtsdatum ist optional. Wenn Du es angibst, muss es das konfigurierte Mindestalter erfüllen.",
              )}
          </span>
        </div>
        <div className="field">
          <label htmlFor={`${id}-phone`}>{text("Telefon (optional)")}</label>
          <div className="phone-group">
            <select
              className="select"
              aria-label={text("Ländervorwahl")}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
            >
              {["+49", "+43", "+41", "+31"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <input
              id={`${id}-phone`}
              className="input"
              type="tel"
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={!!save.fields.phone}
              aria-describedby={`${id}-preview`}
            />
          </div>
          <span id={`${id}-preview`} className="hint">
            {save.fields.phone ??
              (normalizedPhone === ""
                ? ""
                : text(
                    "Wird gespeichert als {0}",
                    normalizedPhone ?? text("bitte prüfen"),
                  ))}
          </span>
        </div>
      </div>
      <SaveStatus save={save} />
      <button className="btn btn-primary" disabled={save.busy} type="submit">
        {text("Speichern")}
      </button>
    </form>
  );
}
function AddressForm({
  address,
  client,
  onDone,
  onClose,
  countries,
}: {
  /** Address in the address form contract. Optional; omitted unless supplied by the host or backend. */
  address?: ShippingAddress;
  /** Stable client instance used for API requests. */
  client: DashboardProps["client"];
  /** On done in the address form contract. */
  onDone: () => void;
  /** Close the modal in host state. */
  onClose: () => void;
  /** Host-configured country values and labels. */
  countries: {
    /** Current controlled value. */
    value: string;
    /** Accessible customer-visible label. */
    label: string;
  }[];
}) {
  const text = useMessages("account");

  const save = useSave();
  const countryId = useId();
  return (
    <AccountSheet
      title={
        address ? text("Lieferadresse ändern") : text("Neue Lieferadresse")
      }
      onClose={onClose}
    >
      <form
        ref={save.form}
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          void save.run(async () => {
            const body = {
              name: get(d, "name"),
              company_name: get(d, "company_name"),
              address1: get(d, "address1"),
              address2: get(d, "address2"),
              postal_code: get(d, "postal_code"),
              city: get(d, "city"),
              country: get(d, "country"),
              phone: get(d, "phone") || null,
              email: address?.email ?? null,
            };
            if (address) await client.updateAddress(address.id, body);
            else await client.createAddress(body);
            onDone();
          });
        }}
      >
        <div className="form-grid two">
          <Field
            name="name"
            label={text("Vor- und Nachname")}
            value={address?.name}
            required
            autoComplete="name"
          />
          <Field
            name="company_name"
            label={text("Firma (optional)")}
            value={address?.company_name}
            autoComplete="organization"
          />
          <Field
            name="address1"
            label={text("Straße und Hausnummer")}
            value={address?.address1}
            error={save.fields.address1}
            required
            autoComplete="address-line1"
          />
          <Field
            name="address2"
            label={text("Adresszusatz (optional)")}
            value={address?.address2}
            autoComplete="address-line2"
          />
          <Field
            name="postal_code"
            label={text("PLZ")}
            value={address?.postal_code}
            error={save.fields.postal_code}
            required
            autoComplete="postal-code"
          />
          <Field
            name="city"
            label={text("Ort")}
            value={address?.city}
            error={save.fields.city}
            required
            autoComplete="address-level2"
          />
          <div className="field">
            <label htmlFor={countryId}>{text("Land")}</label>
            <CountrySelect
              id={countryId}
              className="select"
              name="country"
              countries={countries}
              error={save.fields.country}
              defaultValue={address?.country}
            />
          </div>
          <Field
            name="phone"
            label={text("Telefon für die Zustellung (optional)")}
            type="tel"
            value={address?.phone}
            autoComplete="tel"
          />
        </div>
        <SaveStatus save={save} />
        <button type="submit" disabled={save.busy} className="btn btn-primary">
          {text("Adresse speichern")}
        </button>
      </form>
    </AccountSheet>
  );
}
function Addresses({
  countries,
  onChanged,
  ...props
}: DashboardProps & {
  /** Host-configured country values and labels. */
  countries: {
    /** Current controlled value. */
    value: string;
    /** Accessible customer-visible label. */
    label: string;
  }[];
  /** Refresh authoritative host data after a successful mutation. */
  onChanged: () => void;
}) {
  const text = useMessages("account");

  const { client, profile } = props;
  const countryId = useId();
  const addresses = useAccountResource((s) => client.addresses(s), [client]);
  const [editing, setEditing] = useState<ShippingAddress | "new" | null>(null),
    [deleting, setDeleting] = useState<ShippingAddress | null>(null);
  const save = useSave();
  return (
    <div className="stack">
      <form
        ref={save.form}
        className="card card-pad form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          void save.run(async () => {
            await client.updateProfile({
              companyname: get(d, "companyname"),
              address1: get(d, "address1"),
              address2: get(d, "address2"),
              postal_code: get(d, "postal_code"),
              city: get(d, "city"),
              country: get(d, "country"),
            });
            onChanged();
          });
        }}
      >
        <h2 className="eyebrow">{text("Rechnungsadresse")}</h2>
        <div className="form-grid two">
          <Field
            name="companyname"
            label={text("Firma (optional)")}
            value={profile.companyname}
            autoComplete="organization"
          />
          <Field
            name="address1"
            label={text("Straße und Hausnummer")}
            value={profile.address1}
            error={save.fields.address1}
            required
            autoComplete="address-line1"
          />
          <Field
            name="address2"
            label={text("Adresszusatz (optional)")}
            value={profile.address2}
            autoComplete="address-line2"
          />
          <Field
            name="postal_code"
            label={text("PLZ")}
            value={profile.postal_code}
            error={save.fields.postal_code}
            required
            autoComplete="postal-code"
          />
          <Field
            name="city"
            label={text("Ort")}
            value={profile.city}
            error={save.fields.city}
            required
            autoComplete="address-level2"
          />
          <div className="field">
            <label htmlFor={countryId}>{text("Land")}</label>
            <CountrySelect
              id={countryId}
              className="select"
              name="country"
              countries={countries}
              error={save.fields.country}
              defaultValue={profile.country}
            />
          </div>
        </div>
        <SaveStatus save={save} />
        <button className="btn btn-primary" disabled={save.busy} type="submit">
          {text("Speichern")}
        </button>
      </form>
      <div className="section-title">
        <h2>{text("Lieferadressen")}</h2>
      </div>
      {(addresses.loading || addresses.error) && (
        <AccountState
          loading={addresses.loading}
          error={addresses.error}
          retry={addresses.reload}
        />
      )}
      <div className="voucher-grid">
        {addresses.data?.map((a) => (
          <section key={a.id} className="card address-card">
            <address>
              {a.name}
              <br />
              {a.company_name}
              <br />
              {a.address1}
              <br />
              {a.address2}
              <br />
              {a.postal_code} {a.city}
              <br />
              {accountCountryOption(countries, a.country)?.label ?? a.country}
            </address>
            <div className="btn-row">
              <button
                type="button"
                className="btn-link"
                onClick={() => setEditing(a)}
              >
                {text("Ändern")}
              </button>
              <button
                type="button"
                className="btn-link"
                onClick={() => setDeleting(a)}
              >
                {text("Löschen")}
              </button>
            </div>
          </section>
        ))}
      </div>
      {addresses.data?.length === 0 && (
        <p>
          {text("Noch keine Lieferadresse. Wir nutzen Deine Rechnungsadresse.")}
        </p>
      )}
      <button className="btn" type="button" onClick={() => setEditing("new")}>
        {text("Neue Lieferadresse")}
      </button>
      {editing && (
        <AddressForm
          address={editing === "new" ? undefined : editing}
          client={client}
          countries={countries}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            addresses.reload();
          }}
        />
      )}
      {deleting && (
        <AccountSheet
          title={text("Adresse wirklich löschen?")}
          onClose={() => setDeleting(null)}
        >
          <p>{deleting.name}</p>
          <SaveStatus save={save} />
          <button
            type="button"
            className="btn"
            disabled={save.busy}
            onClick={() =>
              void save.run(async () => {
                await client.deleteAddress(deleting.id);
                setDeleting(null);
                addresses.reload();
              })
            }
          >
            {text("Ja, löschen")}
          </button>
        </AccountSheet>
      )}
    </div>
  );
}
function Security({ client, profile, routes }: DashboardProps) {
  const text = useMessages("account");

  const email = useSave(),
    password = useSave();
  const [pending, setPending] = useState(""),
    [old, setOld] = useState(""),
    [next, setNext] = useState(""),
    [repeat, setRepeat] = useState("");
  const rules = accountPasswordRules(next);
  return (
    <div className="stack">
      <form
        className="card card-pad form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          const address = get(d, "new_email");
          if (address.toLowerCase() === (profile.email ?? "").toLowerCase()) {
            email.setError(
              text("Das ist schon Deine aktuelle E-Mail-Adresse."),
            );
            return;
          }
          void email.run(async () => {
            await client.updateEmail({ new_email: address });
            setPending(address);
          }, text("Bestätigungslink verschickt."));
        }}
      >
        <h2 className="eyebrow">{text("E-Mail-Adresse")}</h2>
        <p>{profile.email}</p>
        {pending && (
          <p className="notice">
            {text("Bitte bestätige ")}
            {pending}
            {text(". Bis Du den Link öffnest, bleibt")} {profile.email}{" "}
            {text(" aktiv.")}
          </p>
        )}
        <Field
          name="new_email"
          label={text("Neue E-Mail-Adresse")}
          type="email"
          required
          autoComplete="email"
          error={email.fields.new_email}
        />
        <SaveStatus save={email} />
        <button type="submit" className="btn btn-outline" disabled={email.busy}>
          {text("Bestätigungslink senden")}
        </button>
      </form>
      {profile.has_password ? (
        <form
          className="card card-pad form"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !rules.length ||
              !rules.letter ||
              !rules.nonLetter ||
              next === old ||
              next !== repeat
            ) {
              password.setError(
                text(
                  "Bitte beachte die Passwortregeln und bestätige Dein neues Passwort.",
                ),
              );
              return;
            }
            void password.run(async () => {
              await client.updatePassword({
                old_password: old,
                password: next,
              });
              setOld("");
              setNext("");
              setRepeat("");
            }, text("Passwort geändert."));
          }}
        >
          <h2 className="eyebrow">{text("Passwort")}</h2>
          <label className="field">
            {text("Aktuelles Passwort")}
            <input
              className="input"
              type="password"
              required
              autoComplete="current-password"
              value={old}
              onChange={(e) => setOld(e.target.value)}
            />
          </label>
          <label className="field">
            {text("Neues Passwort")}
            <input
              className="input"
              type="password"
              required
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
          <label className="field">
            {text("Neues Passwort wiederholen")}
            <input
              className="input"
              type="password"
              required
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </label>
          <ul className="small">
            <li>
              {rules.length ? "✓" : "○"}{" "}
              {text(" Mindestens 8 Zeichen, höchstens 72 UTF-8-Bytes")}
            </li>
            <li>
              {rules.letter && rules.nonLetter ? "✓" : "○"}{" "}
              {text(" Ein Buchstabe und eine Zahl oder ein Sonderzeichen")}
            </li>
            <li>
              {next && next !== old ? "✓" : "○"}{" "}
              {text(" Anders als Dein aktuelles Passwort")}
            </li>
          </ul>
          <SaveStatus save={password} />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={password.busy}
          >
            {text("Passwort ändern")}
          </button>
        </form>
      ) : (
        <AccountCard title={text("Passwort")}>
          <p>
            {text(
              "Du hast noch kein Passwort. Du kannst Dir einen Link zum Festlegen schicken lassen.",
            )}
          </p>
          <a className="btn" href={routes.passwordSet}>
            {text("Passwort festlegen")}
          </a>
        </AccountCard>
      )}
    </div>
  );
}
function Newsletter({
  adapter,
  copy,
}: {
  /** Adapter in the newsletter contract. */
  adapter: NewsletterAdapter;
  /** Copy in the newsletter contract. */
  copy: string;
}) {
  const options = useShopventoLocale();

  const text = useMessages("account");

  const resource = useAccountResource(() => adapter.status(), [adapter]);
  const save = useSave();
  const pending = resource.data === "pending";
  const run = (action: () => Promise<void>, success: string) =>
    save.run(
      async () => {
        await action();
        resource.reload();
      },
      success,
      (error) =>
        error instanceof AccountApiError && error.status === 429
          ? text(
              "Bitte warte fünf Minuten nach der letzten E-Mail, bevor Du einen neuen Bestätigungslink anforderst.",
            )
          : accountErrorMessage(error, false, undefined, options),
    );
  return (
    <AccountCard title={text("Newsletter")}>
      {(resource.loading || resource.error) && (
        <AccountState
          loading={resource.loading}
          error={resource.error}
          retry={resource.reload}
        />
      )}
      <label className="switch-row">
        {text("Newsletter")}
        <input
          type="checkbox"
          role="switch"
          aria-checked={resource.data === true}
          checked={resource.data === true}
          disabled={
            resource.loading || !!resource.error || save.busy || pending
          }
          onChange={(e) => {
            const value = e.target.checked;
            void run(
              () => (value ? adapter.subscribe() : adapter.unsubscribe()),
              value
                ? text(
                    "Bitte bestätige Deine Anmeldung über den Link in unserer E-Mail.",
                  )
                : text("Du bist abgemeldet."),
            );
          }}
        />
      </label>
      {pending && (
        <div>
          <p>
            {text(
              "Bitte bestätige Deine Anmeldung über den Link in unserer E-Mail.",
            )}
          </p>
          <p className="tiny muted">
            {text(
              "Der Link ist 24 Stunden gültig. Du kannst alle fünf Minuten eine neue E-Mail anfordern. Ein neuer Link macht den bisherigen ungültig.",
            )}
          </p>
          <div className="btn-row">
            <button
              className="btn"
              type="button"
              disabled={save.busy}
              onClick={() =>
                void run(
                  () => adapter.subscribe(),
                  text(
                    "Wir haben Dir eine neue Bestätigungs-E-Mail geschickt.",
                  ),
                )
              }
            >
              {text("Bestätigungs-E-Mail erneut senden")}
            </button>
            <button
              className="btn"
              type="button"
              disabled={save.busy}
              onClick={() =>
                void run(
                  () => adapter.unsubscribe(),
                  text("Deine Anmeldung wurde abgebrochen."),
                )
              }
            >
              {text("Anmeldung abbrechen")}
            </button>
          </div>
        </div>
      )}
      <p>{copy}</p>
      <p className="tiny muted">
        {text(
          "Bestätigungen, Rechnungen und Hinweise zu Deinen Bestellungen schicken wir immer, die gehören zum Vertrag.",
        )}
      </p>
      <SaveStatus save={save} />
    </AccountCard>
  );
}
/** Render profile, address, password, email and newsletter settings using host policy. */
export function AccountSettings({
  minimumAge,
  countries,
  newsletter,
  onChanged,
  onLogout,
  ...props
}: DashboardProps & {
  /** Runtime minimum age supplied by the host. */
  minimumAge: number;
  /** Host-configured country values and labels. */
  countries: {
    /** Current controlled value. */
    value: string;
    /** Accessible customer-visible label. */
    label: string;
  }[];
  /** Newsletter adapter or host newsletter terminology. */
  newsletter: NewsletterAdapter;
  /** Refresh authoritative host data after a successful mutation. */
  onChanged: () => void;
  /** Perform the host logout action. */
  onLogout: () => void;
}) {
  const text = useMessages("account");

  const [section, setSection] = useState("");
  const sections = [
    [
      "persoenlich",
      text("Persönliche Daten"),
      text("Name, Geburtsdatum, Telefon"),
    ],
    ["adressen", text("Adressen"), text("Rechnungsadresse und Lieferadressen")],
    [
      "anmeldung",
      text("Anmeldung & Sicherheit"),
      text("E-Mail-Adresse und Passwort"),
    ],
    ["newsletter", text("Newsletter"), text("Was wir Dir per E-Mail schicken")],
  ];
  return (
    <>
      <AccountHead
        title={
          section
            ? (sections.find((s) => s[0] === section)?.[1] ?? text("Konto"))
            : text("Konto")
        }
        accent={section ? undefined : "& Einstellungen"}
        lead={
          section
            ? undefined
            : text(
                "Persönliche Daten, Adressen, Anmeldung und was wir Dir schicken dürfen.",
              )
        }
      />
      {section && (
        <button
          className="back btn-link"
          type="button"
          onClick={() => setSection("")}
        >
          {text("‹ Konto")}
        </button>
      )}
      <div className={`konto-grid ${section ? "has-section" : ""}`}>
        <nav
          className="card settings-nav"
          aria-label={text("Kontoeinstellungen")}
        >
          <ul className="settings-list">
            {sections.map(([key, title, sub]) => (
              <li key={key}>
                <button
                  type="button"
                  aria-current={section === key ? "page" : undefined}
                  onClick={() => setSection(key)}
                >
                  <span className="s-ico" aria-hidden="true">
                    <BookingIcon
                      name={
                        key === "persoenlich"
                          ? "users"
                          : key === "adressen"
                            ? "pin"
                            : key === "anmeldung"
                              ? "id"
                              : "info"
                      }
                    />
                  </span>
                  <span>
                    <span className="s-title">{title}</span>
                    <br />
                    <span className="s-sub">{sub}</span>
                  </span>
                  <span className="settings-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={onLogout}>
                {text("Abmelden")}
              </button>
            </li>
          </ul>
        </nav>
        <div className="stack">
          {section === "persoenlich" ? (
            <Personal
              {...props}
              minimumAge={minimumAge}
              onChanged={onChanged}
            />
          ) : section === "adressen" ? (
            <Addresses {...props} countries={countries} onChanged={onChanged} />
          ) : section === "anmeldung" ? (
            <Security {...props} />
          ) : section === "newsletter" ? (
            <Newsletter adapter={newsletter} copy={props.labels.newsletter} />
          ) : (
            <AccountCard title={text("Kontoübersicht")}>
              <p>
                {props.profile.first_name} {props.profile.last_name}
              </p>
              <p>{props.profile.email}</p>
              <p>
                {props.profile.birth_date
                  ? text("Geburtsdatum hinterlegt")
                  : text("Geburtsdatum noch nicht hinterlegt")}
              </p>
              <p>{text("Wähl einen Bereich, um Deine Daten zu ändern.")}</p>
            </AccountCard>
          )}
        </div>
      </div>
    </>
  );
}
