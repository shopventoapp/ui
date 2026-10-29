import { afterEach, expect, mock, test } from "bun:test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import {
  AccountApiError,
  accountBirthDateError,
  accountFieldErrors,
} from "../src/account-client";
import {
  accountCountryOption,
  BirthDateInput,
  birthDateFromISO,
  birthDateToISO,
  CountrySelect,
  maskBirthDate,
} from "../src/account-fields";
import { createDashboardClient } from "../src/dashboard-client";
import type { DashboardProps } from "../src/dashboard-components";
import { AccountSettings } from "../src/dashboard-settings";

afterEach(cleanup);
const countries = [
  { value: "AT", label: "Österreich" },
  { value: "DE", label: "Deutschland" },
];

test("country defaults to the installation, sends ISO and preserves unknown stored values", () => {
  const { rerender } = render(
    <CountrySelect countries={countries} aria-label="Land" name="country" />,
  );
  const select = screen.getByLabelText("Land") as HTMLSelectElement;
  expect(select.value).toBe("AT");
  fireEvent.change(select, { target: { value: "DE" } });
  expect(select.value).toBe("DE");
  rerender(
    <CountrySelect
      key="legacy"
      countries={countries}
      defaultValue="<legacy>"
      aria-label="Land"
    />,
  );
  expect((screen.getByLabelText("Land") as HTMLSelectElement).value).toBe(
    "<legacy>",
  );
  expect(screen.getByRole("option", { name: "<legacy>" }).textContent).toBe(
    "<legacy>",
  );
});

test("birth date conversion rejects partial input and validation rejects impossible/future/implausible dates", () => {
  expect(maskBirthDate("1990-01-01")).toBe("01.01.1990");
  expect(maskBirthDate("1.1.1990")).toBe("01.01.1990");
  expect(maskBirthDate("01011990")).toBe("01.01.1990");
  expect(birthDateFromISO("1990-01-01")).toBe("01.01.1990");
  expect(birthDateToISO("01.01.1990")).toBe("1990-01-01");
  expect(birthDateToISO("")).toBe("");
  expect(birthDateToISO("01.01.199")).toBeNull();
  for (const date of [
    "31.02.2000",
    "29.02.1900",
    "01.01.1899",
    "01.01.1900",
    "01.01.2999",
  ])
    expect(
      accountBirthDateError(
        birthDateToISO(date) ?? "invalid",
        18,
        "2026-10-08",
      ),
    ).not.toBeNull();
  expect(accountBirthDateError("2000-02-29", 18, "2026-10-08")).toBeNull();
  expect(accountBirthDateError("", 18)).toBeNull();
});

test("mask inserts dots, advances caret and Backspace removes a digit across separators", () => {
  function Mask() {
    const [value, setValue] = useState("");
    return (
      <BirthDateInput
        aria-label="Datum"
        value={value}
        onValueChange={setValue}
      />
    );
  }
  render(<Mask />);
  const field = screen.getByLabelText("Datum") as HTMLInputElement;
  fireEvent.change(field, { target: { value: "01", selectionStart: 2 } });
  expect(field.value).toBe("01.");
  expect(field.selectionStart).toBe(3);
  fireEvent.change(field, { target: { value: "01", selectionStart: 2 } });
  expect(field.value).toBe("0");
  expect(field.selectionStart).toBe(1);
  fireEvent.change(field, { target: { value: "01", selectionStart: 2 } });
  fireEvent.keyDown(field, { key: "Backspace" });
  expect(field.value).toBe("0");
  expect(field.selectionStart).toBe(1);
  fireEvent.change(field, { target: { value: "01011990", selectionStart: 8 } });
  expect(field.value).toBe("01.01.1990");
  expect(field.selectionStart).toBe(10);
  field.setSelectionRange(3, 3);
  fireEvent.keyDown(field, { key: "Backspace" });
  expect(field.value).toBe("00.11.990");
  expect(field.selectionStart).toBe(1);
  fireEvent.change(field, { target: { value: "01011990", selectionStart: 8 } });
  fireEvent.change(field, {
    target: { value: "01.051.1990", selectionStart: 5 },
  });
  expect(field.value).toBe("01.05.1990");
  expect(field.selectionStart).toBe(6);
  fireEvent.input(field, {
    inputType: "insertFromPaste",
    target: { value: "1990-04-12", selectionStart: 10 },
  });
  expect(field.value).toBe("12.04.1990");
  fireEvent.input(field, {
    inputType: "insertFromPaste",
    target: { value: "1.4.1990", selectionStart: 8 },
  });
  expect(field.value).toBe("01.04.1990");
  expect(field.selectionStart).toBe(10);
});

