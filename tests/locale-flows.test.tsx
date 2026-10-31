import { afterEach, expect, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AccountApiError,
  accountErrorMessage,
  accountFieldErrors,
  createAccountClient,
} from "../src/account-client";
import {
  LoginForm,
  PasswordResetRequest,
  PasswordSetForm,
  RegisterForm,
} from "../src/account-components";
import {
  BirthDateInput,
  birthDateFromISO,
  birthDateToISO,
} from "../src/account-fields";
import { availability, bookingTime, DateList } from "../src/calendar";
import type { ShopEvent, Timewindow } from "../src/client";
import {
  BookingApiError,
  bookingErrorMessage,
  createBookingClient,
} from "../src/client";
import { EventBooking } from "../src/components";
import { ShopventoProvider } from "../src/locale";

afterEach(cleanup);
const german =
  /\b(?:Bitte|Deine|Dein|Passwort|Anmelden|Gutscheincode|Plätze|Uhr|Buchungsfrist|Termin)\b/;
const account = createAccountClient({
  fetch: async () => Response.json({ id: 1 }),
});
test("standalone auth props select English and preserve single-key host overrides", () => {
  for (const node of [
    <LoginForm key="login" client={account} locale="en" />,
    <RegisterForm
      key="register"
      client={account}
      locale="en"
      termsUrl="/terms"
      privacyUrl="/privacy"
    />,
    <PasswordResetRequest key="reset" client={account} locale="en" />,
    <PasswordSetForm key="set" client={account} locale="en" token="fixture" />,
  ]) {
    const html = renderToStaticMarkup(node);
    expect(html).not.toMatch(german);
  }
  const html = renderToStaticMarkup(
    <LoginForm
      client={account}
      locale="en"
      messages={{ account: { Anmelden: "Enter the atelier" } }}
    />,
  );
  expect(html).toContain("Enter the atelier");
  expect(html).toContain("Password");
});
const window: Timewindow = {
  id: "one",
  timewindow_id: "one",
  tasting_id: 1,
  franchise_location_id: 1,
  date: "2099-12-12",
  start_time: "18:30:00",
  end_time: "21:00:00",
  event_name: "Workshop",
  max_participants: 10,
  free_spots: 3,
  availabilityStatus: "available",
};
const event: ShopEvent = {
  tasting_id: 1,
  tasting_name: "Workshop",
  full_name: "Workshop",
  price: 4900,
  variant_id: null,
};
test("English dates combine localized availability, money and times", () => {
  const html = renderToStaticMarkup(
    <DateList
      windows={[window]}
      events={[event]}
      onSelect={() => {}}
      locale="en"
    />,
  );
  expect(html).not.toMatch(german);
  expect(html).toContain("Only 3 places left");
  expect(html).toContain("€49.00");
  expect(bookingTime(window, "en")).toMatch(/PM/);
  expect(availability(window, 1, 24, Date.now(), { locale: "en" }).text).toBe(
    "Only 3 places left",
  );
});
test("compact English booking renders all fields from its own prop scope", async () => {
  const client = createBookingClient({
    baseUrl: "",
    fetch: async (input) => {
      const path = String(input);
      return Response.json(
        path.endsWith("/settings")
          ? { direct_booking_enabled: true, guest_booking_enabled: true }
          : path.endsWith("/locations")
            ? { locations: [{ id: 1, location_name: "Atelier" }] }
            : path.includes("timewindows")
              ? { timewindows: [window] }
              : [event],
      );
    },
  });
  const view = render(
    <EventBooking
      locale="en"
      client={client}
      baseUrl=""
      eventId={1}
      termsUrl="/terms"
      privacyUrl="/privacy"
    />,
  );
  await waitFor(() => expect(view.getByLabelText("First name")).toBeTruthy());
  expect(view.container.textContent).not.toMatch(german);
  expect(view.getByRole("button", { name: "Book and pay" })).toBeTruthy();
});
test("birth date helpers and editable fields accept both English ISO and numeric input", () => {
  expect(birthDateFromISO("2000-12-31", "en")).toBe("12/31/2000");
  expect(birthDateFromISO("2000-12-31", "en-GB")).toBe("31/12/2000");
  expect(birthDateToISO("12/31/2000", "en")).toBe("2000-12-31");
  expect(birthDateToISO("2000-12-31", "en")).toBe("2000-12-31");
  let result = "";
  const view = render(
    <ShopventoProvider locale="en-GB">
      <BirthDateInput
        value=""
        onValueChange={(value) => {
          result = value;
        }}
        aria-label="Birthday"
      />
    </ShopventoProvider>,
  );
  const input = view.getByLabelText("Birthday");
  expect(input.getAttribute("placeholder")).toBe("DD/MM/YYYY");
  fireEvent.change(input, { target: { value: "31122000" } });
  expect(result).toBe("31/12/2000");
});
test("client helpers take explicit per-call locale and never leak German errors into English", () => {
  expect(
    accountErrorMessage(new AccountApiError(401, null), false, undefined, {
      locale: "en",
    }),
  ).toContain("session has expired");
  expect(
    accountFieldErrors(new AccountApiError(422, [{ loc: ["body", "email"] }]), {
      locale: "en",
    }).email,
  ).toBe("Please enter a valid email address.");
  expect(
    bookingErrorMessage(new BookingApiError(429, null), { locale: "en" }),
  ).toContain("Too many requests");
  expect(
    bookingErrorMessage(
      new BookingApiError(
        400,
        "Dieser Gutschein ist aus anderem Grund ungültig.",
      ),
      { locale: "en" },
    ),
  ).not.toMatch(german);
});

test("birth date inputs confirm ambiguous numeric dates in words in each locale", () => {
  for (const [locale, expected] of [
    ["en-US", "December 11, 2000"],
    ["en-GB", "12 November 2000"],
    ["de", "12. November 2000"],
  ]) {
    const value = locale === "de" ? "12.11.2000" : "12/11/2000";
    const view = render(
      <ShopventoProvider locale={locale}>
        <BirthDateInput
          value={value}
          onValueChange={() => {}}
          aria-label="Birthday"
        />
      </ShopventoProvider>,
    );
    expect(view.container.textContent).toContain(expected);
    cleanup();
  }
});
test("unrecognized account details use localized generic copy", () => {
  for (const status of [409, 422])
    expect(
      accountErrorMessage(
        new AccountApiError(status, "Unbekannter interner Fehler"),
        false,
        undefined,
        { locale: "en" },
      ),
    ).toBe("Please check your details and try again.");
});

test("events do not reload when only the provider catalogue changes", async () => {
  const { useEvents } = await import("../src/hooks");
  let calls = 0;
  const client = createBookingClient({
    baseUrl: "",
    fetch: async () => {
      calls++;
      return Response.json([]);
    },
  });
  function Events() {
    const result = useEvents(client);
    return <p>{result.loading ? "Loading" : "Ready"}</p>;
  }
  const view = render(
    <ShopventoProvider locale="en">
      <Events />
    </ShopventoProvider>,
  );
  await waitFor(() => expect(view.getByText("Ready")).toBeTruthy());
  await act(async () => {
    view.rerender(
      <ShopventoProvider
        locale="en"
        messages={{ shop: { "Dein Einkauf": "Basket" } }}
      >
        <Events />
      </ShopventoProvider>,
    );
  });
  expect(calls).toBe(1);
});
