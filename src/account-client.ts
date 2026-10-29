import type { AccountOperations } from "./wire";

export type {
  AccountLoginRequest,
  AccountProfile,
  AccountRegisterRequest,
} from "./wire";
/** The edge removes tokens from the upstream login response. */
export type AccountLoginResponse = Omit<
  AccountOperations["login"]["response"],
  "access_token"
>;
/** Public account field errors contract used by the storefront clients. */
export type AccountFieldErrors = Record<string, string>;
/** Default German message shown when an authenticated account request expires. */
export const SESSION_EXPIRED_MESSAGE =
  "Deine Sitzung ist abgelaufen. Bitte melde Dich erneut an.";
/** An unsuccessful account API response, retaining its status and parsed detail. */
export class AccountApiError extends Error {
  constructor(
    /** HTTP response status code. */
    public status: number,

    /** Parsed backend error detail, retained for customer-safe error handling. */
    public detail: unknown,
  ) {
    super("Account request failed");
  }
}
/** Extract field-level account validation messages.
 * @param error - Customer-visible error or error presentation flag. */
export function accountFieldErrors(error: unknown): AccountFieldErrors {
  if (
    !(error instanceof AccountApiError) ||
    error.status !== 422 ||
    !Array.isArray(error.detail)
  )
    return {};
  return Object.fromEntries(
    error.detail.flatMap((item) => {
      if (!item || typeof item !== "object" || !Array.isArray(item.loc))
        return [];
      const field = item.loc.at(-1);
      if (typeof field !== "string") return [];
      const messages: Record<string, string> = {
        email: "Bitte gib eine gültige E-Mail-Adresse ein.",
        birth_date: "Bitte prüf Dein Geburtsdatum.",
        country: "Bitte wähle ein gültiges Land aus.",
        password: "Bitte beachte die Passwortregeln.",
        new_password: "Bitte beachte die Passwortregeln.",
        phone: "Bitte gib eine Telefonnummer mit internationaler Vorwahl ein.",
      };
      return [[field, messages[field] ?? "Bitte prüfe dieses Feld."]];
    }),
  );
}
/** Turn an account failure into customer-safe German copy for the current form context.
 * @param error - Customer-visible error or error presentation flag.
 * @param token - One-time token retained only in component memory; null enables recovery navigation. Defaults to false.
 * @param context - Context supplied by the host. */
