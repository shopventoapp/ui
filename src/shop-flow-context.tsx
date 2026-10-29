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
import type { NewsletterSignupProps } from "./newsletter-signup";
import { NewsletterSignup } from "./newsletter-signup";
import { createShopClient } from "./shop-client";
import type { ShopProduct } from "./shop-components";
import { type Article, readCart, writeCart } from "./shop-model";
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
/** Host composition for the complete shop flow. Keep object and client identities stable across renders. */
export interface ShopFlowProps {
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
  storage?: {
    /** Cart for this public form or flow. */
    cart?: string;
    /** Checkout for this public form or flow. */
    checkout?: string;
    /** Pending Order for this public form or flow. */
    pendingOrder?: string;
    /** Cart Event for this public form or flow. */
    cartEvent?: string;
  };
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
    /** Size for this public form or flow. */ size?: number;
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
const defaultClient = createShopClient();
const defaultAccountClient = createAccountClient();
const disabledAccountClient = {
  ...defaultAccountClient,
  getProfile: async () => {
    throw new AccountApiError(401, null);
  },
};
const defaultDashboardClient = createDashboardClient();
const DefaultCheck = ({
  size = 20,
}: {
  /** Size for this public form or flow. */ size?: number;
}) => (
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
  const sections = config.sections || defaultShopSections;
  const shopSectionEnabled = config.sectionEnabled || (() => true);
  const visibleSections = sections.filter((section) =>
    shopSectionEnabled(section.key),
  );
  const text = (value: string, ...args: unknown[]) => {
    const template = config.labels?.[value] ?? value;
    return template.replace(/\{(\d+)\}/g, (match, index: string) =>
      Number(index) < args.length ? String(args[Number(index)]) : match,
    );
  };
  return {
    text,
    resolveHref,
    canonicalPath: (path: string) => replacePath(path, true),
    navigate: (path: string) =>
      (
        config.onNavigate ||
        ((target: string) => window.location.assign(target))
      )(resolveHref(path)),
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
    productModel:
      config.productModel ||
      ((article: Article) => defaultShopProduct(article, config.labels)),
    sections,
    visibleSections,
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
    shopPaymentMethods: config.paymentMethods || ["Kreditkarte", "Debitkarte"],
    OPENING_HOURS: config.openingHours || [],
    giftBasketDelivery:
      config.giftDeliveryNote || "Abholung oder Lieferung nach Verfügbarkeit.",
    NewsletterSignup: config.NewsletterComponent || NewsletterSignup,
    newsletterOptInLabel:
      config.newsletterOptInLabel || "Newsletter per E-Mail abonnieren",
    businessGiftSection: config.businessGiftSection,
    businessInformation: config.businessInformation,
    restrictSections: config.restrictSections,
    turnstileSiteKey: config.turnstileSiteKey,
    Check: config.SuccessIcon || DefaultCheck,
    phoneHref: config.phoneHref,
    phoneLabel: config.phoneLabel,
  };
}
const ShopFlowContext = createContext<ReturnType<typeof resolveConfig> | null>(
  null,
);
/** Use Shop Flow for this public form or flow. */
export function useShopFlow() {
  const config = useContext(ShopFlowContext);
  if (!config) throw new Error("Shop flow provider missing");
  return config;
}
/** Shop Flow Provider for this public form or flow. */
export function ShopFlowProvider({
  config,
  children,
}: {
  /** Config for this public form or flow. */
  config: Omit<ShopFlowProps, "initialPath">;
  /** Children for this public form or flow. */
  children: ReactNode;
}) {
  const resolved = useMemo(() => resolveConfig(config), [config]);
  return (
    <ShopFlowContext.Provider value={resolved}>
      {children}
    </ShopFlowContext.Provider>
  );
}
