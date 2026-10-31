import type { ShopOperations } from "./shop-client";
/** Public catalogue article consumed by the shop flow. */
export type Article =
  ShopOperations["catalogue"]["response"]["articles"][number];
/** Authoritative server cart quote. */
export type Quote = ShopOperations["quote"]["response"];
/** Cart request line with quantity, optional variant, price and note. */
export type CartItem = ShopOperations["quote"]["body"]["items"][number];
/** Guest or account checkout contact fields. */
export type CheckoutContact = NonNullable<
  ShopOperations["checkout"]["body"]["contact"]
>;
/** Domestic shipping address accepted at checkout. */
export type CheckoutAddress = NonNullable<
  ShopOperations["checkout"]["body"]["shipping_address"]
>;
/** Format an offered ISO calendar date in UTC to avoid timezone shifts. */
export function formatFulfillmentDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return `${weekdays[calendar.getUTCDay()]}, ${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.`;
}
/** Identify a fulfilment schedule and its eligible dates so stale selections can be invalidated. */
export function fulfillmentDateKey(option?: Fulfillment | null) {
  return option?.schedule
    ? JSON.stringify([option.id, option.schedule, option.eligible_dates || []])
    : "";
}
/** Include a fulfilment date only for a scheduled option. */
export function checkoutFulfillmentFields(
  option?: Fulfillment | null,
  date?: string,
): {
  /** Offered calendar date, or null when no scheduled date was selected. */ fulfillment_date?:
    | string
    | null;
} {
  return {
    ...(option?.schedule ? { fulfillment_date: date || null } : {}),
  };
}
/** Format integer euro cents for German display; totals remain server-authoritative. */
export const formatPrice = (amount: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    amount / 100,
  );
/** Persisted cart request; totals and prices are calculated by the server. */
export type ShopCart = {
  items: CartItem[];
  voucher_codes: string[];
  fulfillment_option_id?: string | null;
};
/** Create a new empty cart with independent item and voucher arrays. */
export const emptyCart = (): ShopCart => ({ items: [], voucher_codes: [] });
/** Default local-storage key for the shopping cart. */
export const cartKey = "sv-shop-cart-v1";
/** Read and validate the persisted cart; malformed or unavailable storage returns an empty cart. */
export function readCart(key = cartKey): ShopCart {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null");
    if (!stored || !Array.isArray(stored.items)) return emptyCart();
    return {
      items: stored.items.filter(
        (i: CartItem) =>
          typeof i.id === "string" &&
          Number.isInteger(i.quantity) &&
          i.quantity > 0 &&
          i.quantity <= 99,
      ),
      voucher_codes: Array.isArray(stored.voucher_codes)
        ? stored.voucher_codes
            .filter((c: unknown) => typeof c === "string")
            .slice(0, 10)
        : [],
      fulfillment_option_id: stored.fulfillment_option_id,
    };
  } catch {
    return emptyCart();
  }
}
/** Persist the cart and notify host navigation; unavailable storage does not interrupt shopping. */
export function writeCart(
  cart: ShopCart,
  key = cartKey,
  event = "sv-shop-cart",
) {
  try {
    localStorage.setItem(key, JSON.stringify(cart));
  } catch {
    /* Continue in memory if browser storage is unavailable. */
  }
  window.dispatchEvent(new Event(event));
}
/** Identify a cart line by article, variant, custom price and gift note. */
export function lineKey(item: CartItem) {
  return `${item.id}:${item.variant || ""}:${item.customer_price || ""}:${item.line_note || ""}`;
}
/** Merge identical cart lines, capping their combined quantity at 99. */
export function mergeLine(cart: ShopCart, line: CartItem): ShopCart {
  const key = lineKey(line);
  const found = cart.items.some((i) => lineKey(i) === key);
  return {
    ...cart,
    items: found
      ? cart.items.map((i) =>
          lineKey(i) === key
            ? { ...i, quantity: Math.min(99, i.quantity + line.quantity) }
            : i,
        )
      : [...cart.items, line],
  };
}

