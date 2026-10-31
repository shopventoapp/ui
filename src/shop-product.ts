import { getMessages, type LocaleOptions, localeMoney } from "./locale";
import type { ShopProduct } from "./shop-components";
import type { ShopSectionDefinition } from "./shop-flow-context";
import { type Article, voucherLabel } from "./shop-model";
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
/** Map catalogue descriptions, legal declarations, unit prices, stock state and variants without host imagery, editorial content or customer colours. */
export function defaultShopProduct(
  article: Article,
  labels: Partial<Record<string, string>> = {},
  options: LocaleOptions = {},
): ShopProduct {
  const text = getMessages("shop", options, labels);
  const formatPrice = (amount: number) => localeMoney(amount, options.locale);
  const a = article.attributes;
  const available =
    article.type === "PHYSICAL" && article.stock_tracked === true
      ? article.availability
      : undefined;
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: unknown) => {
    if (value !== null && value !== undefined && value !== "")
      rows.push({ label: text(label), value: String(value) });
  };
  // Wire attributes are data: render the first supplied value for each declaration.
  for (const [label, fields] of Object.entries({
    Erzeuger: ["producer"],
    Art: ["product_type", "wine_type"],
  } as const)) {
    add(label, fields.map((field) => a?.[field]).find(Boolean));
  }
  add("Herkunft", [a?.region, a?.country].filter(Boolean).join(", "));
  add("Rebsorten", a?.grapes?.join(", "));
  add("Jahrgang", a?.vintage);
  add(
    "Alkohol",
    a?.alcohol_pct
      ? `${a.alcohol_pct.toLocaleString(options.locale ?? "de")} % vol`
      : null,
  );
  add("Inhalt", article.quantity_information);
  add("Zutaten", a?.ingredients);
  add("Allergene", a?.allergens?.join(", "));
  add("Kann Spuren enthalten", a?.traces);
  add("Bio-Kontrollstelle", a?.organic_body);
  add("Lebensmittelunternehmen", a?.food_business_operator);
  add("Abfüller", a?.bottler);

  const unit = article.unit_price
    ? `${formatPrice(article.unit_price.amount_cents)} / ${article.unit_price.unit}`
    : "";
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    price: article.price,
    category: defaultCategoryKey(article),
    producer: a?.producer || "",
    subtitle:
      voucherLabel(article, options) ||
      [a?.product_type, a?.region, a?.country].filter(Boolean).join(" · ") ||
      article.subtitle ||
      "",
    description: article.description || undefined,
    image: article.images?.[0]?.image.image_url,
    imageAlt: article.title,
    placeholder: article.type === "VOUCHER" ? "gift" : "product",
    quantityInformation: article.quantity_information || undefined,
    unitPrice: [article.quantity_information, unit].filter(Boolean).join(" · "),
    availability: available?.text,
    unavailable: available?.state === "UNAVAILABLE",
    pickupOnly: article.pickup_only,
    adultOnly: article.is_adult_only,
    customerDefinedPrice: article.customer_defined_price,
    minimumPrice: article.minimum_price_cents || undefined,
    withdrawalExcluded: article.withdrawal_excluded_reason === "PERISHABLE",
    withdrawalNotice: article.withdrawal_note,
    badges: [
      available?.state === "UNAVAILABLE" ? text("Ausverkauft") : "",
      a?.tasting_product ? text("Bei Veranstaltungen") : "",
      article.pickup_only ? text("Nur Abholung") : "",
      a?.bio ? text("Bio") : "",
    ].filter(Boolean),
    badgeTones: {
      [text("Bei Veranstaltungen")]: "accent",
      [text("Bio")]: "success",
    },
    variants: article.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      adultOnly: v.is_adult_only,
      unitPrice: v.unit_price
        ? [
            v.quantity_information,
            `${formatPrice(v.unit_price.amount_cents)} / ${v.unit_price.unit}`,
          ]
            .filter(Boolean)
            .join(" · ")
        : undefined,
    })),
    declarations: rows,
  };
}
