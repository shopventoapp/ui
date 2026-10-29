import { afterEach, expect, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { AccountProfile } from "../src/account-client";
import {
  createDashboardClient,
  profileNewsletterAdapter,
} from "../src/dashboard-client";
import { AccountSettings } from "../src/dashboard-settings";

afterEach(cleanup);
const pending = {
  id: 1,
  newsletter_consent: false,
  newsletter_requested_at: "2026-10-16T10:00:00",
  newsletter_confirmed_at: null,
};
function fixture(
  initial: AccountProfile = { id: 1, newsletter_consent: false },
) {
  let profile = initial;
  let status = 200;
  let cooldown = false;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const client = createDashboardClient({
    fetch: async (input, init) => {
      calls.push({ path: String(input), init });
      if (status !== 200)
        return Response.json({ detail: "limited" }, { status });
      if (String(input).endsWith("unsubscribe")) {
        profile = { id: 1, newsletter_consent: false };
        return Response.json({ message: "OK" });
      }
      if (!cooldown)
        profile = {
          ...pending,
          newsletter_requested_at: "2026-10-16T10:10:00",
        };
      return Response.json(profile);
    },
  });
  const adapter = profileNewsletterAdapter(client, async () => profile);
  return {
    client,
    adapter,
    calls,
    fail: (value: number) => {
      status = value;
    },
    cooldown: () => {
      cooldown = true;
    },
  };
}
function settings(f: ReturnType<typeof fixture>) {
  render(
    <AccountSettings
      profile={{ id: 1 }}
      client={f.client}
      minimumAge={18}
      countries={[]}
      newsletter={f.adapter}
      onChanged={() => {}}
      onLogout={() => {}}
      labels={{
        event: "Tasting",
        events: "Tastings",
        eventVoucher: "Voucher",
        product: "Artikel",
        products: "Artikel",
        pickup: "Abholung",
        voucherUse: "",
        newsletter: "Neuigkeiten",
      }}
      routes={{
        overview: "/konto",
        bookings: "/",
        vouchers: "/",
        settings: "/konto/einstellungen",
        events: "/",
        shop: "/",
        reserve: "/",
        passwordSet: "/",
      }}
      help={{
        phone: "",
        phoneLabel: "",
        email: "",
        address: "",
        routeUrl: "",
        hours: "",
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Newsletter/ }));
}
test("adapter distinguishes off, pending, and confirmed with retained request evidence", async () => {
  expect(await fixture().adapter.status()).toBe(false);
  expect(await fixture(pending).adapter.status()).toBe("pending");
  expect(
    await fixture({
      ...pending,
      newsletter_consent: true,
      newsletter_confirmed_at: "2026-10-16T10:05:00",
    }).adapter.status(),
  ).toBe(true);
});
test("off switch explicitly requests DOI and shows pending without claiming confirmation", async () => {
  const f = fixture();
  settings(f);
  const toggle = await screen.findByRole("switch");
  await waitFor(() =>
    expect((toggle as HTMLInputElement).disabled).toBe(false),
  );
  fireEvent.click(toggle);
  await screen.findByRole("button", { name: "Anmeldung abbrechen" });
  expect((toggle as HTMLInputElement).checked).toBe(false);
  expect(f.calls).toHaveLength(1);
  expect(f.calls[0]?.init?.body).toBe('{"newsletter_consent":true}');
});
test("pending resend explains link replacement and cancellation posts no body", async () => {
  const f = fixture(pending);
  settings(f);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Bestätigungs-E-Mail erneut senden",
    }),
  );
  await screen.findByText(
    "Wir haben Dir eine neue Bestätigungs-E-Mail geschickt.",
  );
  expect(screen.getByText(/24 Stunden/).textContent).toContain(
    "bisherigen ungültig",
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Anmeldung abbrechen",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Anmeldung abbrechen" }),
    );
  });
  await waitFor(() =>
    expect(
      !!screen.queryByRole("button", { name: "Anmeldung abbrechen" }),
    ).toBe(false),
  );
  expect(f.calls[1]?.path).toBe("/api/shop/user/newsletter/unsubscribe");
  expect(f.calls[1]?.init?.method).toBe("POST");
  expect(f.calls[1]?.init?.body).toBeUndefined();
  expect(f.calls[1]?.init?.headers).not.toHaveProperty("Content-Type");
});
for (const response of ["unchanged profile", "429"]) {
  test(`pending resend handles cooldown response: ${response}`, async () => {
    const f = fixture(pending);
    if (response === "429") f.fail(429);
    else f.cooldown();
    settings(f);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Bestätigungs-E-Mail erneut senden",
      }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "fünf Minuten",
    );
    expect(
      screen.getByRole("button", { name: "Anmeldung abbrechen" }),
    ).toBeTruthy();
  });
}
test("failed cancellation preserves pending and allows retry", async () => {
  const f = fixture(pending);
  f.fail(503);
  settings(f);
  fireEvent.click(
    await screen.findByRole("button", { name: "Anmeldung abbrechen" }),
  );
  await screen.findByRole("alert");
  f.fail(200);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Anmeldung abbrechen",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Anmeldung abbrechen" }),
    );
  });
  await screen.findByText("Deine Anmeldung wurde abgebrochen.");
});
test("confirmed switch revokes via authenticated unsubscribe", async () => {
  const f = fixture({
    ...pending,
    newsletter_consent: true,
    newsletter_confirmed_at: "2026-10-16T10:05:00",
  });
  settings(f);
  const toggle = await screen.findByRole("switch");
  await waitFor(() => expect((toggle as HTMLInputElement).checked).toBe(true));
  fireEvent.click(toggle);
  await screen.findByText("Du bist abgemeldet.");
  expect(f.calls[0]?.path).toBe("/api/shop/user/newsletter/unsubscribe");
});
