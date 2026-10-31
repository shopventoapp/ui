import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDashboardClient } from "../src/dashboard-client";
import {
  AccountLayout,
  type DashboardProps,
} from "../src/dashboard-components";
import { AccountReservationDetail } from "../src/dashboard-details";
import { AccountHelpCard, accountContact } from "../src/dashboard-ui";
import type { ShopArticle } from "../src/index";
import { createShopClient } from "../src/shop-client";
import { ShopMedia } from "../src/shop-components";
import { ShopFlow } from "../src/shop-flow";
import type { ShopSectionDefinition } from "../src/shop-flow-context";
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
  expect(html).toContain('d="M15 35 50 15 85 35 50 55Z"');
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

test("a host product placeholder takes priority over its section fallback", () => {
  function Probe() {
    return <ShopMedia product={useShopFlow().productModel(article)} />;
  }
  const html = renderToStaticMarkup(
    <ShopFlowProvider
      config={{
        sections: [
          {
            key: "deli",
            label: "Deli",
            description: "",
            image: "",
            placeholder: "bottle",
          },
        ],
        productModel: (a) => ({
          ...defaultShopProduct(a),
          placeholder: <span>Explicit host artwork</span>,
        }),
      }}
    >
      <Probe />
    </ShopFlowProvider>,
  );
  expect(html).toContain("Explicit host artwork");
});

test("trade facets and aliases have no effect without host configuration", () => {
  const goods = [
    {
      ...article,
      attributes: { grapes: ["A"], volume_l: 1, product_type: "Pesto" },
    },
  ];
  expect(
    filterShopArticles(
      goods,
      new URLSearchParams("art=red&rebsorte=Other&groesse=normal&sorte=kaese"),
    ),
  ).toEqual(goods);
});

test("host facet groups support attribute arrays and custom matching together with chips", () => {
  const goods = [
    {
      ...article,
      attributes: { grapes: ["A", "B"], volume_l: 0.75, country: "Italy" },
    },
    {
      ...article,
      id: "other",
      attributes: { grapes: ["B"], volume_l: 1.5, country: "France" },
    },
  ];
  const groups = [
    { queryKey: "variety", attribute: "grapes", label: "Variety" },
    {
      queryKey: "size",
      attribute: "volume_l",
      label: "Size",
      options: [{ value: "small", label: "Small" }],
      matches: (a: ShopArticle, value: string) =>
        value === "small" && (a.attributes?.volume_l || 0) < 1,
    },
  ] as const;
  expect(
    filterShopArticles(
      goods,
      new URLSearchParams("variety=b&size=small"),
      groups,
    ),
  ).toEqual([goods[0]]);
});

test("clicking a host section chip filters the rendered catalogue", async () => {
  const italian = {
    ...article,
    title: "Italian product",
    attributes: { country: "Italien", grapes: ["A"], volume_l: 0.75 },
  };
  const french = {
    ...article,
    id: "b",
    slug: "b",
    title: "French product",
    attributes: { country: "France" },
  };
  const client = createShopClient({
    fetcher: async (input) =>
      Response.json(
        String(input).includes("catalogue")
          ? { articles: [italian, french] }
          : String(input).includes("articles/")
            ? italian
            : {},
      ),
  });
  const section: ShopSectionDefinition = {
    key: "deli",
    label: "Deli",
    description: "",
    image: "",
    filterChips: deliFilter,
  };
  const browser = (
    window as unknown as { happyDOM: { setURL(url: string): void } }
  ).happyDOM;
  browser.setURL("http://localhost/shop/deli");
  try {
    const view = render(
      <ShopFlow client={client} accountEnabled={false} sections={[section]} />,
    );
    await waitFor(() =>
      expect(
        view.container.querySelectorAll(".sv-shop-product-card").length,
      ).toBe(2),
    );
    expect(view.queryByText("Rebsorte")).toBeNull();
    expect(view.queryByText("0,75 l")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Italy" }));
    await waitFor(() =>
      expect(
        view.container.querySelectorAll(".sv-shop-product-card").length,
      ).toBe(1),
    );
    expect(
      view.container.querySelector(".sv-shop-product-card")?.textContent,
    ).toContain("Italian product");
    expect(
      view.container.querySelector(".sv-shop-product-card")?.textContent,
    ).not.toContain("French product");
    expect(window.location.search).toBe("?origin=italien");
  } finally {
    browser.setURL("http://localhost/");
  }
});
