import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { createAccountClient } from "../src/account-client";
import { createDashboardClient } from "../src/dashboard-client";
import { createShopClient } from "../src/shop-client";
import { ShopFlow } from "../src/shop-flow";
import { ShopFlowProvider, useShopFlow } from "../src/shop-flow-context";

afterEach(cleanup);

test("external navigation bypasses a prefixing host resolver", () => {
  const navigated: string[] = [];
  function Navigate() {
    const { navigate } = useShopFlow();
    return (
      <button
        type="button"
        onClick={() => navigate("https://checkout.stripe.com/c/pay?token=abc")}
      >
        Pay
      </button>
    );
  }
  const view = render(
    <ShopFlowProvider
      config={{
        resolveHref: (path) => `/prefix${path}`,
        onNavigate: (href) => navigated.push(href),
      }}
    >
      <Navigate />
    </ShopFlowProvider>,
  );
  fireEvent.click(view.getByRole("button", { name: "Pay" }));
  expect(navigated).toEqual(["https://checkout.stripe.com/c/pay?token=abc"]);
});

test("unconfigured shops omit wine navigation and the host age notice", () => {
  const html = renderToStaticMarkup(<ShopFlow accountEnabled={false} />);
  expect(html).not.toContain("/shop/wein");
  expect(html).not.toContain("Alle Weine");
  expect(html).not.toContain("Alkohol ab 18 Jahren");
  expect(html).not.toContain("firmenkunden");
});

test("recommendations link only to a configured enabled section", () => {
  const props = {
    sections: [
      { key: "tea", label: "Tea", description: "Leaves", image: "tea" },
    ],
    recommendedSection: "tea",
    recommendationLinkLabel: "All tea",
    ageNotice: { title: "Adults only", description: "Age checked" },
  };
  const html = renderToStaticMarkup(<ShopFlow {...props} />);
  expect(html).toContain('href="/shop/tea">All tea');
  expect(html).toContain("Adults only");
  expect(html).not.toContain("DHL Alterssichtprüfung");
  const disabled = renderToStaticMarkup(
    <ShopFlow {...props} sectionEnabled={() => false} />,
  );
  expect(disabled).not.toContain("All tea");
  const missing = renderToStaticMarkup(<ShopFlow {...props} sections={[]} />);
  expect(missing).not.toContain("All tea");
});

test("gift basket behavior follows section configuration rather than a reserved slug", () => {
  const section = {
    key: "hampers",
    label: "Hampers",
    description: "Gifts",
    image: "gifts",
    giftBasket: true,
  };
  const configured = renderToStaticMarkup(
    <ShopFlow
      initialPath="/shop/hampers"
      sections={[section]}
      businessGiftSection={<p>Business gifts</p>}
    />,
  );
  expect(configured).toContain("Wir packen jeden Korb");
  expect(configured).toContain("Business gifts");
  const plain = renderToStaticMarkup(
    <ShopFlow
      initialPath="/shop/geschenke"
      sections={[{ ...section, key: "geschenke", giftBasket: false }]}
      businessGiftSection={<p>Business gifts</p>}
    />,
  );
  expect(plain).not.toContain("Wir packen jeden Korb");
  expect(plain).not.toContain("Business gifts");
});