/** Supported catalogue URL facet keys; tasting is retained as the backend wire filter. */
export const filterKeys = [
  "art",
  "land",
  "region",
  "rebsorte",
  "preis",
  "groesse",
  "bio",
  "tasting",
  "sofort",
  "sorte",
] as const;
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
/** One host-defined group of chips matching a public product attribute. */
export interface ShopSectionFilter {
  /** URL parameter used to persist the selected value. Avoid built-in facet keys. */
  queryKey: string;
  /** Public article attribute to compare, including array-valued attributes. */
  attribute: keyof NonNullable<Article["attributes"]>;
  /** Customer-visible choices. An empty value clears the selection. */
  options: readonly {
    /** Attribute value to match, or an empty string to clear the filter. */
    value: string;
    /** Customer-visible chip text, resolved through the host label catalogue. */
    label: string;
  }[];
}
/** Match URL facets against public article attributes, without computing prices. */
export function filterShopArticles(
  articles: Article[],
  query: URLSearchParams,
  chips?: ShopSectionFilter,
): Article[] {
  const selected = (key: string) =>
    (query.get(key) || "").split(",").filter(Boolean);
  const includes = (key: string, value?: string | null) =>
    !query.get(key) ||
    selected(key).some(
      (option) => normalized(option) === normalized(value || ""),
    );
  return articles.filter((article) => {
    const a = article.attributes;
    if (chips && query.get(chips.queryKey)) {
      const value = a?.[chips.attribute];
      const values = Array.isArray(value) ? value : [value];
      if (!values.some((item) => includes(chips.queryKey, String(item ?? ""))))
        return false;
    }
    if (!includes("land", a?.country) || !includes("region", a?.region))
      return false;
    if (
      query.get("rebsorte") &&
      !a?.grapes?.some((grape) => selected("rebsorte").includes(grape))
    )
      return false;
    if (query.get("bio") === "1" && !a?.bio) return false;
    if (query.get("tasting") === "1" && !a?.tasting_product) return false;
    if (
      query.get("sofort") === "1" &&
      article.type === "PHYSICAL" &&
      article.stock_tracked === true &&
      article.availability?.state === "UNAVAILABLE"
    )
      return false;
    const price = query.get("preis");
    if (price === "bis-15" && article.price > 1500) return false;
    if (price === "15-30" && (article.price < 1500 || article.price > 3000))
      return false;
    if (price === "30-60" && (article.price < 3000 || article.price > 6000))
      return false;
    if (price === "ab-60" && article.price < 6000) return false;
    const volume = a?.volume_l || 0;
    const sizes = selected("groesse");
    if (
      sizes.length &&
      !sizes.some((size) =>
        size === "halb"
          ? volume > 0 && volume < 0.5
          : size === "normal"
            ? volume >= 0.5 && volume < 0.8
            : size === "gross"
              ? volume >= 1.4
              : false,
      )
    )
      return false;
    const sub = query.get("sorte");
    if (sub) {
      const key = normalized(article.category.slug || article.category.name);
      const type = normalized(a?.product_type || "");
      const title = normalized(article.title);
      const aliases: Record<string, RegExp> = {
        antipasti: /antipasti|pesto/,
        chutneys: /chutney|crema|confit/,
        oele: /ol|essig/,
        pasta: /pasta|sugo/,
        suess: /suss|honig|panettone|schokolade/,
        salumi: /salami|schinken|wurst|pancetta/,
        kaese: /kase/,
      };
      if (
        !key.includes(normalized(sub)) &&
        !aliases[sub]?.test(type + " " + title)
      )
        return false;
    }
    return true;
  });
}
/** Count articles for a candidate facet while retaining other active filters. */
export function facetCount(
  articles: Article[],
  query: URLSearchParams,
  key: string,
  value: string,
): number {
  const candidate = new URLSearchParams(query);
  candidate.delete(key);
  if (value) candidate.set(key, value);
  return filterShopArticles(articles, candidate).length;
}

