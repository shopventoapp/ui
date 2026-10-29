// Migrated cart display assertions; host product photography is replaced with synthetic data.
import { expect, spyOn, test } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShopFlow } from "../src/shop-flow";
import {
  type Article,
  type CartItem,
  emptyCart,
  formatPrice,
  type Quote,
} from "../src/shop-model";

const shopPaymentMethods = ["Kreditkarte", "Debitkarte"];
const shopFixtures = [
  {
    id: "voucher",
    title: "Value voucher",
    slug: "voucher",
    type: "VOUCHER",
    voucher_kind: "MULTI_PURPOSE",
    price: 5900,
    category: { name: "Vouchers", slug: "gutscheine" },
    variants: [],
  },
  {
    id: "physical",
    title: "Product",
    slug: "product",
    type: "PHYSICAL",
    price: 5900,
    category: { name: "Products", slug: "produkte" },
    variants: [],
  },
] as unknown as Article[];
const voucher = shopFixtures.find((article) => article.type === "VOUCHER")!;
const singlePurposeVoucher = {
  ...voucher,
  id: "single-purpose-voucher",
  voucher_kind: "SINGLE_PURPOSE",
};
const legacyMultiPurposeVoucher = {
  ...voucher,
  id: "legacy-multi-purpose-voucher",
  voucher_kind: undefined,
  kind: "MULTI_PURPOSE",
};
const unknownKindVoucher = {
  ...voucher,
  id: "unknown-kind-voucher",
  voucher_kind: undefined,
  kind: undefined,
};
const summaryFixtures = [
  ...shopFixtures,
  singlePurposeVoucher,
  legacyMultiPurposeVoucher,
  unknownKindVoucher,
] as Article[];
const physicalArticle = shopFixtures.find(
  (article) => article.type === "PHYSICAL",
)!;
for (const [kind, items, voucherOnly, multiPurposeVoucherOnly] of [
  ["voucher-only", [{ id: voucher.id, quantity: 1 }], true, true],
  [
    "single-purpose voucher",
    [{ id: singlePurposeVoucher.id, quantity: 1 }],
    true,
    false,
  ],
  [
    "legacy multi-purpose voucher",
    [{ id: legacyMultiPurposeVoucher.id, quantity: 1 }],
    true,
    true,
  ],
  [
    "unknown voucher kind",
    [{ id: unknownKindVoucher.id, quantity: 1 }],
    true,
    false,
  ],
  [
    "mixed voucher kinds",
    [
      { id: voucher.id, quantity: 1 },
      { id: singlePurposeVoucher.id, quantity: 1 },
    ],
    true,
    false,
  ],
  [
    "mixed",
    [
      { id: voucher.id, quantity: 1 },
      { id: physicalArticle.id, quantity: 1 },
    ],
    false,
    false,
  ],
  ["physical", [{ id: physicalArticle.id, quantity: 1 }], false, false],
  [
    "unresolved",
    [
      { id: voucher.id, quantity: 1 },
      { id: "missing-article", quantity: 1 },
    ],
    false,
    false,
  ],
  ["empty", [], false, false],
] as const) {
  for (const path of ["/warenkorb", "/kasse"])
    test(`${kind} cart summary notes on ${path} and in the drawer`, () => {
      const cart = { ...emptyCart(), items: [...items] as CartItem[] };
      const quote: Quote = {
        items: [],
        subtotal_price: 5900,
        total_price: 5900,
        tax_breakdown: [
          { vat_rate: 0.19, label: "19%", gross: 1000, net: 840, tax: 160 },
        ],
      };
      // SSR does not run hydration effects. Seed the existing state hooks so the real
      // cart page, checkout, and open drawer render without changing production props.
      const renderState = React.useState;
      const expectedInitial = [emptyCart, false, undefined, false, "", false];
      const hydratedState = [cart, true, quote, true, "", true];
      let articlesSeeded = false;
      let cartState = -1;
      const state = spyOn(React, "useState").mockImplementation(((
        initial: unknown,
      ) => {
        if (!articlesSeeded && Array.isArray(initial)) {
          articlesSeeded = true;
          return renderState(summaryFixtures);
        }
        if (initial === emptyCart) cartState = 0;
        if (cartState >= 0 && cartState < hydratedState.length) {
          expect(initial).toBe(expectedInitial[cartState]);
          return renderState(hydratedState[cartState++]);
        }
        return renderState(initial);
      }) as typeof React.useState);
      let html: string;
      try {
        html = renderToStaticMarkup(
          <ShopFlow initialPath={path} accountEnabled={false} />,
        );
      } finally {
        state.mockRestore();
      }
      expect(articlesSeeded).toBe(true);
      expect(cartState).toBe(hydratedState.length);
      // Empty page carts have no page summary, but the explicitly opened drawer
      // still verifies that an empty cart does not receive the voucher-only notes.
      const summaries = items.length ? 2 : 1;
      const taxNote =
        "Beim Kauf eines Gutscheins fällt noch keine Umsatzsteuer an, sie entsteht erst bei der Einlösung.";
      const deliveryNote = "Du erhältst Deine Gutscheine per E-Mail.";
      expect(html.split(taxNote).length - 1).toBe(
        multiPurposeVoucherOnly ? summaries : 0,
      );
      expect(
        html.split(`Inklusive MwSt. ${formatPrice(160)} (19%)`).length - 1,
      ).toBe(multiPurposeVoucherOnly ? 0 : summaries);
      const deliveryNotes = path === "/warenkorb" && items.length ? 2 : 1;
      expect(html.split(deliveryNote).length - 1).toBe(
        voucherOnly ? deliveryNotes : 0,
      );
      expect(html).toContain(
        `${voucherOnly ? deliveryNote : "Wir liefern nur innerhalb Deutschlands."} Zahlungsarten: ${shopPaymentMethods.join(", ")}.`,
      );
      const cartDelivery =
        'Wir liefern nur innerhalb Deutschlands. <a href="/versand">Versand und Abholung</a>';
      expect(html.includes(cartDelivery)).toBe(
        !voucherOnly && path === "/warenkorb" && items.length > 0,
      );
    });
}