for (const destination of [
  "https://checkout.stripe.com/c/pay",
  "https://untrusted.invalid/pay",
]) {
  test(`label overrides cannot change the allowed payment host: ${destination}`, async () => {
    (
      window as unknown as { happyDOM: { setURL(url: string): void } }
    ).happyDOM.setURL("http://localhost/kasse");
    const article = {
      id: "voucher",
      title: "Voucher",
      slug: "voucher",
      type: "VOUCHER",
      price: 1000,
      category: { name: "Vouchers", slug: "gutscheine" },
      variants: [],
    };
    const item = {
      ...article,
      article,
      quantity: 1,
      price_per_item: 1000,
      price: 1000,
    };
    const quote = {
      items: [item],
      subtotal_price: 1000,
      total_price: 1000,
      available_fulfillment_options: [],
    };
    const profile = {
      id: 1,
      first_name: "Alex",
      last_name: "Guest",
      email: "alex@example.invalid",
    };
    const accountClient = createAccountClient({
      fetch: async () => Response.json(profile),
    });
    let ordered = false;
    const client = createShopClient({
      fetcher: async (input) => {
        const url = String(input);
        if (url.includes("checkout")) {
          ordered = true;
          return Response.json({
            checkout_url: destination,
            order_id: "order",
          });
        }
        return Response.json(
          url.includes("catalogue")
            ? { articles: [], vouchers: [article] }
            : url.includes("cart")
              ? quote
              : { shop_checkout_review_required: true },
        );
      },
    });
    const navigated: string[] = [];
    localStorage.setItem(
      "sv-shop-cart-v1",
      JSON.stringify({
        items: [{ id: "voucher", quantity: 1 }],
        voucher_codes: [],
      }),
    );
    const view = render(
      <ShopFlow
        client={client}
        accountClient={accountClient}
        dashboardClient={createDashboardClient({
          fetch: async () => Response.json([]),
        })}
        labels={{ "checkout.stripe.com": "untrusted.invalid" }}
        onNavigate={(href) => navigated.push(href)}
      />,
    );
    try {
      await waitFor(() =>
        expect(
          (
            view.getByRole("button", {
              name: "Zahlungspflichtig bestellen",
            }) as HTMLButtonElement
          ).disabled,
        ).toBe(false),
      );
      fireEvent.click(view.container.querySelector("#terms")!);
      fireEvent.click(
        view.getByRole("button", { name: "Zahlungspflichtig bestellen" }),
      );
      await waitFor(() => expect(ordered).toBe(true));
      if (destination.includes("checkout.stripe.com"))
        await waitFor(() => expect(navigated).toEqual([destination]));
      else {
        await waitFor(() =>
          expect(view.container.textContent).toContain(
            "Das hat gerade nicht geklappt",
          ),
        );
        expect(navigated).toEqual([]);
      }
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      (
        window as unknown as { happyDOM: { setURL(url: string): void } }
      ).happyDOM.setURL("http://localhost/");
    }
  });
}

test("label dictionaries contain customer copy rather than selectors, styles or payment policy", async () => {
  const { defaultShopFlowLabels } = await import("../src/shop-flow-labels");
  const { defaultNewsletterLabels } = await import(
    "../src/newsletter-signup-labels"
  );
  for (const key of [
    "checkout.stripe.com",
    "Incomplete quote",
    "Unexpected checkout destination",
    "Missing payment destination",
    "input, select, textarea",
    "input:not(:disabled), select, textarea",
  ])
    expect(defaultShopFlowLabels).not.toHaveProperty(key);
  expect(defaultNewsletterLabels).not.toHaveProperty(
    "clamp(48px, 10vw, 100px) 24px",
  );
  const { NewsletterSignup } = await import("../src/newsletter-signup");
  const html = renderToStaticMarkup(
    <NewsletterSignup
      siteKey="synthetic"
      labels={{ "clamp(48px, 10vw, 100px) 24px": "0" }}
    />,
  );
  expect(html).toContain("clamp(48px, 10vw, 100px) 24px");
});

test("gift customization on product pages follows the host section flag", async () => {
  const article = {
    id: "hamper",
    title: "Hamper",
    slug: "hamper",
    type: "PHYSICAL",
    price: 1000,
    category: { name: "Hampers", slug: "hampers" },
    variants: [],
  };
  const client = createShopClient({
    fetcher: async (input) =>
      Response.json(
        String(input).includes("catalogue")
          ? { articles: [article], vouchers: [] }
          : String(input).includes("articles/")
            ? article
            : {},
      ),
  });
  const section = {
    key: "hampers",
    label: "Hampers",
    description: "Gifts",
    image: "gifts",
  };
  (
    window as unknown as { happyDOM: { setURL(url: string): void } }
  ).happyDOM.setURL("http://localhost/shop/hampers/hamper");
  try {
    const gift = render(
      <ShopFlow
        client={client}
        accountEnabled={false}
        sections={[{ ...section, giftBasket: true }]}
      />,
    );
    await waitFor(() =>
      expect(gift.container.querySelector("#line-note")).not.toBeNull(),
    );
    expect(gift.container.textContent).toContain(
      "inkl. MwSt., Abholung oder Lieferung",
    );
    cleanup();
    const plain = render(
      <ShopFlow client={client} accountEnabled={false} sections={[section]} />,
    );
    await waitFor(() =>
      expect(
        plain.getByRole("heading", { name: "Hamper", level: 1 }),
      ).toBeDefined(),
    );
    expect(plain.container.querySelector("#line-note")).toBeNull();
    expect(plain.container.textContent).not.toContain(
      "inkl. MwSt., Abholung oder Lieferung",
    );
  } finally {
    (
      window as unknown as { happyDOM: { setURL(url: string): void } }
    ).happyDOM.setURL("http://localhost/");
  }
});
