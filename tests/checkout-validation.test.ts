import { expect, test } from "bun:test";
import { freshDraft, prefillCheckoutDraft } from "../src/checkout-draft";
import {
  type CheckoutValidationInput,
  validateCheckoutDetails,
} from "../src/checkout-validation";

const valid = (): CheckoutValidationInput => ({
  checkoutContact: {
    first_name: "Alex",
    last_name: "Guest",
    email: "alex@example.invalid",
    phone: "",
  },
  checkoutAddress: {
    ...freshDraft().address,
    address1: "Example Street 1",
    postal_code: "12345",
    city: "Example",
  },
  needsAddress: true,
  adult: true,
  shipping: true,
  physical: true,
  fulfillmentOptionId: "shipping",
  dateKey: "",
});
test("checkout reports all missing contact and address fields before submitting", () => {
  const blank = freshDraft();
  expect(
    Object.keys(
      validateCheckoutDetails({
        ...valid(),
        checkoutContact: blank.contact,
        checkoutAddress: blank.address,
        fulfillmentOptionId: null,
      }),
    ),
  ).toEqual([
    "first_name",
    "last_name",
    "email",
    "address1",
    "postal_code",
    "city",
    "fulfillment",
  ]);
});
test("valid guest and account-prefilled checkout pass the same step validation", () => {
  const value = valid();
  expect(validateCheckoutDetails(value)).toEqual({});
  const draft = prefillCheckoutDraft(freshDraft(), {
    id: 1,
    ...value.checkoutContact,
  });
  expect(
    validateCheckoutDetails({ ...value, checkoutContact: draft.contact }),
  ).toEqual({});
});
test("postcodes, country and alcohol carrier exclusions remain explicit", () => {
  for (const postal_code of ["1234", "123456", "12 45", "abcde"])
    expect(
      validateCheckoutDetails({
        ...valid(),
        checkoutAddress: { ...valid().checkoutAddress, postal_code },
      }),
    ).toHaveProperty("postal_code");
  expect(
    validateCheckoutDetails({
      ...valid(),
      checkoutAddress: { ...valid().checkoutAddress, country: "AT" },
    }),
  ).toHaveProperty("address_choice");
  for (const address1 of ["Packstation 1", "Postfiliale 1", "Postfach 3"]) {
    const input = {
      ...valid(),
      checkoutAddress: { ...valid().checkoutAddress, address1 },
    };
    expect(validateCheckoutDetails(input)).toHaveProperty("address1");
    expect(validateCheckoutDetails({ ...input, adult: false })).toEqual({});
    expect(validateCheckoutDetails({ ...input, shipping: false })).toEqual({});
  }
});
test("digital checkout needs contact but no postal address or physical fulfilment", () => {
  expect(
    validateCheckoutDetails({
      ...valid(),
      checkoutAddress: freshDraft().address,
      needsAddress: false,
      physical: false,
      fulfillmentOptionId: null,
    }),
  ).toEqual({});
});
test("only a still-offered date with its current signature is accepted", () => {
  const input = {
    ...valid(),
    dateKey: "current",
    dateKeyInDraft: "current",
    fulfillmentDate: "2026-12-12",
    selectedOption: {
      id: "pickup",
      title: "Pickup",
      type: "PICKUP" as const,
      price: 0,
      schedule: { allowed_weekdays: [5], minimum_lead_hours: 24 },
      eligible_dates: ["2026-12-12"],
    },
  };
  expect(validateCheckoutDetails(input)).toEqual({});
  expect(
    validateCheckoutDetails({ ...input, dateKeyInDraft: "stale" }),
  ).toHaveProperty("fulfillment_date");
  expect(
    validateCheckoutDetails({ ...input, fulfillmentDate: "2026-12-13" }),
  ).toHaveProperty("fulfillment_date");
});
test("saved address errors attach to the address picker and validation copy is overridable", () => {
  const input = {
    ...valid(),
    checkoutAddress: freshDraft().address,
    addressChoicesReady: true,
    addressChoice: "saved",
  };
  const errors = validateCheckoutDetails(
    input,
    () => "Please check this field",
  );
  expect(Object.keys(errors)).toEqual(["address_choice"]);
  expect(errors.address_choice).toBe(
    "Please check this field Please check this field Please check this field",
  );
});
