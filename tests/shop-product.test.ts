import { expect, test } from "bun:test";
import { type Article, filterShopArticles } from "../src/shop-model";
import { defaultShopProduct } from "../src/shop-product";

const article = {
  id: "a",
  slug: "product",
  title: "Product",
  price: 2500,
  type: "PHYSICAL",
  stock_tracked: true,
  availability: { state: "UNAVAILABLE", text: "Unavailable" },
  category: { slug: "products", name: "Products" },
  attributes: { producer: "Maker", allergens: ["SULFITES"], bio: true },
  quantity_information: "0.75 l",
  unit_price: { amount_cents: 1000, unit: "l" },
  withdrawal_excluded_reason: "PERISHABLE",
  withdrawal_note: "Perishable goods",
  variants: [
    {
      id: "v",
      name: "Variant",
      price: 2500,
      quantity_information: "1 l",
      unit_price: { amount_cents: 2000, unit: "l" },
    },
  ],
} as unknown as Article;
test("only tracked physical inventory affects stock facets and product availability", () => {
  const untracked = { ...article, stock_tracked: false },
    legacy = { ...article, stock_tracked: undefined },
    voucher = { ...article, type: "VOUCHER" as const };
  expect(defaultShopProduct(article).unavailable).toBe(true);
  for (const value of [untracked, legacy, voucher])
    expect(defaultShopProduct(value).unavailable).toBe(false);
  expect(
    filterShopArticles(
      [article, untracked, legacy, voucher],
      new URLSearchParams("sofort=1"),
    ),
  ).toEqual([untracked, legacy, voucher]);
});
test("generic product mapping retains declarations, legal notes and per-variant unit prices", () => {
  const product = defaultShopProduct(article);
  expect(product.declarations).toContainEqual({
    label: "Allergene",
    value: "SULFITES",
  });
  expect(product.withdrawalExcluded).toBe(true);
  expect(product.withdrawalNotice).toBe("Perishable goods");
  expect(product.unitPrice).toBe("0.75 l · 10,00 € / l");
  expect(product.variants?.[0].unitPrice).toBe("1 l · 20,00 € / l");
  expect(
    defaultShopProduct({
      ...article,
      variants: [{ ...article.variants[0], unit_price: null }],
    }).variants?.[0].unitPrice,
  ).toBeUndefined();
});
test("generic catalogue declaration and badge labels are overridable", () => {
  const product = defaultShopProduct(article, {
    Allergene: "Allergens",
    Ausverkauft: "Sold out",
  });
  expect(product.declarations).toContainEqual({
    label: "Allergens",
    value: "SULFITES",
  });
  expect(product.badges).toContain("Sold out");
});
