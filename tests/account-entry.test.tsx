import { afterEach, expect, test } from "bun:test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createAccountClient } from "../src/account-client";
import { AccountAccess, GoogleSignIn } from "../src/account-entry";

const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
test("account choices precede explicit guest continuation", async () => {
  globalThis.fetch = (async () =>
    Response.json({ enabled: false })) as unknown as typeof fetch;
  let guest = false;
  render(
    <AccountAccess
      client={createAccountClient()}
      returnPath="/kasse"
      onAuthenticated={() => {}}
      onGuest={() => {
        guest = true;
      }}
    />,
  );
  expect(screen.getByRole("button", { name: "Anmelden" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Neues Konto anlegen" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Als Gast fortfahren" }));
  expect(guest).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Mit Google anmelden" }),
  ).toBeNull();
});
test("Google is offered only after affirmative server configuration", async () => {
  globalThis.fetch = (async () =>
    Response.json({ enabled: true })) as unknown as typeof fetch;
  render(<GoogleSignIn />);
  expect(
    await screen.findByRole("button", { name: "Mit Google anmelden" }),
  ).toBeTruthy();
});
test("missing Google capability endpoint remains hidden", async () => {
  globalThis.fetch = (async () =>
    new Response(null, { status: 404 })) as unknown as typeof fetch;
  render(<GoogleSignIn />);
  await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
});
