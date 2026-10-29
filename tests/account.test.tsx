import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  AccountApiError,
  type AccountClient,
  type AccountFetch,
  accountBirthDateError,
  accountDocumentReturnPath,
  accountPasswordRules,
  createAccountClient,
  safeAccountReturnPath,
} from "../src/account-client";
import {
  EmailChangeConfirm,
  EmailVerify,
  LoginForm,
  PasswordResetRequest,
  PasswordSetForm,
  RegisterForm,
} from "../src/account-components";
import { useAccountSession } from "../src/account-hooks";

afterEach(cleanup);
function fixture(age = 16, status = 200) {
  const calls: Array<{ path: string; init?: RequestInit; body: unknown }> = [];
  const client = createAccountClient({
    fetch: (async (input, init) => {
      const path = String(input);
      calls.push({
        path,
        init,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return Response.json(
        path.endsWith("settings")
          ? { min_customer_age: age }
          : path.endsWith("profile")
            ? { id: 1 }
            : path.endsWith("login")
              ? { customer: { id: 1 }, message: "OK" }
              : { message: "OK" },
        { status },
      );
    }) as AccountFetch,
  });
  return { client, calls };
}
function input(name: string, value: string) {
  const element = document.querySelector(`input[name="${name}"]`);
  if (!element) throw new Error(`Missing field ${name}`);
  fireEvent.change(element, {
    target: { value },
  });
}
function validRegistration() {
  for (const [key, val] of Object.entries({
    first_name: "Test",
    last_name: "Person",
    email: "test@example.invalid",
    password: "abcdefgh1",
    confirm_password: "abcdefgh1",
  }))
    input(key, val);
  const terms = document.querySelector('input[name="terms"]');
  if (!terms) throw new Error("Missing terms checkbox");
  fireEvent.click(terms);
}
describe("account wire transport", () => {
  test("uses relative paths, same-origin cookies and exact request bodies", async () => {
    const { client, calls } = fixture();
    await client.login({ email: "test@example.invalid", password: "abc" });
    await client.requestPasswordReset({ email: "test@example.invalid" });
    await client.setPassword({ token: "secret", new_password: "abcdefgh1" });
    await client.verifyEmail({ token: "verify" });
    await client.confirmEmailChange({ token: "change" });
    const controller = new AbortController();
    await client.getProfile(controller.signal);
    await client.logout();
    await client.getSettings();
    expect(calls.map((call) => call.path)).toEqual([
      "/api/shop/user/login",
      "/api/shop/user/password-reset",
      "/api/shop/user/password-reset/confirm",
      "/api/shop/user/verify-email",
      "/api/shop/user/confirm-email-change",
      "/api/shop/user/profile",
      "/api/shop/user/logout",
      "/api/shop/settings",
    ]);
    for (const call of calls) {
      expect(call.init?.credentials).toBe("same-origin");
      expect(call.init?.redirect).toBe("error");
      expect(call.init?.cache).toBe("no-store");
      expect(call.init?.headers).not.toHaveProperty("Authorization");
    }
    expect(calls[2].body).toEqual({
      token: "secret",
      new_password: "abcdefgh1",
    });
    expect(calls[5].init?.signal).toBe(controller.signal);
  });
  test("expired requests notify host, credential rejection does not redirect", async () => {
    const expired = mock();
    const client = createAccountClient({
      onUnauthorized: expired,
      fetch: (async () =>
        Response.json({ detail: "bad" }, { status: 401 })) as AccountFetch,
    });
    await expect(
      client.login({ email: "test@example.invalid", password: "wrong" }),
    ).rejects.toBeInstanceOf(AccountApiError);
    expect(expired).not.toHaveBeenCalled();
    await expect(client.getProfile()).rejects.toBeInstanceOf(AccountApiError);
    expect(expired).toHaveBeenCalledTimes(1);
    await expect(client.verifyEmail({ token: "t" })).rejects.toBeInstanceOf(
      AccountApiError,
    );
    expect(expired).toHaveBeenCalledTimes(2);
  });
});
describe("password, age and redirect boundaries", () => {
  test("Unicode character minimum and UTF-8 byte boundaries and any non-letter including spaces", () => {
    expect(accountPasswordRules("äöü!").length).toBe(false);
    expect(accountPasswordRules("ääää!")).toEqual({
      length: false,
      letter: true,
      nonLetter: true,
    });
    expect(accountPasswordRules("😀😀😀😀😀😀a!").length).toBe(true);
    expect(accountPasswordRules("😀😀😀😀😀a!").length).toBe(false);
    expect(accountPasswordRules(`${"ä".repeat(35)}a!`).length).toBe(true);
    expect(accountPasswordRules(`${"ä".repeat(36)}!`).length).toBe(false);
    expect(accountPasswordRules("abcdefgh ").nonLetter).toBe(true);
    expect(accountPasswordRules("abcdefgh").nonLetter).toBe(false);
    expect(accountPasswordRules("12345678").letter).toBe(false);
  });
  test("age comes from settings, with birthday, optional and plausible date boundaries", () => {
    expect(accountBirthDateError("2010-10-07", 16, "2026-10-07")).toBeNull();
    expect(accountBirthDateError("2010-10-08", 16, "2026-10-07")).toContain(
      "Mindestalter von 16",
    );
    expect(accountBirthDateError("2010-10-07", 21, "2026-10-07")).toContain(
      "Mindestalter von 21",
    );
    expect(accountBirthDateError("", 0)).toBeNull();
    expect(accountBirthDateError("", 16)).toBeNull();
    for (const date of ["1899-12-31", "2026-10-08", "2000-02-30", "invalid"])
      expect(accountBirthDateError(date, 0, "2026-10-07")).not.toBeNull();
  });
  test("rejects external, encoded and normalized unsafe return paths and login loops", () => {
    expect(safeAccountReturnPath("/konto/buchungen?tab=offen#ticket")).toBe(
      "/konto/buchungen?tab=offen#ticket",
    );
    for (const path of [
      "https://outside.invalid",
      "//outside.invalid",
      "/\\outside.invalid",
      "/..//outside.invalid",
      "/%2foutside.invalid",
      "/%5coutside.invalid",
      "/konto/anmelden",
      "/konto/anmelden.html",
      "/konto//anmelden",
      "/konto/%2fanmelden.html",
      "/api/shop/settings",
      "/api//shop/settings.html",
      "/%61pi/shop/settings",
      "/konto/%61nmelden",
      "/login",
      "/login/callback",
      "/bad\npath",
    ])
      expect(safeAccountReturnPath(path)).toBeNull();
    expect(
      safeAccountReturnPath("/konto//buchungen.html?tab=offen#ticket"),
    ).toBe("/konto/buchungen?tab=offen#ticket");
    const invoice =
      "/api/shop/stripe/invoice/12345678-1234-1234-1234-123456789abc";
    expect(accountDocumentReturnPath(encodeURIComponent(invoice))).toBe(
      invoice,
    );
    expect(
      accountDocumentReturnPath(invoice.replace("invoice", "credit-note")),
    ).not.toBeNull();
    for (const path of [
      "/konto",
      `${invoice}?x=1`,
      `${invoice}/..`,
      "https://outside.invalid",
      "%xx",
      "/api/shop/stripe/invoice/not-a-uuid",
    ])
      expect(accountDocumentReturnPath(path)).toBeNull();
  });
});
test("registration sends only name, email, password and consent without settings", async () => {
  const { client, calls } = fixture(21);
  render(
    <RegisterForm
      client={client}
      termsUrl="/custom-terms"
      privacyUrl="/custom-privacy"
    />,
  );
  await screen.findByRole("form", { name: "Konto anlegen" });
  expect(
    document
      .querySelector('input[name="newsletter_consent"]')
      ?.hasAttribute("checked"),
  ).toBe(false);
  expect(screen.getByRole("link", { name: "AGB" }).getAttribute("href")).toBe(
    "/custom-terms",
  );
  expect(
    screen
      .getByRole("link", { name: "Datenschutzhinweise" })
      .getAttribute("href"),
  ).toBe("/custom-privacy");
  validRegistration();
  fireEvent.submit(screen.getByRole("form", { name: "Konto anlegen" }));
  await screen.findByText("Bitte schau in Dein E-Mail-Postfach.");
  expect(calls.at(-1)?.body).toEqual({
    first_name: "Test",
    last_name: "Person",
    email: "test@example.invalid",
    newsletter_consent: false,
    marketing_consent: true,
    password: "abcdefgh1",
  });
});
test("registration omits address and birth date even with a positive minimum age", async () => {
  const { client, calls } = fixture(18);
  render(
    <RegisterForm client={client} termsUrl="/terms" privacyUrl="/privacy" />,
  );
  await screen.findByRole("form", { name: "Konto anlegen" });
  validRegistration();
  fireEvent.submit(screen.getByRole("form", { name: "Konto anlegen" }));
  await screen.findByText("Bitte schau in Dein E-Mail-Postfach.");
  expect(calls.at(-1)?.body).not.toHaveProperty("birth_date");
  expect(calls.at(-1)?.body).not.toHaveProperty("country");
  expect(calls.some((c) => c.path.endsWith("settings"))).toBe(false);
});
test("registration renders without fetching unavailable settings", () => {
  const transport = mock(async () => Response.json({}, { status: 503 }));
  const client = createAccountClient({ fetch: transport as AccountFetch });
  render(
    <RegisterForm client={client} termsUrl="/terms" privacyUrl="/privacy" />,
  );
  expect(screen.getByRole("form", { name: "Konto anlegen" })).toBeTruthy();
  expect(transport).not.toHaveBeenCalled();
  for (const name of [
    "country",
    "birth_date",
    "phone",
    "address1",
    "postal_code",
    "city",
  ])
    expect(document.querySelector(`input[name="${name}"]`)).toBeNull();
});
test("login rejects credentials inline without the expired-session message", async () => {
  const { client } = fixture(16, 401);
  render(<LoginForm client={client} />);
  input("email", "test@example.invalid");
  input("password", "wrong");
  fireEvent.submit(screen.getByRole("form", { name: "Anmelden" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "E-Mail-Adresse oder Passwort stimmen nicht",
    ),
  );
  expect(screen.queryByText(/Deine Sitzung ist abgelaufen/)).toBeNull();
  await waitFor(() =>
    expect(document.activeElement?.getAttribute("role")).toBe("alert"),
  );
  expect(
    document
      .querySelector('input[name="password"]')
      ?.getAttribute("aria-describedby"),
  ).toBeTruthy();
});
test("password reset is generic even if the upstream response varies", async () => {
  const client = createAccountClient({
    fetch: (async () =>
      Response.json({ message: "account does not exist" })) as AccountFetch,
  });
  render(<PasswordResetRequest client={client} />);
  input("email", "test@example.invalid");
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText(/Wenn es zu dieser E-Mail-Adresse ein Konto gibt/);
  expect(screen.queryByText("account does not exist")).toBeNull();
});
test("password setup prevents mismatches and submits its in-memory token", async () => {
  const { client, calls } = fixture();
  render(
    <PasswordSetForm
      client={client}
      token="secret-token"
      accountUrl="/custom-account"
    />,
  );
  input("new_password", "abcdefgh1");
  input("confirm_password", "abcdefgh2");
  fireEvent.submit(screen.getByRole("form"));
  expect(document.activeElement?.getAttribute("name")).toBe("confirm_password");
  expect(calls).toHaveLength(0);
  input("confirm_password", "abcdefgh1");
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("Dein Passwort ist festgelegt.");
  expect(screen.getByText("Du bist jetzt angemeldet.")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Zu Deinem Konto" }).getAttribute("href"),
  ).toBe("/custom-account");
  expect(calls[0].body).toEqual({
    token: "secret-token",
    new_password: "abcdefgh1",
  });
});
for (const [Component, path] of [
  [EmailVerify, "verify-email"],
  [EmailChangeConfirm, "confirm-email-change"],
] as const) {
  test(`${path} consumes only after explicit confirmation and never shows false success`, async () => {
    const { client, calls } = fixture(16, 400);
    render(<Component client={client} token="token" />);
    expect(calls).toHaveLength(0);
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText(
      Component === EmailVerify
        ? /ungültig oder wurde bereits verwendet/
        : /Dieser Link ist ungültig oder abgelaufen/,
    );
    expect(calls[0].path).toEndWith(path);
    expect(screen.queryByText(/ist bestätigt/)).toBeNull();
  });
}
test("missing tokens make no request and provide recovery navigation", () => {
  const { client, calls } = fixture();
  render(<PasswordSetForm client={client} token={null} />);
  expect(
    screen.getByRole("link", { name: "Neuen Link anfordern" }),
  ).toBeTruthy();
  expect(screen.queryByRole("form")).toBeNull();
  expect(calls).toHaveLength(0);
});
test("session hook handles reload, logout and a stale response after unmount", async () => {
  const { client } = fixture();
  const hook = renderHook(() => useAccountSession(client));
  await waitFor(() => expect(hook.result.current.authenticated).toBe(true));
  await act(async () => {
    await hook.result.current.logout();
  });
  expect(hook.result.current.authenticated).toBe(false);
  act(() => hook.result.current.reload());
  await waitFor(() => expect(hook.result.current.authenticated).toBe(true));
  hook.unmount();
  let signal: AbortSignal | undefined;
  let resolveProfile: ((value: { id: number }) => void) | undefined;
  const slow: AccountClient = {
    ...client,
    getProfile: (s) => {
      signal = s;
      return new Promise((resolve) => {
        resolveProfile = resolve;
      });
    },
  };
  const pending = renderHook(() => useAccountSession(slow));
  pending.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => resolveProfile?.({ id: 2 }));
});

test("logout prevents an earlier profile read from restoring authentication", async () => {
  const { client } = fixture();
  let finishRead: ((value: { id: number }) => void) | undefined;
  let signal: AbortSignal | undefined;
  const slow: AccountClient = {
    ...client,
    getProfile: (s) => {
      signal = s;
      return new Promise((resolve) => {
        finishRead = resolve;
      });
    },
  };
  const hook = renderHook(() => useAccountSession(slow));
  await act(async () => {
    await hook.result.current.logout();
  });
  expect(signal?.aborted).toBe(true);
  await act(async () => finishRead?.({ id: 1 }));
  expect(hook.result.current.authenticated).toBe(false);
  expect(hook.result.current.loading).toBe(false);
});

test("password setup maps current-password rejection to its field and permits retry", async () => {
  const { client } = fixture();
  const detail =
    "Dein neues Passwort muss sich von Deinem aktuellen Passwort unterscheiden.";
  const setPassword = mock(async () => {
    throw new AccountApiError(400, detail);
  });
  render(
    <PasswordSetForm client={{ ...client, setPassword }} token="still-valid" />,
  );
  input("new_password", "abcdefgh1");
  input("confirm_password", "abcdefgh1");
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() =>
    expect(
      document
        .querySelector('input[name="new_password"]')
        ?.getAttribute("aria-invalid"),
    ).toBe("true"),
  );
  const field = document.querySelector('input[name="new_password"]');
  expect(
    document.getElementById(
      field
        ?.getAttribute("aria-describedby")
        ?.split(" ")
        .find((id) => id.endsWith("-error")) ?? "",
    )?.textContent,
  ).toBe(detail);
  expect(screen.queryByText(/Link ist ungültig/)).toBeNull();
  input("new_password", "abcdefgh2");
  input("confirm_password", "abcdefgh2");
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(setPassword).toHaveBeenCalledTimes(2));
});
for (const detail of ["Email not verified", undefined])
  test(`login 403 distinguishes JSON detail from edge rejection (${detail})`, async () => {
    const client = createAccountClient({
      fetch: (async () =>
        detail
          ? Response.json({ detail }, { status: 403 })
          : new Response("Forbidden", { status: 403 })) as AccountFetch,
    });
    render(<LoginForm client={client} />);
    input("email", "test@example.invalid");
    input("password", "abcdefgh1");
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        detail
          ? "Bitte bestätige zuerst Deine E-Mail-Adresse."
          : "Die Anfrage wurde abgelehnt.",
      ),
    );
    if (detail)
      expect(screen.getByRole("alert").textContent).toContain(
        "Passwort vergessen",
      );
  });
