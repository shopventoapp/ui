import { afterEach, expect, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ShopArticle } from "../src/index";
import {
  dateInputPattern,
  dateInputPlaceholder,
  englishMessages,
  germanMessages,
  getMessages,
  localeMoney,
  maskLocaleDate,
  parseLocaleDate,
  type ShopventoCatalogue,
  ShopventoProvider,
  useMessages,
  useShopventoLocale,
} from "../src/locale";
import { NewsletterSignup } from "../src/newsletter-signup";
import { createShopClient } from "../src/shop-client";
import { ShopFlow } from "../src/shop-flow";
import {
  formatFulfillmentDate,
  nutritionRows,
  shippingTerms,
} from "../src/shop-model";

afterEach(cleanup);
function Probe() {
  const text = useMessages("shop");
  const { locale } = useShopventoLocale();
  return (
    <p>
      {text("Dein Einkauf")}:{localeMoney(1234, locale)}
    </p>
  );
}
test("locale scopes remain independent across separate renders and nested providers", async () => {
  const html = await Promise.all(
    ["en", "de", "en-GB", "de-DE"].map(async (locale) =>
      renderToStaticMarkup(
        <ShopventoProvider locale={locale}>
          <Probe />
        </ShopventoProvider>,
      ),
    ),
  );
  expect(html[0]).toContain("Your shopping");
  expect(html[1]).toContain("Dein Einkauf");
  expect(html[2]).not.toContain("Dein Einkauf");
  expect(html[3]).not.toContain("Your shopping");
  const nested = renderToStaticMarkup(
    <ShopventoProvider locale="en">
      <Probe />
      <ShopventoProvider locale="de">
        <Probe />
      </ShopventoProvider>
      <Probe />
    </ShopventoProvider>,
  );
  expect(nested.match(/Your shopping/g)).toHaveLength(2);
  expect(nested.match(/Dein Einkauf/g)).toHaveLength(1);
});
test("a custom catalogue needs no component change and omitted keys fall back to German", () => {
  const messages = {
    shop: { "Dein Einkauf": "Vos achats" },
  } satisfies ShopventoCatalogue;
  const html = renderToStaticMarkup(
    <ShopventoProvider locale="fr" messages={messages}>
      <Probe />
      <NewsletterSignup siteKey="" />
    </ShopventoProvider>,
  );
  expect(html).toContain("Vos achats");
  expect(html).toContain("Newsletter abonnieren");
  function Override() {
    return (
      <p>
        {useMessages("shop", { "Dein Einkauf": "Host choice" })("Dein Einkauf")}
      </p>
    );
  }
  expect(
    renderToStaticMarkup(
      <ShopventoProvider locale="fr" messages={messages}>
        <Override />
      </ShopventoProvider>,
    ),
  ).toContain("Host choice");
});
test("numeric date parsing and masks follow locale order and validate calendar overflow", () => {
  expect(parseLocaleDate("31.10.2026")).toBe("2026-10-31");
  expect(parseLocaleDate("10/31/2026", "en-US")).toBe("2026-10-31");
  expect(parseLocaleDate("31/10/2026", "en-GB")).toBe("2026-10-31");
  expect(parseLocaleDate("2026-10-31", "en")).toBe("2026-10-31");
  expect(parseLocaleDate("2026/10/31", "ja")).toBe("2026-10-31");
  expect(maskLocaleDate("20261031", "ja")).toBe("2026/10/31");
  expect(new RegExp(`^${dateInputPattern("ja")}$`).test("2026/10/31")).toBe(
    true,
  );
  expect(() => parseLocaleDate("02/30/2026", "en-US")).toThrow();
  expect(() => parseLocaleDate("2026-10-31", "de")).toThrow();
  expect(dateInputPlaceholder("en-US")).toBe("MM/DD/YYYY");
  expect(dateInputPlaceholder("en-GB")).toBe("DD/MM/YYYY");
  expect(maskLocaleDate("31102026", "de")).toBe("31.10.2026");
  expect(maskLocaleDate("10312026", "en-US")).toBe("10/31/2026");
  expect(maskLocaleDate("2026-10-31", "en")).toBe("2026-10-31");
});
test("shop helper numbers, dates and terms use explicit locale", () => {
  expect(formatFulfillmentDate("2026-10-20")).toBe("Di, 20.10.");
  expect(formatFulfillmentDate("2026-10-20", "en")).toContain("Tue");
  expect(nutritionRows({ fat_g: 1.5 }, { locale: "en" })[0]).toEqual({
    label: "Fat",
    value: "1.5 g",
  });
  expect(
    shippingTerms(
      { type: "SHIPPING", price: 500, free_shipping_from: 5000 } as Parameters<
        typeof shippingTerms
      >[0],
      { locale: "en" },
    ),
  ).toContain("per order");
});
const article = {
  id: "a",
  slug: "a",
  title: "Italian product",
  price: 123,
  category: { slug: "deli" },
  variants: [],
  type: "PHYSICAL",
  attributes: { country: "Italy", grapes: ["A"] },
} as unknown as ShopArticle;
test("sidebar facets respect host order, hidden deep links, active host chips and missing headings", async () => {
  const browser = (
    window as unknown as { happyDOM: { setURL(url: string): void } }
  ).happyDOM;
  browser.setURL("http://localhost/shop/deli?variety=A");
  const other = {
    ...article,
    id: "b",
    slug: "b",
    title: "French product",
    attributes: { country: "France", grapes: ["B"] },
  };
  const client = createShopClient({
    fetcher: async (input) =>
      Response.json(
        String(input).includes("catalogue")
          ? { articles: [article, other] }
          : {},
      ),
  });
  try {
    const view = render(
      <ShopFlow
        locale="en"
        client={client}
        accountEnabled={false}
        sections={[
          {
            key: "deli",
            label: "Deli",
            description: "",
            image: "",
            filterGroups: [
              {
                queryKey: "variety",
                attribute: "grapes",
                label: "Hidden variety",
                visible: () => false,
              },
              {
                queryKey: "first",
                attribute: "country",
                label: "First facet",
                order: -1,
              },
              {
                queryKey: "last",
                attribute: "country",
                label: "Last facet",
                order: 99,
              },
              { queryKey: "raw-key", attribute: "country" },
            ],
          },
        ]}
      />,
    );
    await waitFor(() =>
      expect(
        view.container.querySelectorAll(".sv-shop-product-card"),
      ).toHaveLength(1),
    );
    const sidebar = view.container.querySelector(".sv-shop-facets");
    expect(sidebar?.textContent).not.toContain("Hidden variety");
    expect(sidebar?.textContent).not.toContain("raw-key");
    expect(sidebar?.querySelector("summary")?.textContent).toBe("First facet");
    expect(
      Array.from(sidebar?.querySelectorAll("summary") ?? []).at(-1)
        ?.textContent,
    ).toBe("Last facet");
    expect(view.getByRole("button", { name: "Remove filter A" })).toBeTruthy();
    expect(
      view.container.querySelector(".sv-shop-product-card")?.textContent,
    ).toContain("Italian product");
    expect(sidebar?.textContent).toContain("up to");
    expect(sidebar?.textContent).toContain("€15 to €30");
  } finally {
    browser.setURL("http://localhost/");
  }
});