test("personal settings convert typed dates, reject invalid ones and allow clearing at age 18", async () => {
  const updateProfile = mock(async (_body: { birth_date?: string | null }) => ({
    id: 1,
  }));
  const client = { ...createDashboardClient(), updateProfile };
  const props: DashboardProps = {
    client,
    profile: {
      id: 1,
      first_name: "Test",
      last_name: "Person",
      birth_date: "1990-01-01",
    },
    labels: {
      event: "Event",
      events: "Events",
      eventVoucher: "Gutscheine",
      product: "Artikel",
      products: "Artikel",
      pickup: "Abholung",
      voucherUse: "Einlösen",
      newsletter: "Newsletter",
      ageHint: "Pickup only note",
      birthDateHint: "Optional birthday note",
    },
    routes: {
      overview: "/",
      bookings: "/",
      vouchers: "/",
      settings: "/",
      events: "/",
      shop: "/",
      reserve: "/",
      passwordSet: "/",
    },
    help: {
      phone: "",
      phoneLabel: "",
      email: "",
      address: "",
      routeUrl: "",
      hours: "",
    },
  };
  render(
    <AccountSettings
      {...props}
      minimumAge={18}
      countries={countries}
      newsletter={{
        status: async () => false,
        subscribe: async () => {},
        unsubscribe: async () => {},
      }}
      onChanged={() => {}}
      onLogout={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Persönliche Daten/ }));
  const phone = screen.getByLabelText("Telefon (optional)");
  const preview = document.getElementById(
    phone.getAttribute("aria-describedby") ?? "",
  );
  expect(preview).not.toBeNull();
  expect(preview?.textContent).toBe("");
  fireEvent.change(phone, { target: { value: "0151 / 23456789" } });
  expect(preview?.textContent).toBe("Wird gespeichert als +4915123456789");
  fireEvent.change(phone, { target: { value: "abc" } });
  expect(preview?.textContent).toBe("Wird gespeichert als bitte prüfen");
  fireEvent.change(phone, { target: { value: "   " } });
  expect(preview?.textContent).toBe("");
  fireEvent.change(phone, { target: { value: "" } });
  const birth = screen.getByLabelText(/^Geburtsdatum/) as HTMLInputElement;
  expect(birth.value).toBe("01.01.1990");
  expect(birth.labels?.[0]?.textContent).toBe("Geburtsdatum (optional)");
  expect(screen.getByText("Format: TT.MM.JJJJ.")).toBeTruthy();
  expect(
    screen.getByText("Optional birthday note", { exact: false }),
  ).toBeTruthy();
  expect(screen.queryByText("Pickup only note")).toBeNull();
  fireEvent.change(birth, { target: { value: "31022000" } });
  fireEvent.submit(birth.closest("form") as HTMLFormElement);
  expect(updateProfile).not.toHaveBeenCalled();
  expect(birth.getAttribute("aria-invalid")).toBe("true");
  fireEvent.change(birth, { target: { value: "01011990" } });
  fireEvent.submit(birth.closest("form") as HTMLFormElement);
  await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
  expect(updateProfile.mock.calls[0]?.[0]).toMatchObject({
    birth_date: "1990-01-01",
  });
  fireEvent.change(birth, { target: { value: "" } });
  fireEvent.submit(birth.closest("form") as HTMLFormElement);
  await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(2));
  expect(updateProfile.mock.calls[1]?.[0]).toMatchObject({ birth_date: null });
  fireEvent.change(phone, { target: { value: "abc" } });
  fireEvent.submit(birth.closest("form") as HTMLFormElement);
  expect(updateProfile).toHaveBeenCalledTimes(2);
  expect(phone.getAttribute("aria-invalid")).toBe("true");
  expect(preview?.textContent).toBe(
    "Bitte gib eine gültige Telefonnummer ein.",
  );
});

test("legacy aliases and labels resolve without reordering the API options", () => {
  for (const value of ["Germany", "de", "DEUTSCHLAND"])
    expect(accountCountryOption(countries, value)?.label).toBe("Deutschland");
  expect(accountCountryOption(countries, "Austria")?.value).toBe("AT");
  expect(
    accountCountryOption([{ value: "NL", label: "Niederlande" }], "Netherlands")
      ?.value,
  ).toBe("NL");
  render(
    <CountrySelect
      countries={countries}
      defaultValue="gErMaNy"
      aria-label="Land"
    />,
  );
  expect((screen.getByLabelText("Land") as HTMLSelectElement).value).toBe("DE");
  expect(
    screen.getAllByRole("option").map((option) => option.textContent),
  ).toEqual(["Österreich", "Deutschland"]);
});

