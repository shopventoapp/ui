import type { ShopProduct } from "./shop-components";
import type { ShopSectionDefinition } from "./shop-flow-context";
import type { Article } from "./shop-model";
/** Default category navigation. Hosts normally supply their own catalogue sections. */
export const defaultShopSections: ShopSectionDefinition[] = [
  {
    key: "produkte",
    label: "Produkte",
    description: "Unser Sortiment",
    image: "regal",
  },
  {
    key: "gutscheine",
    label: "Gutscheine",
    description: "Freude verschenken",
    image: "gutscheine",
  },
];
/** Classify vouchers separately and otherwise retain the backend category slug. */
export function defaultCategoryKey(article: Article): string {
  return article.type === "VOUCHER"
    ? "gutscheine"
    : article.category.slug || "produkte";
}
/** Map public article data without host imagery, editorial content or customer colours. */
export function defaultShopProduct(article: Article): ShopProduct {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    price: article.price,
    category: defaultCategoryKey(article),
    description: article.description || undefined,
    image: article.images?.[0]?.image.image_url,
    imageAlt: article.title,
    pickupOnly: article.pickup_only,
    adultOnly: article.is_adult_only,
    customerDefinedPrice: article.customer_defined_price,
    minimumPrice: article.minimum_price_cents || undefined,
    unavailable: article.availability?.state === "UNAVAILABLE",
    availability: article.availability?.text,
    quantityInformation: article.quantity_information || undefined,
    variants: article.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      adultOnly: v.is_adult_only,
    })),
  };
}
