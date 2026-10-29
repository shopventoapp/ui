// Migrated from the wine bar: assertions are unchanged.
import { expect, test } from "bun:test";
import {
  checkoutFulfillmentFields,
  defaultFulfillmentId,
  emptyCart,
  type Fulfillment,
  formatFulfillmentDate,
  fulfillmentDateKey,
  mergeLine,
  nutritionRows,
  orderAmounts,
  pickupTerms,
  type Quote,
  shippingTerms,
} from "../src/shop-model";
import {
  consumeNewsletterIntent,
  pendingOrderKey,
} from "../src/shop-newsletter-intent";

test("unchosen fulfillment prefers shipping over an implicit pickup, preserving customer choices and fallback", () => {
  const pickup: Fulfillment = {
    id: "pickup",
    title: "Pickup",
    type: "PICKUP",
    price: 0,
  };
  const shipping: Fulfillment = {
    id: "shipping",
    title: "DHL",
    type: "SHIPPING",
    price: 690,
  };
  const quote = {
    available_fulfillment_options: [pickup, shipping],
    selected_fulfillment_option: pickup,
  } as Quote;
  expect(defaultFulfillmentId(quote, emptyCart())).toBe("shipping");
  expect(
    defaultFulfillmentId(quote, {
      ...emptyCart(),
      fulfillment_option_id: "pickup",
    }),
  ).toBe("pickup");
  expect(
    defaultFulfillmentId(
      { ...quote, available_fulfillment_options: [pickup] },
      emptyCart(),
    ),
  ).toBe("pickup");
  expect(
    defaultFulfillmentId(
      {
        ...quote,
        available_fulfillment_options: [],
        selected_fulfillment_option: null,
      },
      emptyCart(),
    ),
  ).toBeNull();
});

