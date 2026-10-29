"use client";
import { ShopProductCard, ShopProductGrid, ShopSurface } from "@shopvento/ui";

const money = (cents: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

export function ShopExample() {
  return (
    <div className="sv-redesign">
      <ShopSurface>
        <ShopProductGrid>
          <ShopProductCard
            product={{
              id: "gift-card",
              slug: "gift-card",
              title: "Gift card",
              category: "Vouchers",
              price: 2500,
              placeholder: "gift",
            }}
            href="/shop/gift-card"
            formatPrice={money}
            addLabel="View gift card"
          />
        </ShopProductGrid>
      </ShopSurface>
    </div>
  );
}
