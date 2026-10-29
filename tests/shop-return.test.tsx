import { afterEach, expect, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { createShopClient } from "../src/shop-client";
import { ShopFlow } from "../src/shop-flow";

const storage = {
  cart: "legacy-cart",
  checkout: "legacy-draft",
  pendingOrder: "legacy-pending",
  cartEvent: "legacy-cart-change",
};
const quietNewsletter = () => null;
const setUrl = (url: string) =>
  (
    window as unknown as { happyDOM: { setURL(url: string): void } }
  ).happyDOM.setURL(url);
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  setUrl("http://localhost/");
});
const items = [{ id: "a", quantity: 1 }];
function setup(status: string, matched = true) {
  localStorage.setItem(
    storage.cart,
    JSON.stringify({ items, voucher_codes: [] }),
  );
  sessionStorage.setItem(
    storage.checkout,
    JSON.stringify({
      updated: Date.now(),
      contact: {
        first_name: "Alex",
        last_name: "Guest",
        email: "a@example.invalid",
      },
      address: {},
    }),
  );
  sessionStorage.setItem(
    storage.pendingOrder,
    JSON.stringify({
      id: "order",
      created: Date.now(),
      items: JSON.stringify(matched ? items : []),
    }),
  );
  const calls: { url: string; body: unknown }[] = [];
  const client = createShopClient({
    fetcher: async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      if (url.includes("confirm-checkout"))
        return Response.json(
          { detail: "Confirmation unavailable" },
          { status: 429 },
        );
      if (url.includes("/cart/"))
        return Response.json({
          items: [],
          total_price: 0,
          subtotal_price: 0,
          available_fulfillment_options: [],
        });
      if (url.includes("/orders/"))
        return Response.json({
          id: "order",
          order_number: "ORDER-1",
          status,
          items: [],
          payments: [],
          fulfillments: [],
          created_at: "2026-10-29T12:00:00Z",
        });
      return Response.json(
        url.includes("catalogue")
          ? { articles: [], vouchers: [] }
          : { shop_checkout_review_required: true },
      );
    },
  });
  return { client, calls };
}
test("payment return removes the capability before loading and clears only its associated cart", async () => {
  setUrl(
    "http://localhost/kasse/erfolg?order_id=order&token=private-capability&session_id=stripe-session",
  );
  const { client, calls } = setup("PAID");
  const view = render(
    <ShopFlow
      client={client}
      storage={storage}
      accountEnabled={false}
      NewsletterComponent={quietNewsletter}
    />,
  );
  await waitFor(() =>
    expect(view.getByRole("heading", { level: 1 }).textContent).toContain(
      "Danke",
    ),
  );
  expect(window.location.search).toBe("?order_id=order");
  expect(
    calls.some((c) => c.url.includes("/orders/order?token=private-capability")),
  ).toBe(true);
  expect(calls.find((c) => c.url.includes("confirm-checkout"))?.body).toEqual({
    session_id: "stripe-session",
  });
  expect(JSON.parse(localStorage.getItem(storage.cart)!).items).toEqual([]);
  expect(sessionStorage.getItem(storage.checkout)).toBeNull();
  expect(
    JSON.parse(sessionStorage.getItem(storage.pendingOrder)!),
  ).toHaveProperty("confirmedAt");
});
test("paid return preserves a cart changed after checkout", async () => {
  setUrl("http://localhost/kasse/erfolg?order_id=order");
  const { client } = setup("PAID", false);
  const view = render(
    <ShopFlow
      client={client}
      storage={storage}
      accountEnabled={false}
      NewsletterComponent={quietNewsletter}
    />,
  );
  await waitFor(() =>
    expect(view.getByRole("heading", { level: 1 }).textContent).toContain(
      "Danke",
    ),
  );
  expect(JSON.parse(localStorage.getItem(storage.cart)!).items).toEqual(items);
  expect(sessionStorage.getItem(storage.checkout)).not.toBeNull();
});
test("pending payment does not clear the cart or draft", async () => {
  setUrl("http://localhost/kasse/erfolg?order_id=order");
  const { client } = setup("PENDING");
  const view = render(
    <ShopFlow
      client={client}
      storage={storage}
      accountEnabled={false}
      NewsletterComponent={quietNewsletter}
    />,
  );
  await waitFor(() =>
    expect(view.getByRole("heading", { level: 1 }).textContent).toBe(
      "Deine Zahlung wird geprüft.",
    ),
  );
  expect(JSON.parse(localStorage.getItem(storage.cart)!).items).toEqual(items);
  expect(sessionStorage.getItem(storage.checkout)).not.toBeNull();
});
test("host route roots and German labels are independently overridable", () => {
  const html = renderToStaticMarkup(
    <ShopFlow
      initialPath="/warenkorb"
      accountEnabled={false}
      routes={{ shop: "/store", cart: "/cart" }}
      labels={{ "Noch nichts im Korb.": "Cart is empty" }}
    />,
  );
  expect(html).toContain("Cart is empty");
  expect(html).toContain('href="/store"');
  expect(html).not.toContain('href="/shop"');
});