test("newsletter intent is order-bound, account-bound, expires and is consumed once", () => {
  let value = "";
  const storage = {
    getItem: (_key?: string) => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
  for (const accountId of [null, 1]) {
    value = JSON.stringify({
      id: "order",
      created: Date.now(),
      newsletter: { accountId },
    });
    expect(consumeNewsletterIntent(storage, "other", accountId)).toBe(false);
    expect(
      consumeNewsletterIntent(storage, "order", accountId === null ? 1 : null),
    ).toBe(false);
    expect(consumeNewsletterIntent(storage, "order", accountId)).toBe(true);
    expect(consumeNewsletterIntent(storage, "order", accountId)).toBe(false);
    expect(JSON.parse(storage.getItem(pendingOrderKey))).not.toHaveProperty(
      "newsletter",
    );
  }
  for (const pending of [
    null,
    { id: "order", created: Date.now() },
    {
      id: "order",
      created: Date.now() - 86400001,
      newsletter: { accountId: null },
    },
  ]) {
    value = JSON.stringify(pending);
    expect(consumeNewsletterIntent(storage, "order", null)).toBe(false);
  }
});

test("fulfillment dates preserve the offered calendar day across DST and year boundaries", () => {
  expect(formatFulfillmentDate("2026-10-20")).toBe("Di, 20.10.");
  expect(formatFulfillmentDate("2026-10-25")).toBe("So, 25.10.");
  expect(formatFulfillmentDate("2027-01-01")).toBe("Fr, 01.01.");
  expect(formatFulfillmentDate("2028-02-29")).toBe("Di, 29.02.");
});

test("checkout sends offered dates only for scheduled options and invalidates changed offers", () => {
  const option: Fulfillment = {
    id: "pickup",
    title: "Pickup",
    type: "PICKUP",
    price: 0,
    schedule: { allowed_weekdays: [1, 3], minimum_lead_hours: 24 },
    eligible_dates: ["2026-10-20"],
  };
  expect(checkoutFulfillmentFields(option, "2026-10-20")).toEqual({
    fulfillment_date: "2026-10-20",
  });
  expect(
    checkoutFulfillmentFields({ ...option, type: "DELIVERY" }, "2026-10-20"),
  ).toEqual({ fulfillment_date: "2026-10-20" });
  expect(checkoutFulfillmentFields(option)).toEqual({ fulfillment_date: null });
  expect(
    checkoutFulfillmentFields({ ...option, schedule: null }, "2026-10-20"),
  ).toEqual({});
  expect(checkoutFulfillmentFields(null, "2026-10-20")).toEqual({});
  expect(fulfillmentDateKey({ ...option })).toBe(fulfillmentDateKey(option));
  expect(
    fulfillmentDateKey({ ...option, eligible_dates: ["2026-10-22"] }),
  ).not.toBe(fulfillmentDateKey(option));
  expect(fulfillmentDateKey({ ...option, id: "delivery" })).not.toBe(
    fulfillmentDateKey(option),
  );
});

test("gift notes, variants and customer prices remain separate cart lines", () => {
  let cart = mergeLine(emptyCart(), {
    id: "a",
    quantity: 1,
    variant: "v",
    line_note: "For one",
    customer_price: 2900,
  });
  cart = mergeLine(cart, {
    id: "a",
    quantity: 2,
    variant: "v",
    line_note: "For one",
    customer_price: 2900,
  });
  cart = mergeLine(cart, {
    id: "a",
    quantity: 1,
    variant: "v",
    line_note: "For two",
    customer_price: 2900,
  });
  cart = mergeLine(cart, {
    id: "a",
    quantity: 1,
    variant: "v2",
    line_note: "For one",
    customer_price: 2900,
  });
  cart = mergeLine(cart, {
    id: "a",
    quantity: 1,
    variant: "v",
    line_note: "For one",
    customer_price: 5800,
  });
  expect(cart.items).toHaveLength(4);
  expect(cart.items[0].quantity).toBe(3);
});

test("nutrition numbers use readable units, preserve zero and omit empty rows", () => {
  expect(
    nutritionRows({
      energy_kj: 656,
      energy_kcal: 157,
      fat_g: 0,
      salt_g: 1.2,
      unknown: 8,
      protein_g: null as unknown as number,
    }),
  ).toEqual([
    { label: "Energie", value: "656 kJ / 157 kcal" },
    { label: "Fett", value: "0 g" },
    { label: "Salz", value: "1,2 g" },
  ]);
});

test("shipping and pickup terms follow settings and omit missing facts", () => {
  expect(
    shippingTerms({
      id: "s",
      title: "DHL",
      type: "SHIPPING",
      price: 800,
      free_shipping_from: 12000,
    }),
  ).toContain("120,00");
  expect(
    pickupTerms({
      countries: [],
      installation_country: "DE",
      direct_booking_enabled: false,
      guest_booking_enabled: false,
      pickup_hold_days: 3,
      pickup_grace_days: 2,
      pickup_auto_cancel_enabled: false,
    }),
  ).toBe(
    "3 Tage ab unserer Benachrichtigung, nach unserer Erinnerung weitere 2 Tage.",
  );
  expect(pickupTerms()).toBe("");
});

test("payment rows separate voucher funding, provider payments and promotion discounts to the cent", () => {
  const payments = [
    {
      type: "VOUCHER",
      payment_status: "PAID",
      amount: 2900,
      amount_discount: 0,
    },
    { type: "STRIPE", amount: 2279, amount_discount: 2901, promo_discount: 1 },
    { type: "OTHER", amount: 1, amount_discount: 0 },
  ];
  expect(
    orderAmounts({ payments } as Parameters<typeof orderAmounts>[0]),
  ).toEqual({ vouchers: 2900, discount: 1, paid: 2280 });
  expect(
    orderAmounts({ payments: [payments[0]] } as Parameters<
      typeof orderAmounts
    >[0]),
  ).toEqual({ vouchers: 2900, discount: 0, paid: 0 });
  payments[1].amount_discount = 0;
  expect(
    orderAmounts({ payments } as Parameters<typeof orderAmounts>[0]).vouchers,
  ).toBe(2900);
});

test("every mandatory suffixed nutrition value remains visible including zero", () => {
  expect(
    nutritionRows({
      energy_kj: 100,
      energy_kcal: 24,
      fat_g: 0,
      saturated_fat_g: 0,
      carbohydrates_g: 1,
      sugars_g: 0,
      protein_g: 2,
      salt_g: 0.01,
    }),
  ).toHaveLength(7);
  expect(
    shippingTerms({
      id: "s",
      title: "DHL",
      type: "SHIPPING",
      price: 0,
      free_shipping_from: 9900,
    }),
  ).toBe("versandfrei");
});

test("settled orders retain refunded voucher funding and exclude only unpaid rows", () => {
  const payments = [
    { type: "VOUCHER", payment_status: "PAID", amount: 1000 },
    {
      type: "VOUCHER",
      payment_status: "REFUND_SUCCEEDED",
      amount: 1900,
      refunded_amount: 1900,
    },
    { type: "VOUCHER", payment_status: "UNPAID", amount: 500 },
  ];
  for (const status of [
    "PAID",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
    "RETURNED",
    "PARTIALLY_RETURNED",
    "DISPUTED_LOST",
  ]) {
    expect(
      orderAmounts({ status, payments } as Parameters<typeof orderAmounts>[0])
        .vouchers,
    ).toBe(2900);
  }
  for (const status of ["PENDING", "INCOMPLETE"]) {
    expect(
      orderAmounts({ status, payments } as Parameters<typeof orderAmounts>[0])
        .vouchers,
    ).toBe(3400);
  }
});

test("checkout draft resets previous account data on switch or logout, preserving the date", async () => {
  const { freshDraft, prefillCheckoutDraft } = await import(
    "../src/checkout-draft"
  );
  const original = {
    ...freshDraft(),
    accountId: 1,
    addressChoice: "saved-a",
    fulfillmentDate: "2026-10-20",
    dateKey: "delivery-slots",
    contact: {
      first_name: "Alice",
      last_name: "A",
      email: "a@example.de",
      phone: "111",
    },
    address: { ...freshDraft().address, address1: "Private street 1" },
  };
  for (const profile of [
    null,
    {
      id: 2,
      first_name: "Ben",
      last_name: "B",
      email: "b@example.de",
      phone: "222",
    },
  ]) {
    const next = prefillCheckoutDraft(original, profile);
    expect(next.contact).toEqual(
      profile
        ? {
            first_name: "Ben",
            last_name: "B",
            email: "b@example.de",
            phone: "222",
          }
        : freshDraft().contact,
    );
    expect(next.address).toEqual(freshDraft().address);
    expect(next.addressChoice).toBeUndefined();
    expect(next.accountId).toBe(profile?.id);
    expect(next.fulfillmentDate).toBe("2026-10-20");
    expect(next.dateKey).toBe("delivery-slots");
  }
  expect(
    prefillCheckoutDraft(original, { id: 1, first_name: "Account name" })
      .contact,
  ).toEqual(original.contact);
  const guest = {
    ...freshDraft(),
    contact: { ...freshDraft().contact, first_name: "Typed name" },
  };
  expect(
    prefillCheckoutDraft(guest, {
      id: 3,
      first_name: "Account name",
      email: "c@example.de",
    }).contact,
  ).toMatchObject({ first_name: "Typed name", email: "c@example.de" });
  expect(prefillCheckoutDraft(guest, null)).toBe(guest);
});

test("checkout only accepts Germany or an unspecified country", async () => {
  const { deliversToCountry } = await import("../src/checkout-draft");
  for (const country of ["DE", "", null, undefined])
    expect(deliversToCountry(country)).toBe(true);
  for (const country of ["FR", "AT", "US"])
    expect(deliversToCountry(country)).toBe(false);
});

test("zone delivery labels distinguish minimum and exact prices", async () => {
  const { fulfillmentPriceLabel } = await import("../src/shop-model");
  const option: Fulfillment = {
    id: "delivery",
    title: "Delivery",
    type: "DELIVERY",
    price: 750,
    price_is_from: true,
  };
  expect(fulfillmentPriceLabel(option)).toBe("ab 7,50 €");
  expect(
    fulfillmentPriceLabel({ ...option, price: 950, price_is_from: false }),
  ).toBe("9,50 €");
  expect(shippingTerms(option)).toBe("ab 7,50 € pro Bestellung");
});

for (const authenticated of [false, true]) {
  test(`newsletter card preserves the separate confirmation instruction: ${authenticated ? "account" : "guest"}`, async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { NewsletterSignup } = await import("../src/newsletter-signup");
    const html = renderToStaticMarkup(
      createElement(NewsletterSignup, {
        siteKey: "mock",
        variant: "card",
        initialEmail: "test@example.invalid",
        ...(authenticated
          ? { onSubscribe: async () => {}, pending: true }
          : {}),
      }),
    );
    if (authenticated) {
      expect(html).toContain(
        "Fast geschafft: Bitte bestätige Deine Anmeldung über den Link in unserer E-Mail.",
      );
      expect(html).not.toContain("Du bist angemeldet.");
      expect(html).not.toContain("<form");
    } else {
      expect(html).toContain("Double-Opt-in");
      expect(html).toContain("Newsletter abonnieren");
    }
  });
}
