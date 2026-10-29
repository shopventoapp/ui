import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createShopClient, ShopApiError } from "../src/shop-client";
import {
  type ShopProduct,
  ShopProductCard,
  ShopQuantity,
  ShopSummary,
} from "../src/shop-components";

afterEach(cleanup);
const product: ShopProduct = {
  id: "1",
  slug: "one",
  title: "Example product",
  price: 1200,
  category: "goods",
  unitPrice: "16.00 / l",
  unavailable: true,
};
test("unavailable products keep their detail link and disable adding", () => {
  let added = false;
  render(
    <ShopProductCard
      product={product}
      href="/goods/one"
      formatPrice={(n) => String(n)}
      addLabel="Add item"
      onAdd={() => {
        added = true;
      }}
    />,
  );
  expect(
    screen.getByRole("link", { name: product.title }).getAttribute("href"),
  ).toBe("/goods/one");
  const button = screen.getByRole("button", { name: "Add item" });
  expect(button.hasAttribute("disabled")).toBe(true);
  fireEvent.click(button);
  expect(added).toBe(false);
});
test("quantity bounds are enforced for keyboard and pointer controls", () => {
  const changes: number[] = [];
  const { rerender } = render(
    <ShopQuantity
      value={1}
      min={1}
      max={2}
      onChange={(n) => changes.push(n)}
      label="Amount"
      decreaseLabel="Less"
      increaseLabel="More"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Less" }));
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(changes).toEqual([2]);
  rerender(
    <ShopQuantity
      value={2}
      min={1}
      max={2}
      onChange={(n) => changes.push(n)}
      label="Amount"
      decreaseLabel="Less"
      increaseLabel="More"
    />,
  );
  expect(
    screen.getByRole("button", { name: "More" }).hasAttribute("disabled"),
  ).toBe(true);
});
test("shop client sends guest bodies with cookies and cancellation signals", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const client = createShopClient({
    baseUrl: "https://api.example.test/",
    fetcher: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return Response.json({ items: [], subtotal_price: 0, total_price: 0 });
    },
  });
  const signal = new AbortController().signal;
  await client.request(
    "quote",
    {
      items: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          quantity: 1,
          line_note: "A gift",
          customer_price: 2900,
        },
      ],
      voucher_codes: ["VALUE"],
    },
    { signal },
  );
  expect(requestUrl).toBe("https://api.example.test/api/shop/cart/");
  expect(requestInit?.credentials).toBe("include");
  expect(requestInit?.signal).toBe(signal);
  expect(JSON.parse(String(requestInit?.body)).items[0].line_note).toBe(
    "A gift",
  );
});
test("shop client preserves structured stock and validation errors", async () => {
  const client = createShopClient({
    fetcher: async () =>
      Response.json({ detail: "Not enough stock" }, { status: 409 }),
  });
  try {
    await client.request("quote", { items: [] });
    throw new Error("Expected failure");
  } catch (error) {
    expect(error).toBeInstanceOf(ShopApiError);
    expect((error as ShopApiError).status).toBe(409);
    expect((error as ShopApiError).detail).toEqual({
      detail: "Not enough stock",
    });
  }
});
test("article slugs are encoded without allowing path traversal into another endpoint", async () => {
  let path = "";
  const client = createShopClient({
    fetcher: async (input) => {
      path = String(input);
      return Response.json({});
    },
  });
  await client.request("article", undefined, { slug: "a/b?c" });
  expect(path).toBe("/api/shop/articles/a%2Fb%3Fc");
});

test("summary can mark an address-dependent minimum delivery price", () => {
  const { rerender } = render(
    <ShopSummary
      title="Cart"
      rows={[{ label: "Delivery", amount: 750, isFrom: true }]}
      total={1750}
      totalLabel="Total"
      formatPrice={(n) => String(n)}
    />,
  );
  expect(screen.getByText("ab 750")).toBeTruthy();
  rerender(
    <ShopSummary
      title="Cart"
      rows={[{ label: "Delivery", amount: 950, isFrom: false }]}
      total={1950}
      totalLabel="Total"
      formatPrice={(n) => String(n)}
    />,
  );
  expect(screen.queryByText("ab 750")).toBeNull();
  expect(screen.getByText("950")).toBeTruthy();
});
