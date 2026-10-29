"use client";
import {
  defaultCategoryKey,
  defaultShopProduct,
  NewsletterSignup,
  ReservationForm,
  ShopFlow,
} from "@shopvento/ui";

const publicApi = async () => ({ shopvento: true, locationId: 1 });
const sections = [
  {
    key: "produkte",
    label: "Produkte",
    description: "Unser Sortiment",
    image: "products",
  },
  {
    key: "gutscheine",
    label: "Gutscheine",
    description: "Freude verschenken",
    image: "vouchers",
  },
];
export function ShopFlowExample() {
  return (
    <ShopFlow
      sections={sections}
      categoryKey={defaultCategoryKey}
      productModel={defaultShopProduct}
      storage={{
        cart: "my-shop-cart-v1",
        checkout: "my-shop-checkout-v1",
        pendingOrder: "my-shop-pending-order-v1",
        cartEvent: "my-shop-cart",
      }}
      labels={{ "Noch nichts im Korb.": "Dein Warenkorb ist leer." }}
    />
  );
}
export function PublicFormsExample() {
  return (
    <>
      <ReservationForm siteKey="PUBLIC-TEST-KEY" publicApi={publicApi} />
      <NewsletterSignup siteKey="PUBLIC-TEST-KEY" />
    </>
  );
}
