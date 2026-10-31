"use client";
import {
  type ComponentType,
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import { AccountApiError, createAccountClient } from "./account-client";
import {
  createDashboardClient,
  profileNewsletterAdapter,
} from "./dashboard-client";
import {
  getMessages,
  type LocaleOptions,
  localeMoney,
  useShopventoLocale,
} from "./locale";
import type { NewsletterSignupProps } from "./newsletter-signup";
import { NewsletterSignup } from "./newsletter-signup";
import { createShopClient } from "./shop-client";
import type { ShopProduct } from "./shop-components";
import {
  type Article,
  filterShopArticles,
  formatFulfillmentDate,
  fulfillmentPriceLabel,
  nutritionRows,
  pickupTerms,
  readCart,
  type ShopSectionFilter,
  shippingTerms,
  writeCart,
} from "./shop-model";
import {
  defaultCategoryKey,
  defaultShopProduct,
  defaultShopSections,
} from "./shop-product";

/** Catalogue section supplied by the host, including optional editorial imagery. */
export interface ShopSectionDefinition {
  /** Stable category slug. */
  key: string;
  /** Navigation title. */
  label: string;
  /** Short category description. */
  description: string;
  /** Key in the host image map. */
  image: string;
  /** Enable gift basket copy, customization and fulfilment presentation for this section. */
  giftBasket?: boolean;
  /** Attribute-matching chips supplied by the host. Empty values clear the filter. */
  filterChips?: ShopSectionFilter;
  /** Host facet groups, merged with the neutral origin, price and availability facets. */
  filterGroups?: readonly ShopSectionFilter[];
  /** Fallback media for articles in this section, including custom host artwork. */
  placeholder?: ShopProduct["placeholder"];
  /** Optional element ID to scroll to when this section opens with the matching hash. */
  businessAnchor?: string;
}
/** Canonical flow route overrides. Paths must be rooted on the host website. */
export interface ShopFlowRoutes {
  /** Catalogue root. */
  shop: string;
  /** Shopping cart. */
  cart: string;
  /** Checkout root; success and cancellation suffixes follow this root. */
  checkout: string;
  /** Direct order-result page. */
  order: string;
  /** Shipping information. */
  shipping: string;
  /** Account dashboard. */
  account: string;
  /** Terms of sale. */
  terms: string;
  /** Privacy policy. */
  privacy: string;
  /** Withdrawal information. */
  withdrawal: string;
  /** Event listing. */
  events: string;
}
/** German messages keyed by their default text. Missing entries retain German defaults; placeholders use {0}, {1}, etc. */
export type ShopFlowLabels = Partial<Record<string, string>>;
/** Browser persistence names for a shop installation. Preserve legacy values when upgrading. */
export interface ShopFlowStorage {
  /** Local-storage key for cart lines, voucher codes and fulfilment choice. */
  cart?: string;
  /** Session-storage key for the contact, address and date draft. */
  checkout?: string;
  /** Session-storage key associating a payment return with its cart and consent. */
  pendingOrder?: string;
  /** Browser event dispatched after a local cart update. */
  cartEvent?: string;
}
/** Host composition for the complete shop flow. Keep object and client identities stable across renders. */
export interface ShopFlowProps extends LocaleOptions {
  /** Initial canonical route, useful for server rendering a static route shell. */
  initialPath?: string;
  /** Partial German copy overrides, keyed by default text. */
  labels?: ShopFlowLabels;
  /** Optional route replacements; category/product suffixes are appended to shop. */
  routes?: Partial<ShopFlowRoutes>;
  /** Optional final URL resolver for host-specific routing. */
  resolveHref?: (canonical: string) => string;
  /** Optional navigation adapter; defaults to window.location.assign. */
  onNavigate?: (href: string) => void;
  /** Public catalogue/quote/checkout client; prices remain authoritative on the server. */
  client?: ReturnType<typeof createShopClient>;
  /** Same-origin account transport. */
  accountClient?: ReturnType<typeof createAccountClient>;
  /** Same-origin dashboard transport. */
  dashboardClient?: ReturnType<typeof createDashboardClient>;
  /** Map API articles to host product presentation. */
  productModel?: (article: Article) => ShopProduct;
  /** Classify an article into a host category slug. */
  categoryKey?: (article: Article) => string;
  /** Host category descriptions and ordering. */
  sections?: ShopSectionDefinition[];
  /** Enable individual category and search slugs. */
  sectionEnabled?: (slug: string) => boolean;
  /** Restrict recommendations to this section when it is configured and enabled. */
  recommendedSection?: string;
  /** Customer-visible recommendation link text; defaults to the section title. */
  recommendationLinkLabel?: string;
  /** Optional catalogue age notice supplied by the host. Product age restrictions still come from the API. */
  ageNotice?: {
    /** Short notice heading. */
    title: string;
    /** Explanation of the age check. */
    description: string;
    /** Optional carrier-specific age-check information for the shipping page. */
    shippingNote?: string;
  };
  /** Resolve a category marketing link, including hidden-category fallback. */
  sectionPath?: (slug: string, hash?: string) => string;
  /** Remove items excluded by the host catalogue allowlist after hydration. */
  restrictSections?: boolean;
  /** Enable account entry and profile loading. */
  accountEnabled?: boolean;
  /** Enable links to events. */
  eventsEnabled?: boolean;
  /** Browse-only mode. */
  paused?: boolean;
  /** Public Turnstile fallback key, overridden by shop settings. */
  turnstileSiteKey?: string;
  /** Browser persistence keys and notification event. Keep legacy values during migration. */
  storage?: ShopFlowStorage;
  /** Host image URLs keyed by section image names, regal (hero), laden (pickup) and lieferung (shipping). */
  images?: Record<string, string>;
  /** Opening-hours text displayed in pickup details. */
  openingHours?: readonly string[];
  /** Accepted payment method labels matching the installation. */
  paymentMethods?: readonly string[];
  /** Gift fulfilment explanation. */
  giftDeliveryNote?: string;
  /** Host newsletter component, for shared copy and transport configuration. */
  NewsletterComponent?: ComponentType<NewsletterSignupProps>;
  /** Newsletter consent label. */
  newsletterOptInLabel?: string;
  /** Editorial content below the gift catalogue. */
  businessGiftSection?: ReactNode;
  /** Optional editorial business information beside payment guidance. */
  businessInformation?: ReactNode;
  /** Optional host success icon, retaining the host's SVG markup. */
  SuccessIcon?: ComponentType<{
    /** Rendered width and height in CSS pixels. */
    size?: number;
  }>;
  /** Customer service telephone URL. */
  phoneHref?: string;
  /** Displayed customer service telephone number. */
  phoneLabel?: string;
}
const defaultRoutes: ShopFlowRoutes = {
  shop: "/shop",
  cart: "/warenkorb",
  checkout: "/kasse",
  order: "/bestellung",
  shipping: "/versand",
  account: "/konto",
  terms: "/agb",
  privacy: "/datenschutz",
  withdrawal: "/widerruf",
  events: "/termine",
};
const defaultClient = /* @__PURE__ */ createShopClient();
const defaultAccountClient = /* @__PURE__ */ createAccountClient();
const disabledAccountClient = {
  ...defaultAccountClient,
  getProfile: async () => {
    throw new AccountApiError(401, null);
  },
};
const defaultDashboardClient = /* @__PURE__ */ createDashboardClient();
const DefaultCheck = ({ size = 20 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m5 12 4 4L19 6" />
  </svg>
);
function resolveConfig(config: Omit<ShopFlowProps, "initialPath">) {
  const locale = config.locale ?? "de";
  const text = getMessages("shop", config, config.labels);
  const paymentText = getMessages("payment", config);
  const newsletterText = getMessages("newsletter", config);
  const routes = { ...defaultRoutes, ...config.routes };
  const pairs = Object.entries(defaultRoutes)
    .map(
      ([key, value]) => [value, routes[key as keyof ShopFlowRoutes]] as const,
    )
    .sort((a, b) => b[0].length - a[0].length);
  const replacePath = (path: string, reverse = false) => {
    for (const pair of pairs) {
      const [from, to] = reverse ? [pair[1], pair[0]] : pair;
      if (
        path === from ||
        path.startsWith(`${from}/`) ||
        path.startsWith(`${from}?`) ||
        path.startsWith(`${from}#`)
      )
        return to + path.slice(from.length);
    }
    return path;
  };
  const resolveHref =
    config.resolveHref || ((path: string) => replacePath(path));
  const accountClient =
    config.accountClient ||
    (config.accountEnabled === false
      ? disabledAccountClient
      : defaultAccountClient);
  const dashboardClient = config.dashboardClient || defaultDashboardClient;
  const sections =
    config.sections ||
    defaultShopSections.map((section) => ({
      ...section,
      label: text(section.label),
      description: text(section.description),
    }));
  const shopSectionEnabled = config.sectionEnabled || (() => true);
  const visibleSections = sections.filter((section) =>
    shopSectionEnabled(section.key),
  );
  return {
    text,
    locale,
    formatPrice: (amount: number) => localeMoney(amount, locale),
    formatFilterPrice: (amount: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount / 100),
    formatFilterRange: (minimum: number, maximum: number) => {
      const number = new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
      });
      const currency =
        new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" })
          .formatToParts(0)
          .find((part) => part.type === "currency")?.value ?? "EUR";
      return text(
        "{0} bis {1} {2}",
        number.format(minimum / 100),
        number.format(maximum / 100),
        currency,
      );
    },
    formatFulfillmentDate: (date: string) =>
      formatFulfillmentDate(date, locale),
    fulfillmentPriceLabel: (
      option: Parameters<typeof fulfillmentPriceLabel>[0],
    ) => fulfillmentPriceLabel(option, config),
    nutritionRows: (nutrition: Parameters<typeof nutritionRows>[0]) =>
      nutritionRows(nutrition, config),
    pickupTerms: (settings: Parameters<typeof pickupTerms>[0]) =>
      pickupTerms(settings, config),
    shippingTerms: (option: Parameters<typeof shippingTerms>[0]) =>
      shippingTerms(option, config),
    resolveHref,
    canonicalPath: (path: string) => replacePath(path, true),
    navigate: (path: string) =>
      (
        config.onNavigate ||
        ((target: string) => window.location.assign(target))
      )(/^https?:\/\//i.test(path) ? path : resolveHref(path)),
    client: config.client || defaultClient,
    accountClient,
    dashboardClient,
    newsletterAdapter: profileNewsletterAdapter(dashboardClient, () =>
      accountClient.getProfile(),
    ),
    checkoutKey: config.storage?.checkout || "sv-shop-checkout-v1",
    pendingOrderKey: config.storage?.pendingOrder || "sv-shop-pending-order-v1",
    readCart: () => readCart(config.storage?.cart),
    writeCart: (cart: Parameters<typeof writeCart>[0]) =>
      writeCart(cart, config.storage?.cart, config.storage?.cartEvent),
    categoryKey: config.categoryKey || defaultCategoryKey,
    productModel: (article: Article) => {
      const product = config.productModel
        ? config.productModel(article)
        : defaultShopProduct(article, config.labels, config);
      const section = sections.find(
        (section) =>
          section.key === (config.categoryKey || defaultCategoryKey)(article),
      );
      return {
        ...product,
        placeholder: config.productModel
          ? (product.placeholder ?? section?.placeholder)
          : (section?.placeholder ?? product.placeholder),
      };
    },
    filterArticles: (articles: Article[], query: URLSearchParams) =>
      articles.filter((article) => {
        const section = sections.find(
          (section) =>
            section.key === (config.categoryKey || defaultCategoryKey)(article),
        );
        return (
          filterShopArticles([article], query, [
            ...(section?.filterChips ? [section.filterChips] : []),
            ...(section?.filterGroups ?? []),
          ]).length > 0
        );
      }),
    sections,
    visibleSections,
    isGiftBasket: (category: string) =>
      visibleSections.some(
        (section) => section.key === category && section.giftBasket === true,
      ),
    recommendedSection: visibleSections.find(
      (section) => section.key === config.recommendedSection,
    ),
    recommendationLinkLabel: config.recommendationLinkLabel,
    ageNotice: config.ageNotice,
    physicalSectionsEnabled: visibleSections.some(
      (section) => section.key !== "gutscheine",
    ),
    bookingEnabled: () => config.eventsEnabled !== false,
    accountEnabled: () => config.accountEnabled !== false,
    shopPaused: () => !!config.paused,
    shopSectionEnabled,
    shopSectionPath:
      config.sectionPath ||
      ((slug: string, hash = "") => `/shop/${slug}${hash}`),
    shopImages: config.images || {},
    shopPaymentMethods: config.paymentMethods || [
      paymentText("Kreditkarte"),
      paymentText("Debitkarte"),
    ],
    OPENING_HOURS: config.openingHours || [],
    giftBasketDelivery:
      config.giftDeliveryNote ||
      text("Abholung oder Lieferung nach Verfügbarkeit."),
    NewsletterSignup: config.NewsletterComponent || NewsletterSignup,
    newsletterOptInLabel:
      config.newsletterOptInLabel ||
      newsletterText("Newsletter per E-Mail abonnieren"),
    businessGiftSection: config.businessGiftSection,
    businessInformation: config.businessInformation,
    restrictSections: config.restrictSections,
    turnstileSiteKey: config.turnstileSiteKey,
    Check: config.SuccessIcon || DefaultCheck,
    phoneHref: config.phoneHref,
    phoneLabel: config.phoneLabel,
  };
}
const ShopFlowContext = /* @__PURE__ */ createContext<ReturnType<
  typeof resolveConfig
> | null>(null);
export function useShopFlow() {
  const config = useContext(ShopFlowContext);
  if (!config) throw new Error("Shop flow provider missing");
  return config;
}
export function ShopFlowProvider({
  config,
  children,
}: {
  config: Omit<ShopFlowProps, "initialPath">;
  children: ReactNode;
}) {
  const inherited = useShopventoLocale();
  const resolved = useMemo(() => {
    const locale = config.locale ?? inherited.locale;
    const messages = Object.fromEntries(
      Object.keys(inherited.messages).map((area) => [
        area,
        {
          ...(locale === inherited.locale
            ? inherited.messages[area as keyof typeof inherited.messages]
            : {}),
          ...config.messages?.[area as keyof typeof inherited.messages],
        },
      ]),
    );
    return resolveConfig({ ...config, locale, messages });
  }, [config, inherited]);
  return (
    <ShopFlowContext.Provider value={resolved}>
      {children}
    </ShopFlowContext.Provider>
  );
}