test("country errors describe the select without entering its accessible name", () => {
  render(
    <>
      <label htmlFor="country">Land</label>
      <CountrySelect
        id="country"
        countries={countries}
        error="Bitte wähle ein gültiges Land aus."
      />
    </>,
  );
  const select = screen.getByRole("combobox", { name: "Land" });
  expect(select.getAttribute("aria-invalid")).toBe("true");
  expect(
    document.getElementById(select.getAttribute("aria-describedby") ?? "")
      ?.textContent,
  ).toBe("Bitte wähle ein gültiges Land aus.");
});

test("backend country rejection maps to an actionable field message", () => {
  expect(
    accountFieldErrors(
      new AccountApiError(422, [
        { loc: ["body", "country"], msg: "backend value error" },
      ]),
    ),
  ).toEqual({ country: "Bitte wähle ein gültiges Land aus." });
});

for (const [segment, start, end, typed, expected] of [
  ["day", 0, 2, "25", "25.01.1990"],
  ["day", 0, 2, "15", "15.01.1990"],
  ["day", 0, 2, "02", "02.01.1990"],
  ["month", 3, 5, "12", "01.12.1990"],
  ["month", 3, 5, "11", "01.11.1990"],
  ["month", 3, 5, "05", "01.05.1990"],
  ["year", 6, 10, "2001", "01.01.2001"],
  ["whole date", 0, 10, "15081985", "15.08.1985"],
] as const) {
  test(`retyping selected ${segment} as ${typed} preserves the typed digits`, () => {
    function Mask() {
      const [value, setValue] = useState("01.01.1990");
      return (
        <BirthDateInput
          aria-label="Datum"
          value={value}
          onValueChange={setValue}
        />
      );
    }
    render(<Mask />);
    const field = screen.getByLabelText("Datum") as HTMLInputElement;
    field.setSelectionRange(start, end);
    for (const digit of typed) {
      const position = field.selectionStart ?? 0;
      const finish = field.selectionEnd ?? position;
      fireEvent.input(field, {
        inputType: "insertText",
        target: {
          value:
            field.value.slice(0, position) + digit + field.value.slice(finish),
          selectionStart: position + 1,
          selectionEnd: position + 1,
        },
      });
    }
    expect(field.value).toBe(expected);
  });
}

for (const [position, expected] of [
  [2, "01.51.990"],
  [5, "01.05.990"],
] as const) {
  test(`native forward Delete at dot ${position} removes the following digit`, () => {
    function Mask() {
      const [value, setValue] = useState("01.05.1990");
      return (
        <BirthDateInput
          aria-label="Datum"
          value={value}
          onValueChange={setValue}
        />
      );
    }
    render(<Mask />);
    const field = screen.getByLabelText("Datum") as HTMLInputElement;
    fireEvent.input(field, {
      inputType: "deleteContentForward",
      target: {
        value: field.value.slice(0, position) + field.value.slice(position + 1),
        selectionStart: position,
      },
    });
    expect(field.value).toBe(expected);
    expect(field.selectionStart).toBe(position);
  });
}

test("date conversion only handles paste input, never replacement or typed input", () => {
  function Mask() {
    const [value, setValue] = useState("");
    return (
      <BirthDateInput
        aria-label="Datum"
        value={value}
        onValueChange={setValue}
      />
    );
  }
  render(<Mask />);
  const field = screen.getByLabelText("Datum") as HTMLInputElement;
  for (const inputType of [
    "insertText",
    "insertReplacementText",
    "insertFromDrop",
  ]) {
    fireEvent.input(field, {
      inputType,
      target: { value: "1990-04-12", selectionStart: 10 },
    });
    expect(field.value).toBe("19.90.0412");
  }
  for (const [value, expected] of [
    ["1990-04-12", "12.04.1990"],
    ["1.4.1990", "01.04.1990"],
    [" 12.04.1990 ", "12.04.1990"],
    ["01011990", "01.01.1990"],
  ]) {
    fireEvent.input(field, {
      inputType: "insertFromPaste",
      target: { value, selectionStart: value.length },
    });
    expect(field.value).toBe(expected);
    expect(field.selectionStart).toBe(10);
  }
});