test("shipped catalogues and every area resist cross-render mutation", () => {
  for (const catalogue of [germanMessages, englishMessages]) {
    expect(Object.isFrozen(catalogue)).toBe(true);
    for (const area of Object.values(catalogue))
      expect(Object.isFrozen(area)).toBe(true);
  }
});
test("withdrawal keys consistently use withdrawal terminology", () => {
  for (const area of Object.values(englishMessages))
    for (const [key, value] of Object.entries(area))
      if (/widerruf/i.test(key)) expect(value).not.toMatch(/cancel/i);
  expect(getMessages("account", { locale: "en" })(" gelesen.")).toBe(".");
  expect(getMessages("account", { locale: "en" })("Vertrag widerrufen")).toBe(
    "Withdraw from contract",
  );
});

test("pure helper lookup resolves only the requested catalogue area", () => {
  const messages = {
    get account(): NonNullable<ShopventoCatalogue["account"]> {
      throw new Error("unrelated area read");
    },
    shop: { "Dein Einkauf": "Basket" },
  };
  expect(getMessages("shop", { locale: "en", messages })("Dein Einkauf")).toBe(
    "Basket",
  );
  expect(getMessages("shop", { locale: "en" })("Versandkosten-Zusatz")).toBe(
    "plus delivery costs",
  );
  expect(getMessages("shop", { locale: "en" })("Versand")).toBe("Delivery");
});

test("semantic booking and account defaults are immutable too", async () => {
  const { defaultBookingLabels } = await import("../src/booking-labels");
  const { defaultAccountLabels } = await import("../src/dashboard-ui");
  expect(Object.isFrozen(defaultBookingLabels)).toBe(true);
  expect(Object.isFrozen(defaultAccountLabels)).toBe(true);
});