export function accountErrorMessage(
  error: unknown,
  token = false,
  context?: "login" | "passwordSet" | "verify" | "emailChange",
): string {
  if (!(error instanceof AccountApiError))
    return "Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.";
  if (error.status === 429)
    return "Zu viele Anfragen. Bitte versuche es später erneut.";
  if (error.status === 401) return SESSION_EXPIRED_MESSAGE;
  if (
    context === "login" &&
    error.status === 403 &&
    typeof error.detail === "string"
  )
    return "Bitte bestätige zuerst Deine E-Mail-Adresse. Über „Passwort vergessen“ erhältst Du einen neuen Bestätigungslink.";
  if (context === "verify" && error.status === 400)
    return "Dieser Bestätigungslink ist ungültig oder wurde bereits verwendet. Falls Du Deine E-Mail-Adresse schon bestätigt hast, kannst Du Dich direkt anmelden.";
  if (
    context === "emailChange" &&
    error.status === 400 &&
    error.detail ===
      "Diese E-Mail-Adresse wird bereits für ein anderes Konto verwendet. Bitte gib eine andere E-Mail-Adresse ein."
  )
    return error.detail;
  if (
    context === "passwordSet" &&
    error.status === 400 &&
    error.detail ===
      "Dein neues Passwort muss sich von Deinem aktuellen Passwort unterscheiden."
  )
    return error.detail;
  if (error.status === 403)
    return "Die Anfrage wurde abgelehnt. Bitte prüfe Deine E-Mail-Bestätigung oder lade die Seite neu.";
  if (token && [400, 404, 422].includes(error.status))
    return "Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.";
  if ([409, 422].includes(error.status) && typeof error.detail === "string")
    return error.detail;
  if (error.status === 422)
    return "Bitte prüfe Deine Eingaben und versuche es erneut.";
  return "Das hat gerade nicht geklappt. Bitte versuche es erneut.";
}
/** Public account fetch contract used by the storefront clients. */
export type AccountFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
/** Host transport and expired-session behavior for same-origin account calls. */
export interface AccountClientOptions {
  /** Optional host fetch implementation. Optional; omitted unless supplied by the host or backend. */
  fetch?: AccountFetch;
  /** Called for expired requests; incorrect login credentials are handled by LoginForm. */
  onUnauthorized?: () => void;
}
/** Fixed relative API paths prevent credentials being sent to another origin. */
export function createAccountClient(options: AccountClientOptions = {}) {
  const transport =
    options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  async function request<K extends keyof AccountOperations>(
    path: AccountOperations[K]["path"],
    method: AccountOperations[K]["method"],
    body: AccountOperations[K]["body"],
    signal?: AbortSignal,
  ): Promise<AccountOperations[K]["response"]> {
    const response = await transport(path, {
      method,
      signal,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (
        response.status === 401 &&
        path !== "/api/shop/user/login" &&
        !signal?.aborted
      )
        options.onUnauthorized?.();
      throw new AccountApiError(response.status, data?.detail ?? data?.error);
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Invalid account response");
    return data;
  }
  return {
    // Upstream AuthResponse requires access_token, but the same-origin edge strips it.
    /** Sign in through the host proxy; browser JSON must omit upstream access tokens. */
    login: (body: AccountOperations["login"]["body"]) =>
      request<"login">(
        "/api/shop/user/login",
        "POST",
        body,
      ) as Promise<AccountLoginResponse>,
    /** Request registration without revealing account existence. */
    register: (body: AccountOperations["register"]["body"]) =>
      request<"register">("/api/shop/user/register", "POST", body),
    /** Request a reset email without revealing account existence. */
    requestPasswordReset: (body: AccountOperations["passwordReset"]["body"]) =>
      request<"passwordReset">("/api/shop/user/password-reset", "POST", body),
    /** Set the account password from a one-time token. */
    setPassword: (body: AccountOperations["passwordSet"]["body"]) =>
      request<"passwordSet">(
        "/api/shop/user/password-reset/confirm",
        "POST",
        body,
      ),
    /** Confirm a one-time email verification token. */
    verifyEmail: (body: AccountOperations["emailVerify"]["body"]) =>
      request<"emailVerify">("/api/shop/user/verify-email", "POST", body),
    /** Confirm a one-time email change token. */
    confirmEmailChange: (
      body: AccountOperations["emailChangeConfirm"]["body"],
    ) =>
      request<"emailChangeConfirm">(
        "/api/shop/user/confirm-email-change",
        "POST",
        body,
      ),
    /** Load the authoritative authenticated profile. Optional signal cancels the read. */
    getProfile: async (signal?: AbortSignal) => {
      const profile = await request<"profile">(
        "/api/shop/user/profile",
        "GET",
        undefined,
        signal,
      );
      if (!Number.isInteger(profile.id) || profile.id < 1)
        throw new Error("Invalid account profile");
      return profile;
    },
    /** Invalidate the current host session. */
    logout: () => request<"logout">("/api/shop/user/logout", "POST", undefined),
    /** Read public installation settings. Optional signal cancels the request. */
    getSettings: (signal?: AbortSignal) =>
      request<"settings">("/api/shop/settings", "GET", undefined, signal),
  };
}
/** Public account client contract used by the storefront clients. */
export type AccountClient = ReturnType<typeof createAccountClient>;

/** Require a relative same-origin path, including after URL normalization. */
export function safeAccountReturnPath(
  value: string | null | undefined,
): string | null {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    Array.from(value).some(
      (char) =>
        char === "\\" || char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
    )
  )
    return null;
  try {
    const url = new URL(value, "https://account.invalid");
    const decodedPath = decodeURIComponent(url.pathname);
    if (
      url.origin !== "https://account.invalid" ||
      url.pathname.startsWith("//") ||
      decodedPath.startsWith("//") ||
      Array.from(decodedPath).some(
        (char) =>
          char === "\\" ||
          char.charCodeAt(0) < 32 ||
          char.charCodeAt(0) === 127,
      )
    )
      return null;
    const normalizedPath = decodedPath
      .replace(/\/{2,}/gu, "/")
      .replace(/\.html(?=\/?$)/u, "");
    if (/^\/api(?:\/|$)/u.test(normalizedPath)) return null;
    // Returning to a sign-in screen would create a redirect loop.
    if (/^\/login(?:\/callback)?\/?$/u.test(normalizedPath)) return null;
    if (
      /^\/konto\/(anmelden|registrieren|passwort-vergessen|passwort-festlegen|e-mail-bestaetigen|e-mail-aendern\/bestaetigen)\/?$/u.test(
        normalizedPath,
      )
    )
      return null;
    return `${url.pathname.replace(/\/{2,}/gu, "/").replace(/\.html(?=\/?$)/u, "")}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
/** Decode and validate a host-owned document return-path cookie.
 * @param cookieValue - Cookie value supplied by the host. */
export function accountDocumentReturnPath(
  cookieValue: string | null | undefined,
): string | null {
  if (!cookieValue) return null;
  try {
    const path = decodeURIComponent(cookieValue);
    return /^\/api\/shop\/stripe\/(invoice|credit-note)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
      path,
    )
      ? path
      : null;
  } catch {
    return null;
  }
}
/** Backend policy counts Unicode characters for the minimum and UTF-8 bytes for the maximum. */
export function accountPasswordRules(password: string) {
  const bytes = new TextEncoder().encode(password).length;
  return {
    /** Length returned by accountPasswordRules. */
    length: Array.from(password).length >= 8 && bytes <= 72,
    /** Letter returned by accountPasswordRules. */
    letter: /\p{L}/u.test(password),
    /** Non letter returned by accountPasswordRules. */
    nonLetter: /[^\p{L}]/u.test(password),
  };
}
/** Validate a German date input and the runtime minimum age against the Berlin calendar date.
 * @param value - Current controlled value.
 * @param minimumAge - Runtime minimum age supplied by the host.
 * @param today - ISO calendar date used for age validation; defaults to today in Europe/Berlin. Defaults to new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", }).format(new Date()). */
export function accountBirthDateError(
  value: string,
  minimumAge: number,
  today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date()),
): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value < "1900-01-01" ||
    value > today
  )
    return "Bitte prüf das Datum, es liegt außerhalb des möglichen Bereichs.";
  const age =
    Number(today.slice(0, 4)) -
    Number(value.slice(0, 4)) -
    (today.slice(5) < value.slice(5) ? 1 : 0);
  if (age > 120)
    return "Bitte prüf das Datum, es liegt außerhalb des möglichen Bereichs.";
  return age < minimumAge
    ? `Mit diesem Datum wärst Du ${age} Jahre alt. Ein angegebenes Geburtsdatum muss das Mindestalter von ${minimumAge} Jahren erfüllen. Bitte prüf Dein Geburtsdatum.`
    : null;
}