/** Describe single- and multi-purpose vouchers from the public catalogue. */
export function voucherLabel(article: Article): string {
  if (article.type !== "VOUCHER") return "";
  const kind = article.voucher_kind ?? article.kind;
  if (kind === "MULTI_PURPOSE")
    return "Mehrzweckgutschein, einlösbar für das komplette Sortiment";
  if (kind === "SINGLE_PURPOSE")
    return `Einzweckgutschein${article.redeemable_for_text ? `, ${article.redeemable_for_text}` : ""}`;
  return article.redeemable_for_text || "Gutschein";
}
// Catalogue nutrition values retain units in their keys; legacy keys remain readable.
const nutritionLabels: Record<string, string> = {
  fat: "Fett",
  saturated_fat: "davon gesättigte Fettsäuren",
  carbohydrates: "Kohlenhydrate",
  sugars: "davon Zucker",
  protein: "Eiweiß",
  salt: "Salz",
};
/** Format public nutrition values with their units, retaining zero values. */
export function nutritionRows(
  nutrition?: Record<string, number> | null,
): Array<{
  /** Nutrient name. */
  label: string;
  /** Formatted amount and unit. */
  value: string;
}> {
  const values = nutrition || {};
  const valid = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
  const energy = [
    ["energy_kj", "kJ"],
    ["energy_kcal", "kcal"],
  ].flatMap(([key, unit]) =>
    valid(values[key])
      ? [`${values[key].toLocaleString("de-DE")} ${unit}`]
      : [],
  );
  const rows = energy.length
    ? [{ label: "Energie", value: energy.join(" / ") }]
    : [];
  for (const [key, label] of Object.entries(nutritionLabels)) {
    const value =
      values[`${key}_g`] ??
      (key === "sugars" ? (values.sugar_g ?? values.sugar) : undefined) ??
      values[key];
    if (valid(value))
      rows.push({ label, value: `${value.toLocaleString("de-DE")} g` });
  }
  return rows;
}
/** Separate voucher funding, provider payments and promotion discounts for an order. */
export function orderAmounts(order: ShopOperations["order"]["response"]): {
  /** Voucher-funded cents. */
  vouchers: number;
  /** Promotional discount cents. */
  discount: number;
  /** Provider-paid cents. */
  paid: number;
} {
  const vouchers = order.payments
    .filter(
      (p) =>
        p.type === "VOUCHER" &&
        (["PENDING", "INCOMPLETE"].includes(order.status) ||
          p.payment_status !== "UNPAID"),
    )
    .reduce((sum, p) => sum + p.amount, 0);
  const discount = order.payments.reduce(
    (sum, p) => sum + (p.promo_discount ?? 0),
    0,
  );
  const paid = order.payments
    .filter((p) => p.type === "STRIPE" || p.type === "OTHER")
    .reduce((sum, p) => sum + p.amount, 0);
  return { vouchers, discount, paid };
}
/** Public fulfilment option with eligible dates, delivery zones and pickup data. */
export type Fulfillment = NonNullable<
  Quote["available_fulfillment_options"]
>[number];
/** Public shop settings controlling checkout and legal declarations. */
export type Settings = ShopOperations["settings"]["response"];
/** Preserve a valid customer choice; otherwise prefer shipping, then the offered fallback. */
export function defaultFulfillmentId(quote: Quote, cart: ShopCart) {
  const available = quote.available_fulfillment_options || [];
  return (
    (cart.fulfillment_option_id
      ? quote.selected_fulfillment_option?.id
      : available.find((option) => option.type === "SHIPPING")?.id) ||
    quote.selected_fulfillment_option?.id ||
    available[0]?.id ||
    null
  );
}
/** Display an exact fulfilment price or the server-provided minimum-price prefix. */
export function fulfillmentPriceLabel(option: Fulfillment) {
  return `${option.price_is_from ? "ab " : ""}${formatPrice(option.price)}`;
}
/** Describe shipping fees and the server-provided free-shipping threshold. */
export function shippingTerms(option?: Fulfillment) {
  return option?.type === "SHIPPING" && option.price === 0
    ? "versandfrei"
    : option
      ? `${fulfillmentPriceLabel(option)} pro Bestellung${option.free_shipping_from != null ? `, ab ${formatPrice(option.free_shipping_from)} versandfrei` : ""}`
      : "";
}
/** Combine public pickup address fields without inventing missing location details. */
export function pickupAddress(option?: Fulfillment) {
  const a = option?.pickup_address,
    l = option?.pickup_location;
  return (
    [
      a?.pickup_name || l?.location_name,
      a?.pickup_address || l?.location_street,
      [
        a?.pickup_postal_code || l?.location_postal_code,
        a?.pickup_city || l?.location_city,
      ]
        .filter(Boolean)
        .join(" "),
    ]
      .filter(Boolean)
      .join(", ") ||
    option?.description ||
    ""
  );
}
/** Describe pickup hold, grace and cancellation settings supplied by the server. */
export function pickupTerms(settings?: Settings) {
  if (settings?.pickup_hold_days == null) return "";
  return `${settings.pickup_hold_days} Tage ab unserer Benachrichtigung${settings.pickup_grace_days != null ? `, nach unserer Erinnerung weitere ${settings.pickup_grace_days} Tage` : ""}.${settings.pickup_auto_cancel_enabled === true ? " Danach treten wir zurück und erstatten vollständig." : ""}`;
}
/** Determine whether any cart line requires physical fulfilment. */
export function hasPhysicalItems(cart: ShopCart, articles: Article[]) {
  return cart.items.some(
    (item) => articles.find((a) => a.id === item.id)?.type !== "VOUCHER",
  );
}
/** Check that the server quote contains each requested line and its exact quantity and custom price. */
export function quoteContainsCart(quote: Quote, cart: ShopCart) {
  return cart.items.every((item) =>
    quote.items.some(
      (q) =>
        q.id === item.id &&
        (q.variant?.id || "") === (item.variant || "") &&
        q.quantity === item.quantity &&
        (q.line_note || "") === (item.line_note || "") &&
        (item.customer_price == null ||
          item.customer_price === q.price_per_item),
    ),
  );
}