test("email change displays the safe backend reason for an address already used", async () => {
  const detail =
    "Diese E-Mail-Adresse wird bereits für ein anderes Konto verwendet. Bitte gib eine andere E-Mail-Adresse ein.";
  const client = createAccountClient({
    fetch: (async () =>
      Response.json({ detail }, { status: 400 })) as AccountFetch,
  });
  render(<EmailChangeConfirm client={client} token="token" />);
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText(detail);
  expect(screen.queryByText(/Link ist ungültig/)).toBeNull();
});
test("expired session notice describes the login form", () => {
  const { client } = fixture();
  render(<LoginForm client={client} notice="Deine Sitzung ist abgelaufen." />);
  const form = screen.getByRole("form");
  expect(
    document.getElementById(form.getAttribute("aria-describedby") ?? "")
      ?.textContent,
  ).toBe("Deine Sitzung ist abgelaufen.");
});

for (const newsletter of [false, true]) {
  test(`registration explains separate newsletter confirmation only when chosen: ${newsletter}`, async () => {
    const { client, calls } = fixture();
    render(
      <RegisterForm client={client} termsUrl="/terms" privacyUrl="/privacy" />,
    );
    validRegistration();
    if (newsletter) {
      const checkbox = document.querySelector(
        'input[name="newsletter_consent"]',
      );
      if (!checkbox) throw new Error("Missing newsletter checkbox");
      fireEvent.click(checkbox);
    }
    fireEvent.submit(screen.getByRole("form", { name: "Konto anlegen" }));
    await screen.findByText("Bitte schau in Dein E-Mail-Postfach.");
    expect(!!screen.queryByText(/separate Bestätigungs-E-Mail/)).toBe(
      newsletter,
    );
    expect(calls[0]?.body).toMatchObject({ newsletter_consent: newsletter });
  });
}

test("registration prefills the supplied guest email while allowing edits", () => {
  const client = {} as AccountClient;
  render(
    <RegisterForm
      client={client}
      termsUrl="/terms"
      privacyUrl="/privacy"
      initialEmail="guest@example.com"
    />,
  );
  expect(
    (screen.getByLabelText("E-Mail-Adresse") as HTMLInputElement).value,
  ).toBe("guest@example.com");
});
