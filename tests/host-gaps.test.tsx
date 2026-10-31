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
  category: { slug: "wein" },
  variants: [],
  type: "PHYSICAL",
  attributes: {},
} as unknown as ShopArticle;
test("generic mapping and unconfigured media use a neutral parcel; bottles require opt in", () => {
  expect(defaultShopProduct(article).placeholder).toBe("product");
  expect(defaultShopProduct(article, {}, { wine: true }).placeholder).toBe(
    "bottle",
  );
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
test("wine behavior follows an explicit section option regardless of its key", () => {
  function Probe() {
    const c = useShopFlow();
    return (
      <p>
        {String(c.isWine("tea"))}:{String(c.isWine("wein"))}:
        {
          c.productModel({
            ...article,
            category: { ...article.category, slug: "tea" },
          }).placeholder
        }
        :{c.text("Wein, Winzer, Rebsorte suchen")}
      </p>
    );
  }
  const html = renderToStaticMarkup(
    <ShopFlowProvider
      config={{
        sections: [
          { key: "tea", label: "Wine", description: "", image: "", wine: true },
          { key: "wein", label: "Other", description: "", image: "" },
        ],
      }}
    >
      <Probe />
    </ShopFlowProvider>,
  );
  expect(html.replaceAll("<!-- -->", "")).toContain(
    "true:false:bottle:Wein, Winzer, Rebsorte suchen",
  );
});

test("a category named wein has no wine chips until the section opts in", () => {
  const section = {
    key: "wein",
    label: "Products",
    description: "",
    image: "",
  };
  const neutral = renderToStaticMarkup(
    <ShopFlow
      initialPath="/shop/wein"
      sections={[section]}
      accountEnabled={false}
    />,
  );
  const wine = renderToStaticMarkup(
    <ShopFlow
      initialPath="/shop/wein"
      sections={[{ ...section, wine: true }]}
      accountEnabled={false}
    />,
  );
  expect(neutral).not.toContain("Weißwein");
  expect(wine).toContain("Weißwein");
});
