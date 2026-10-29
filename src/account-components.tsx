"use client";
import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  AccountApiError,
  type AccountClient,
  type AccountFieldErrors,
  type AccountLoginResponse,
  accountErrorMessage,
  accountFieldErrors,
  accountPasswordRules,
} from "./account-client";

interface FormProps {
  /** Stable client instance used for API requests. */
  client: AccountClient;
  /** Host sign-in route.
   * @defaultValue "/konto/anmelden" */
  loginUrl?: string;
}
function Field({
  label,
  error,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  /** Selected icon or backend name. */
  name: string;
  /** Accessible customer-visible label. */
  label: string;
  /** Customer-visible error or error presentation flag. Optional; omitted unless supplied by the host or backend. */
  error?: string;
  /** Optional customer-visible helper text. Optional; omitted unless supplied by the host or backend. */
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="sv-account-field">
      <label htmlFor={id}>
        {label}
        {input.required ? "" : " (optional)"}
      </label>
      <input
        {...input}
        id={id}
        aria-invalid={!!error}
        aria-describedby={
          [
            hint && `${id}-hint`,
            error && `${id}-error`,
            input["aria-describedby"],
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      {hint && (
        <p id={`${id}-hint`} className="sv-account-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="sv-account-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
function Notice({
  children,
}: {
  /** Host-supplied child content. */
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="sv-account-notice" role="status" tabIndex={-1} ref={ref}>
      {children}
    </div>
  );
}
function useFormAction(
  token = false,
  login = false,
  context?: "passwordSet" | "verify" | "emailChange",
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<AccountFieldErrors>({});
  const lock = useRef(false);
  const summary = useRef<HTMLDivElement>(null);
  const focusSummary = useRef(false);
  useEffect(() => {
    if (error && focusSummary.current) summary.current?.focus();
  }, [error]);
  const clear = (name: string) => {
    setFields((current) => ({ ...current, [name]: "" }));
    setError(null);
  };
  async function run(
    event: FormEvent<HTMLFormElement>,
    action: (data: FormData) => Promise<void>,
    checks: AccountFieldErrors = {},
  ) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const invalid: AccountFieldErrors = {};
    for (const field of Array.from(form.elements)) {
      if (!(field instanceof HTMLInputElement)) continue;
      if (
        field.required &&
        (field.type === "checkbox" ? !field.checked : !field.value.trim())
      )
        invalid[field.name] = "Bitte fülle dieses Feld aus.";
      else if (field.type === "email" && field.value && !field.validity.valid)
        invalid[field.name] = "Bitte gib eine gültige E-Mail-Adresse ein.";
    }
    Object.assign(invalid, checks);
    focusSummary.current = false;
    setFields(invalid);
    setError(null);
    const first = Array.from(form.elements).find(
      (field) => field instanceof HTMLInputElement && invalid[field.name],
    );
    if (first instanceof HTMLInputElement) {
      setError("Bitte prüfe die markierten Felder.");
      first.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await action(new FormData(form));
    } catch (cause) {
      focusSummary.current = true;
      const credentialsError =
        login && cause instanceof AccountApiError && cause.status === 401;
      const message = credentialsError
        ? "E-Mail-Adresse oder Passwort stimmen nicht. Bitte prüfe Deine Eingaben."
        : accountErrorMessage(cause, token, login ? "login" : context);
      setError(message);
      setFields(
        credentialsError
          ? { password: message }
          : context === "passwordSet" &&
              cause instanceof AccountApiError &&
              cause.status === 400 &&
              cause.detail ===
                "Dein neues Passwort muss sich von Deinem aktuellen Passwort unterscheiden."
            ? { new_password: message }
            : accountFieldErrors(cause),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const feedback = error && (
    <div className="sv-account-error" role="alert" tabIndex={-1} ref={summary}>
      {error}
    </div>
  );
  return { busy, fields, feedback, clear, run, setFields };
}
const value = (data: FormData, name: string) => String(data.get(name) ?? "");
const passwordValid = (password: string) =>
  Object.values(accountPasswordRules(password)).every(Boolean);
/** Display password requirements, including Unicode length and the UTF-8 byte limit. */
export function PasswordChecklist({
  password,
  id,
}: {
  /** Password being checked; never persist this value. */
  password: string;
  /** Opaque backend identifier or accessible element ID. Optional; omitted unless supplied by the host or backend. */
  id?: string;
}) {
  const rules = accountPasswordRules(password);
  const minimum = Array.from(password).length >= 8;
  const maximum = new TextEncoder().encode(password).length <= 72;
  return (
    <ul
      id={id}
      className="sv-account-rules"
      aria-label="Passwortregeln"
      aria-live="polite"
    >
      <li data-met={minimum}>
        <span aria-hidden="true">{minimum ? "✓" : "○"}</span> Mindestens 8
        Zeichen{" "}
        <span className="sv-account-sr">
          {minimum ? "erfüllt" : "noch nicht erfüllt"}
        </span>
      </li>
      <li data-met={maximum}>
        <span aria-hidden="true">{maximum ? "✓" : "○"}</span> Höchstens 72
        Bytes, Umlaute und Emojis zählen mehrfach
        <span className="sv-account-sr">
          {maximum ? "erfüllt" : "noch nicht erfüllt"}
        </span>
      </li>
      <li data-met={rules.letter && rules.nonLetter}>
        <span aria-hidden="true">
          {rules.letter && rules.nonLetter ? "✓" : "○"}
        </span>{" "}
        Ein Buchstabe und eine Zahl oder ein Sonderzeichen{" "}
        <span className="sv-account-sr">
          {rules.letter && rules.nonLetter ? "erfüllt" : "noch nicht erfüllt"}
        </span>
      </li>
    </ul>
  );
}
/** Render same-origin customer sign-in, keeping incorrect credentials inline. */
export function LoginForm({
  client,
  registerUrl = "/konto/registrieren",
  passwordResetUrl = "/konto/passwort-vergessen",
  onSuccess,
  notice,
  onRegister,
}: FormProps & {
  /** Open host registration in place of following the registration URL. Optional; omitted unless supplied by the host or backend. */
  onRegister?: () => void;
  /** Host registration route.
   * @defaultValue "/konto/registrieren" */
  registerUrl?: string;
  /** Host password reset request route.
   * @defaultValue "/konto/passwort-vergessen" */
  passwordResetUrl?: string;
  /** Handle successful authentication; the host owns navigation. Optional; omitted unless supplied by the host or backend. */
  onSuccess?: (response: AccountLoginResponse) => void | Promise<void>;
  /** Optional customer-visible notice. Optional; omitted unless supplied by the host or backend. */
  notice?: string;
}) {
  const form = useFormAction(false, true);
  const noticeId = useId();
  return (
    <form
      className="sv-account"
      noValidate
      aria-label="Anmelden"
      aria-describedby={notice ? noticeId : undefined}
      onChange={(event) =>
        form.clear(
          event.target instanceof HTMLInputElement ? event.target.name : "",
        )
      }
      onSubmit={(event) =>
        form.run(event, async (data) => {
          const result = await client.login({
            email: value(data, "email").trim(),
            password: value(data, "password"),
          });
          await onSuccess?.(result);
        })
      }
    >
      {notice && (
        <div id={noticeId} className="sv-account-error" role="status">
          {notice}
        </div>
      )}
      {form.feedback}
      <Field
        name="email"
        label="E-Mail-Adresse"
        type="email"
        autoComplete="email"
        required
        error={form.fields.email}
      />
      <Field
        name="password"
        label="Passwort"
        type="password"
        autoComplete="current-password"
        required
        error={form.fields.password}
      />
      <a href={passwordResetUrl}>
        Passwort vergessen oder noch keines festgelegt?
      </a>
      <button type="submit" disabled={form.busy}>
        {form.busy ? "Du wirst angemeldet…" : "Anmelden"}
      </button>
      <p className="sv-account-secondary">
        Noch kein Konto?{" "}
        <a
          href={registerUrl}
          onClick={
            onRegister
              ? (event) => {
                  event.preventDefault();
                  onRegister();
                }
              : undefined
          }
        >
          Konto anlegen
        </a>
      </p>
    </form>
  );
}
/** Render registration with required terms/privacy consent and optional separate newsletter consent. */
export function RegisterForm({
  client,
  termsUrl,
  privacyUrl,
  loginUrl = "/konto/anmelden",
  initialEmail = "",
}: FormProps & {
  /** Host terms and conditions URL. */
  termsUrl: string;
  /** Host privacy policy URL. */
  privacyUrl: string;
  /** Optional email prefill.
   * @defaultValue "" */
  initialEmail?: string;
}) {
  const form = useFormAction();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const rulesId = useId();
  const consentId = useId();
  const newsletterId = useId();
  const [newsletterRequested, setNewsletterRequested] = useState(false);
  if (done)
    return (
      <div className="sv-account">
        <Notice>
          <strong>Bitte schau in Dein E-Mail-Postfach.</strong>
          <p>
            Wenn wir für diese Adresse ein Konto anlegen können, erhältst Du
            einen Bestätigungslink. Falls Du schon ein Konto hast, kannst Du
            Dich anmelden oder Dein Passwort festlegen.
          </p>
          {newsletterRequested && (
            <p>
              Für Deine Newsletter-Anmeldung folgt eine separate
              Bestätigungs-E-Mail. Bitte bestätige Deine Anmeldung über den Link
              darin.
            </p>
          )}
          <a href={loginUrl}>Zur Anmeldung</a>
        </Notice>
      </div>
    );
  return (
    <form
      className="sv-account"
      noValidate
      aria-label="Konto anlegen"
      onChange={(event) =>
        form.clear(
          event.target instanceof HTMLInputElement ? event.target.name : "",
        )
      }
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const errors: AccountFieldErrors = {};
        if (!passwordValid(password))
          errors.password = "Bitte beachte die Passwortregeln.";
        if (value(data, "confirm_password") !== password)
          errors.confirm_password = "Die Passwörter stimmen nicht überein.";
        void form.run(
          event,
          async (data) => {
            await client.register({
              email: value(data, "email").trim(),
              password,
              first_name: value(data, "first_name").trim(),
              last_name: value(data, "last_name").trim(),
              newsletter_consent: data.get("newsletter_consent") === "on",
              marketing_consent: data.get("terms") === "on",
            });
            setNewsletterRequested(data.get("newsletter_consent") === "on");
            setDone(true);
            setPassword("");
          },
          errors,
        );
      }}
    >
      <p>Felder ohne „optional“ brauchen wir für Dein Konto.</p>
      {form.feedback}
      <fieldset>
        <legend>Deine Angaben</legend>
        <div className="sv-account-grid">
          <Field
            name="first_name"
            label="Vorname"
            autoComplete="given-name"
            required
            error={form.fields.first_name}
          />
          <Field
            name="last_name"
            label="Nachname"
            autoComplete="family-name"
            required
            error={form.fields.last_name}
          />
        </div>
        <Field
          name="email"
          label="E-Mail-Adresse"
          type="email"
          autoComplete="email"
          required
          defaultValue={initialEmail}
          error={form.fields.email}
        />
      </fieldset>
      <fieldset>
        <legend>Dein Passwort</legend>
        <Field
          name="password"
          label="Passwort"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby={rulesId}
          error={form.fields.password}
        />
        <PasswordChecklist password={password} id={rulesId} />
        <Field
          name="confirm_password"
          label="Passwort wiederholen"
          type="password"
          autoComplete="new-password"
          required
          error={form.fields.confirm_password}
        />
      </fieldset>
      <label className="sv-account-check" htmlFor={newsletterId}>
        <input
          id={newsletterId}
          name="newsletter_consent"
          type="checkbox"
          defaultChecked={false}
        />
        Ich möchte Neuigkeiten und Angebote per E-Mail erhalten (optional).
      </label>
      <label className="sv-account-check" htmlFor={consentId}>
        <input
          id={consentId}
          name="terms"
          type="checkbox"
          required
          aria-invalid={!!form.fields.terms}
          aria-describedby={
            form.fields.terms ? `${consentId}-error` : undefined
          }
        />
        <span>
          Ich akzeptiere die <a href={termsUrl}>AGB</a> und habe die{" "}
          <a href={privacyUrl}>Datenschutzhinweise</a> gelesen.
        </span>
      </label>
      {form.fields.terms && (
        <p id={`${consentId}-error`} className="sv-account-field-error">
          Bitte akzeptiere die AGB und lies die Datenschutzhinweise.
        </p>
      )}
      <button type="submit" disabled={form.busy}>
        {form.busy ? "Konto wird angelegt…" : "Konto anlegen"}
      </button>
      <p className="sv-account-secondary">
        Schon dabei? <a href={loginUrl}>Anmelden</a>
      </p>
    </form>
  );
}
/** Request a password-reset email without revealing whether the account exists. */
export function PasswordResetRequest({
  client,
  loginUrl = "/konto/anmelden",
}: FormProps) {
  const form = useFormAction();
  const [done, setDone] = useState(false);
  return (
    <div className="sv-account">
      {done ? (
        <Notice>
          <strong>Bitte schau in Dein E-Mail-Postfach.</strong>
          <p>
            Wenn es zu dieser E-Mail-Adresse ein Konto gibt, erhältst Du einen
            Link, um Dein Passwort festzulegen. Schau bitte auch im Spam-Ordner
            nach.
          </p>
          <a href={loginUrl}>Zur Anmeldung</a>
        </Notice>
      ) : (
        <form
          noValidate
          aria-label="Passwort-Link anfordern"
          onChange={() => form.clear("email")}
          onSubmit={(event) =>
            form.run(event, async (data) => {
              await client.requestPasswordReset({
                email: value(data, "email").trim(),
              });
              setDone(true);
            })
          }
        >
          <p>
            Du hast Dein Passwort vergessen oder noch keines festgelegt? Wir
            schicken Dir einen Link.
          </p>
          {form.feedback}
          <Field
            name="email"
            label="E-Mail-Adresse"
            type="email"
            autoComplete="email"
            required
            error={form.fields.email}
          />
          <button type="submit" disabled={form.busy}>
            {form.busy ? "Link wird angefordert…" : "Link senden"}
          </button>
          <a href={loginUrl}>Zur Anmeldung</a>
        </form>
      )}
    </div>
  );
}
interface TokenProps extends FormProps {
  /** One-time token retained only in component memory; null enables recovery navigation. */
  token: string | null;
  /** Host password reset request route. Optional; omitted unless supplied by the host or backend. */
  passwordResetUrl?: string;
}
/** Set a password using a token retained only in component memory. */
export function PasswordSetForm({
  client,
  token,
  accountUrl = "/konto",
  passwordResetUrl = "/konto/passwort-vergessen",
}: TokenProps & {
  /** Host authenticated account landing route.
   * @defaultValue "/konto" */
  accountUrl?: string;
}) {
  const form = useFormAction(true, false, "passwordSet");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const rulesId = useId();
  if (done)
    return (
      <div className="sv-account">
        <Notice>
          <strong>Dein Passwort ist festgelegt.</strong>
          <p>Du bist jetzt angemeldet.</p>
          <a href={accountUrl}>Zu Deinem Konto</a>
        </Notice>
      </div>
    );
  if (!token || token.length > 4096)
    return (
      <div className="sv-account">
        <Notice>
          <p>
            Dieser Link ist ungültig oder fehlt. Bitte fordere einen neuen Link
            an.
          </p>
          <a href={passwordResetUrl}>Neuen Link anfordern</a>
        </Notice>
      </div>
    );
  return (
    <form
      className="sv-account"
      noValidate
      aria-label="Passwort festlegen"
      onChange={(event) =>
        form.clear(
          event.target instanceof HTMLInputElement ? event.target.name : "",
        )
      }
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const errors: AccountFieldErrors = {};
        if (!passwordValid(password))
          errors.new_password = "Bitte beachte die Passwortregeln.";
        if (value(data, "confirm_password") !== password)
          errors.confirm_password = "Die Passwörter stimmen nicht überein.";
        void form.run(
          event,
          async () => {
            await client.setPassword({ token, new_password: password });
            setPassword("");
            setDone(true);
          },
          errors,
        );
      }}
    >
      {form.feedback}
      <Field
        name="new_password"
        label="Neues Passwort"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-describedby={rulesId}
        error={form.fields.new_password}
      />
      <PasswordChecklist password={password} id={rulesId} />
      <Field
        name="confirm_password"
        label="Neues Passwort wiederholen"
        type="password"
        autoComplete="new-password"
        required
        error={form.fields.confirm_password}
      />
      <button type="submit" disabled={form.busy}>
        {form.busy ? "Passwort wird gespeichert…" : "Passwort festlegen"}
      </button>
      <a href={passwordResetUrl}>Neuen Link anfordern</a>
    </form>
  );
}
function EmailConfirmation({
  client,
  token,
  loginUrl = "/konto/anmelden",
  change = false,
}: TokenProps & {
  /** Change in the email confirmation contract.
   * @defaultValue false */
  change?: boolean;
}) {
  const form = useFormAction(true, false, change ? "emailChange" : "verify");
  const [done, setDone] = useState(false);
  return (
    <div className="sv-account">
      {done ? (
        <Notice>
          <strong>
            {change
              ? "Deine neue E-Mail-Adresse ist bestätigt."
              : "Deine E-Mail-Adresse ist bestätigt."}
          </strong>
          <p>
            {change
              ? "Bitte melde Dich mit Deiner neuen E-Mail-Adresse erneut an."
              : "Du kannst Dich jetzt anmelden."}
          </p>
          <a href={loginUrl}>Anmelden</a>
        </Notice>
      ) : !token || token.length > 4096 ? (
        <Notice>
          <p>
            Dieser Link ist ungültig oder fehlt. Bitte öffne den vollständigen
            Link aus Deiner E-Mail.
          </p>
          <a href={loginUrl}>Zur Anmeldung</a>
        </Notice>
      ) : (
        <form
          noValidate
          aria-label={
            change
              ? "Neue E-Mail-Adresse bestätigen"
              : "E-Mail-Adresse bestätigen"
          }
          onSubmit={(event) =>
            form.run(event, async () => {
              await (change
                ? client.confirmEmailChange({ token })
                : client.verifyEmail({ token }));
              setDone(true);
            })
          }
        >
          {form.feedback}
          <p>
            {change
              ? "Bestätige Deine neue E-Mail-Adresse. Danach meldest Du Dich erneut an."
              : "Bestätige Deine E-Mail-Adresse, um Dein Konto zu nutzen."}
          </p>
          <button type="submit" disabled={form.busy}>
            {form.busy ? "Wird bestätigt…" : "E-Mail-Adresse bestätigen"}
          </button>
          <a href={loginUrl}>Zur Anmeldung</a>
        </form>
      )}
    </div>
  );
}
/** Confirm an email token only after an explicit button press.
 * @param props - Props supplied by the host. */
export function EmailVerify(props: TokenProps) {
  return <EmailConfirmation {...props} />;
}
/** Confirm an email change only after an explicit button press.
 * @param props - Props supplied by the host. */
export function EmailChangeConfirm(props: TokenProps) {
  return <EmailConfirmation {...props} change />;
}
