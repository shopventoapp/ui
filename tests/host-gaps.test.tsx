import { afterEach, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDashboardClient } from "../src/dashboard-client";
import {
  AccountLayout,
  type DashboardProps,
} from "../src/dashboard-components";
import { AccountReservationDetail } from "../src/dashboard-details";
import { AccountHelpCard, accountContact } from "../src/dashboard-ui";
import type { ShopArticle } from "../src/index";
import { ShopMedia } from "../src/shop-components";
import { ShopFlow } from "../src/shop-flow";
import { ShopFlowProvider, useShopFlow } from "../src/shop-flow-context";
import { defaultShopFlowLabels } from "../src/shop-flow-labels";
import { filterShopArticles } from "../src/shop-model";
import { defaultShopProduct } from "../src/shop-product";

afterEach(cleanup);
const base = { address: "", routeUrl: "/route" };
for (const [name, help, phone, email] of [
  ["no phone", { ...base, email: "hello@example.com" }, false, true],
  ["no email", { ...base, phone: "123" }, true, false],
  ["neither", { ...base, phone: "  ", email: "" }, false, false],
] as const)
  test(`account contact hides empty entries: ${name}`, () => {
    const html = renderToStaticMarkup(<AccountHelpCard help={help} />);
    expect(html.includes('href="tel:123"')).toBe(phone);
    expect(html.includes('href="mailto:hello@example.com"')).toBe(email);
    expect(html).not.toContain('href="tel:"');
    expect(html).not.toContain('href="mailto:"');
  });
test("contact falls back to already loaded instance company data and respects host overrides", () => {
  expect(
    accountContact({
      ...base,
      company: { phone: "123", email: "hello@example.com" },
    }),
  ).toEqual({ phone: "123", phoneLabel: "123", email: "hello@example.com" });
  expect(
    accountContact({
      ...base,
      phone: "456",
      phoneLabel: "Call",
      company: { phone: "123" },
    }).phone,
  ).toBe("456");
});
const props: DashboardProps = {
  client: createDashboardClient(),
  profile: { id: 1 },
  labels: {
    event: "Event",
    events: "Events",
    eventVoucher: "Vouchers",
    product: "Product",
    products: "Products",
    pickup: "Pickup",
    voucherUse: "Use",
    newsletter: "Newsletter",
  },
  routes: {
    overview: "/account",
    bookings: "/bookings",
    vouchers: "/vouchers",
    settings: "/settings",
    events: "/events",
    shop: "/shop",
    reserve: "/reserve",
    passwordSet: "/password",
  },
  help: base,
};
const reservation = {
  id: 1,
  date: "2099-10-20",
  time: "19:00",
  num_guests: 2,
  notes: "Window please",
  status: "confirmed" as const,
  created_at: "2026-10-01",
  updated_at: "2026-10-01",
  franchise_location_id: 1,
  location_name: "Studio",
};
const rules = {
  minGuests: 1,
  maxGuests: 8,
  times: () => ["19:00"],
  policy: "Policy",
  changeHours: 24,
};
test("reservation details without rules are read only and still display authoritative fields", () => {
  const view = render(
    <AccountReservationDetail {...props} reservation={reservation} />,
  );
  expect(view.getByText("Window please")).toBeTruthy();
  expect(view.queryByRole("button", { name: "Ändern" })).toBeNull();
  expect(
    view.queryByRole("button", { name: "Reservierung stornieren" }),
  ).toBeNull();
});
test("reservation editing requires rules and can be explicitly disabled", () => {
  const view = render(
    <AccountReservationDetail
      {...props}
      reservation={reservation}
      rules={rules}
    />,
  );
  expect(view.getByRole("button", { name: "Ändern" })).toBeTruthy();
  view.rerender(
    <AccountReservationDetail
      {...props}
      reservation={reservation}
      rules={rules}
      readOnly
    />,
  );
  expect(view.queryByRole("button", { name: "Ändern" })).toBeNull();
  view.rerender(
    <AccountReservationDetail
      {...props}
      reservation={{ ...reservation, date: "2000-01-01" }}
      rules={rules}
    />,
  );
  expect(view.queryByRole("button", { name: "Ändern" })).toBeNull();
});
test("account sidebar also hides empty contact links", () => {
  const html = renderToStaticMarkup(
    <AccountLayout {...props} active="overview" onLogout={() => {}}>
      Content
    </AccountLayout>,
  );
  expect(html).not.toContain('href="tel:"');
  expect(html).not.toContain('href="mailto:"');
});
const article = {
  id: "a",
  slug: "a",
  title: "Product",
  price: 123,
  category: { slug: "deli" },
  variants: [],
  type: "PHYSICAL",
  attributes: {},
} as unknown as ShopArticle;
test("generic mapping and unconfigured media use a neutral parcel", () => {
  expect(defaultShopProduct(article).placeholder).toBe("product");
  const html = renderToStaticMarkup(
    <ShopMedia
      product={{
        id: "a",
        slug: "a",
        category: "products",
        title: "Product",
        price: 123,
      }}
    />,
  );
  expect(html).toContain('viewBox="0 0 100 120"');
  expect(html).not.toContain('viewBox="0 0 100 300"');
});
const deliFilter = {
  queryKey: "origin",
  attribute: "country",
  options: [
    { value: "", label: "All origins" },
    { value: "italien", label: "Italy" },
  ],
} as const;
test("section placeholders support built-in and host elements with neutral German copy", () => {
  function Probe() {
    const c = useShopFlow();
    const product = c.productModel(article);
    return (
      <>
        <ShopMedia product={product} />
        <p>
          {c.text(
            "Eine Entdeckung oder ein Geschenk: Such Dir etwas Schönes aus.",
          )}
          :{c.text("Produkte und Gutscheine suchen")}
        </p>
      </>
    );
  }
  for (const placeholder of [
    "jar",
    <span key="custom">Host artwork</span>,
  ] as const) {
    const html = renderToStaticMarkup(
      <ShopFlowProvider
        config={{
          sections: [
            {
              key: "deli",
              label: "Deli",
              description: "",
              image: "",
              placeholder,
            },
          ],
        }}
      >
        <Probe />
      </ShopFlowProvider>,
    );
    expect(html).toContain("Such Dir etwas Schönes aus.");
    expect(html).toContain("Produkte und Gutscheine suchen");
    if (placeholder !== "jar") expect(html).toContain("Host artwork");
    else expect(html).toContain('viewBox="0 110 100 190"');
  }
  expect(defaultShopFlowLabels["Such Dir etwas Schönes aus."]).toBe(
    "Such Dir etwas Schönes aus.",
  );
  expect(defaultShopFlowLabels["Im Shop suchen"]).toBe("Im Shop suchen");
});
test("section chips match normalized public attributes and render only when configured", () => {
  const section = { key: "deli", label: "Deli", description: "", image: "" };
  const neutral = renderToStaticMarkup(
    <ShopFlow
      initialPath="/shop/deli"
      sections={[section]}
      accountEnabled={false}
    />,
  );
  const configured = renderToStaticMarkup(
    <ShopFlow
      initialPath="/shop/deli"
      sections={[{ ...section, filterChips: deliFilter }]}
      accountEnabled={false}
    />,
  );
  expect(neutral).not.toContain("All origins");
  expect(configured).toContain("All origins");
  expect(configured).toContain("Italy");
  const italian = { ...article, attributes: { country: "Italien" } };
  const other = { ...article, id: "other", attributes: { country: "France" } };
  expect(
    filterShopArticles(
      [italian, other],
      new URLSearchParams("origin=italien"),
      deliFilter,
    ),
  ).toEqual([italian]);
  expect(
    filterShopArticles([italian, other], new URLSearchParams(), deliFilter),
  ).toHaveLength(2);
  expect(
    filterShopArticles(
      [{ ...article, attributes: { grapes: ["A", "B"] } }],
      new URLSearchParams("variety=b"),
      { ...deliFilter, queryKey: "variety", attribute: "grapes" },
    ),
  ).toHaveLength(1);
});

test("catalogue copy defaults stay neutral and German", () => {
  expect(
    defaultShopFlowLabels[
      "Eine Entdeckung oder ein Geschenk: Such Dir etwas Schönes aus."
    ],
  ).toBe("Eine Entdeckung oder ein Geschenk: Such Dir etwas Schönes aus.");
  expect(defaultShopFlowLabels["Produkte und Gutscheine suchen"]).toBe(
    "Produkte und Gutscheine suchen",
  );
});
