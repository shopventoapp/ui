"use client";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AccountAccess } from "./account-entry";
import { useAccountSession } from "./account-hooks";
import {
  type Draft,
  deliversToCountry,
  freshDraft,
  prefillCheckoutDraft,
} from "./checkout-draft";
import { validateCheckoutDetails } from "./checkout-validation";
import type { ShippingAddress } from "./dashboard-client";
import { ShopApiError, type ShopOperations } from "./shop-client";
import {
  ShopButton,
  ShopDeclarations,
  ShopDialog,
  ShopEmpty,
  ShopHero,
  ShopMedia,
  ShopNavigation,
  ShopNotice,
  ShopPrice,
  type ShopProduct,
  ShopProductCard,
  ShopProductGrid,
  ShopQuantity,
  ShopSection,
  ShopSummary,
  ShopSurface,
} from "./shop-components";
import {
  type ShopFlowProps,
  ShopFlowProvider,
  useShopFlow,
} from "./shop-flow-context";
import {
  type Article,
  type CartItem,
  type CheckoutAddress,
  type CheckoutContact,
  checkoutFulfillmentFields,
  defaultFulfillmentId,
  emptyCart,
  type Fulfillment,
  filterKeys,
  formatFulfillmentDate,
  formatPrice,
  fulfillmentDateKey,
  fulfillmentPriceLabel,
  hasPhysicalItems,
  lineKey,
  mergeLine,
  nutritionRows,
  orderAmounts,
  pickupAddress,
  pickupTerms,
  type Quote,
  quoteContainsCart,
  type Settings,
  type ShopCart,
  shippingTerms,
} from "./shop-model";
import { consumeNewsletterIntent } from "./shop-newsletter-intent";
import { Turnstile } from "./turnstile";

const STRIPE_CHECKOUT_HOST = "checkout.stripe.com";

function FreeShippingProgress({
  threshold,
  remaining,
  ready,
}: {
  threshold: number;
  remaining: number;
  ready: boolean;
}) {
  const { text } = useShopFlow();

  const label = remaining
    ? text("Noch {0} bis zum kostenlosen Versand", formatPrice(remaining))
    : text("Kostenloser Versand");
  return (
    <div className="vv-shop-shipping-progress" aria-busy={!ready}>
      <span style={{ visibility: ready ? "visible" : "hidden" }}>
        {remaining ? (
          <>
            {text("Noch ")}
            <strong>{formatPrice(remaining)}</strong>
            {text(" bis zum kostenlosen Versand.")}
          </>
        ) : (
          text("Kostenloser Versand")
        )}
      </span>
      <progress
        aria-label={text("Fortschritt bis zum kostenlosen Versand")}
        aria-valuetext={ready ? label : text("Preise werden geprüft")}
        max={Math.max(1, threshold)}
        value={
          threshold === 0
            ? 1
            : Math.min(threshold, Math.max(0, threshold - remaining))
        }
      />
    </div>
  );
}
function CheckoutIcon({
  kind,
}: {
  kind: "PICKUP" | "SHIPPING" | "DELIVERY" | "trash" | "address";
}) {
  return (
    <svg
      className="vv-shop-checkout-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "trash" ? (
        <>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
        </>
      ) : kind === "PICKUP" ? (
        <>
          <path d="M3 9l2-5h14l2 5M4 10v11h16V10M9 21v-7h6v7" />
          <path d="M3 9c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0" />
        </>
      ) : kind === "address" ? (
        <>
          <path d="M3 11l9-8 9 8M5 10v11h14V10M9 21v-7h6v7" />
        </>
      ) : (
        <>
          <path d="M2 5h12v12H2zM14 9h4l4 5v3h-8" />
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
        </>
      )}
    </svg>
  );
}
function readDraft(checkoutKey: string): Draft {
  try {
    const stored = JSON.parse(sessionStorage.getItem(checkoutKey) || "null");
    if (
      stored?.updated > Date.now() - 86400000 &&
      stored.contact &&
      stored.address
    )
      return stored;
  } catch {}
  return freshDraft();
}
function errorText(error: unknown, text: (value: string) => string) {
  if (error instanceof ShopApiError) {
    const detail = (error.detail as { detail?: unknown })?.detail;
    if (typeof detail === "string") return detail;
    if (error.status === 429)
      return text(
        "Du hast gerade viele Anfragen gesendet. Warte kurz und versuche es erneut.",
      );
    if (error.status === 401)
      return text("Bitte melde Dich an, um Deine Bestellung fortzusetzen.");
  }
  return text(
    "Das hat gerade nicht geklappt. Versuch es bitte noch einmal. Dein Warenkorb bleibt erhalten.",
  );
}
const orderStatusText: Record<
  ShopOperations["order"]["response"]["status"],
  string
> = {
  PENDING: "Deine Zahlung wird geprüft.",
  INCOMPLETE: "Deine Bestellung ist noch unvollständig.",
  PAID: "Deine Bestellung ist bezahlt.",
  PROCESSING: "Deine Bestellung wird vorbereitet.",
  COMPLETED: "Deine Bestellung ist abgeschlossen.",
  CANCELLED: "Deine Bestellung wurde storniert.",
  FAILED: "Deine Zahlung ist fehlgeschlagen.",
  REFUNDED: "Deine Bestellung wurde erstattet.",
  REFUNDED_EXTERNALLY: "Deine Bestellung wurde erstattet.",
  DISPUTED: "Deine Zahlung wird geklärt.",
  DISPUTED_LOST: "Die Zahlung wurde zurückgebucht.",
  PARTIALLY_CANCELLED: "Deine Bestellung wurde teilweise storniert.",
  RETURNED: "Deine Bestellung wurde zurückgegeben.",
  PARTIALLY_RETURNED: "Deine Bestellung wurde teilweise zurückgegeben.",
};
function failedWithUnrefundedCard(order: ShopOperations["order"]["response"]) {
  return (
    order.status === "FAILED" &&
    order.payments.some(
      (p) =>
        p.type === "STRIPE" &&
        [
          "PAID",
          "REFUND_FAILED",
          "REFUND_CANCELED",
          "REFUND_REQUIRES_ACTION",
        ].includes(p.payment_status),
    )
  );
}
function orderStatusMessage(
  order: ShopOperations["order"]["response"],
  text: (value: string) => string,
) {
  if (failedWithUnrefundedCard(order))
    return text("Wir prüfen Deine Bestellung und melden uns.");
  if (
    order.status === "FAILED" &&
    order.payments.some(
      (p) => p.type === "STRIPE" && p.payment_status === "REFUND_SUCCEEDED",
    )
  )
    return text("Deine Zahlung wurde erstattet.");
  if (
    order.status === "FAILED" &&
    order.payments.some(
      (p) => p.type === "STRIPE" && p.payment_status === "REFUND_PENDING",
    )
  )
    return text("Wir erstatten Deine Zahlung.");
  return text(orderStatusText[order.status]);
}
function LinkButton({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  const { resolveHref } = useShopFlow();

  return (
    <a
      className={`sv-shop-link-button ${secondary ? "is-secondary" : ""}`}
      href={resolveHref(href)}
    >
      {children}
    </a>
  );
}
function Field({
  name,
  label,
  value,
  onChange,
  error,
  required = false,
  type = "text",
  autoComplete,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="sv-shop-field">
      <label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && <small id={`${name}-error`}>{error}</small>}
    </div>
  );
}
function Skeleton() {
  const { text } = useShopFlow();

  return (
    <>
      <p role="status">{text("Artikel werden geladen.")}</p>
      <div className="sv-shop-grid" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6].map((id) => (
          <div className="sv-shop-skeleton" key={id} />
        ))}
      </div>
    </>
  );
}
function ShopFlowPage({
  initialPath = "/shop",
}: {
  initialPath?: string;
} = {}) {
  const {
    client,
    accountClient,
    dashboardClient,
    newsletterAdapter,
    checkoutKey,
    pendingOrderKey,
    readCart,
    writeCart,
    categoryKey,
    productModel,
    visibleSections,
    sections,
    isGiftBasket,
    recommendedSection,
    recommendationLinkLabel,
    ageNotice,
    physicalSectionsEnabled,
    bookingEnabled,
    accountEnabled,
    shopPaused,
    shopSectionEnabled,
    shopSectionPath,
    shopImages,
    shopPaymentMethods,
    OPENING_HOURS,
    NewsletterSignup,
    newsletterOptInLabel,
    businessGiftSection,
    restrictSections,
    turnstileSiteKey,
    Check,
    resolveHref,
    navigate,
    canonicalPath,
    text,
    phoneHref,
    phoneLabel,
  } = useShopFlow();

  const session = useAccountSession(accountClient);
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [securityToken, setSecurityToken] = useState("");
  const [securityRevision, setSecurityRevision] = useState(0);
  const [route, setRoute] = useState({
    path: initialPath,
    query: new URLSearchParams(),
  });
  const [articles, setArticles] = useState<Article[]>([]);
  const [publicOptions, setPublicOptions] = useState<Fulfillment[]>([]);
  const [settings, setSettings] =
    useState<ShopOperations["settings"]["response"]>();
  const [catalogState, setCatalogState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [reload, setReload] = useState(0);
  const [cart, setCart] = useState<ShopCart>(emptyCart);
  const [hydrated, setHydrated] = useState(false);
  const [quote, setQuote] = useState<Quote>();
  const [quoteReady, setQuoteReady] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const clearedOptionIds = useRef(new Set<string>());
  const [drawer, setDrawer] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [receiptContact, setReceiptContact] = useState<{
    id: string;
    contact: CheckoutContact;
  } | null>(null);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [receiptNewsletterIntent, setReceiptNewsletterIntent] = useState<{
    accountId: number | null;
  } | null>(null);
  const checkoutAsideRef = useRef<HTMLElement>(null);
  const [tallSummary, setTallSummary] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<ShippingAddress[]>([]);
  const [addressState, setAddressState] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const addressRequest = useRef<{
    id: number;
    promise: Promise<ShippingAddress[]>;
  } | null>(null);
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkoutError, setCheckoutError] = useState("");
  const [posting, setPosting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [order, setOrder] = useState<ShopOperations["order"]["response"]>();
  const [orderReload, setOrderReload] = useState(0);
  const [orderState, setOrderState] = useState<
    "loading" | "paid" | "pending" | "confirmed" | "error"
  >("loading");
  const errorRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Preserve transaction lifecycle; host adapters must keep stable identities.
  useEffect(() => {
    const path = canonicalPath(window.location.pathname.replace(/\/$/, ""));
    const resolvedPath = [
      "/kasse/lieferung",
      "/kasse/zahlung",
      "/kasse/pruefen",
    ].includes(path)
      ? "/kasse"
      : path;
    if (path !== resolvedPath)
      window.history.replaceState(
        null,
        "",
        resolveHref(
          `${resolvedPath}${window.location.search}${window.location.hash}`,
        ),
      );
    setRoute({
      path: resolvedPath,
      query: new URLSearchParams(window.location.search),
    });
    setCart(readCart());
    const loadedDraft = readDraft(checkoutKey);
    setDraft(loadedDraft);
    try {
      const pending = JSON.parse(
        sessionStorage.getItem(pendingOrderKey) || "null",
      );
      if (
        pending?.created > Date.now() - 86400000 &&
        pending.id &&
        (pending.contact || pending.items === JSON.stringify(readCart().items))
      ) {
        setReceiptNewsletterIntent(pending.newsletter || null);
        setReceiptContact({
          id: pending.id,
          contact: pending.contact || loadedDraft.contact,
        });
      }
    } catch {}
    setHydrated(true);
    const onStorage = () => setCart(readCart());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Storage adapters stay stable for this mounted flow.
  const updateCart = useCallback((next: ShopCart) => {
    setCart(next);
    setQuoteReady(false);
    setAccepted(false);
    writeCart(next);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Preserve transaction lifecycle; host adapters must keep stable identities.
  useEffect(() => {
    if (hydrated) {
      try {
        sessionStorage.setItem(
          checkoutKey,
          JSON.stringify({ ...draft, updated: Date.now() }),
        );
      } catch {}
    }
  }, [draft, hydrated]);
  useEffect(() => {
    if (!hydrated || session.loading || route.path !== "/kasse") return;
    setDraft((current) => prefillCheckoutDraft(current, session.profile));
  }, [hydrated, session.loading, session.profile, route.path]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Preserve transaction lifecycle; host adapters must keep stable identities.
  useEffect(() => {
    const profile = session.profile;
    if (!hydrated || session.loading || !profile || route.path !== "/kasse")
      return;
    let active = true;
    if (addressRequest.current?.id !== profile.id) {
      addressRequest.current = {
        id: profile.id,
        promise: dashboardClient.addresses(),
      };
    }
    setAddressState("loading");
    addressRequest.current.promise
      .then((addresses) => {
        if (!active) return;
        setSavedAddresses(addresses);
        setAddressState("ready");
        const hasAccountAddress = !!(
          profile.address1?.trim() &&
          profile.postal_code?.trim() &&
          profile.city?.trim() &&
          deliversToCountry(profile.country)
        );
        setDraft((current) => ({
          ...current,
          accountId: profile.id,
          addressChoice:
            current.accountId === profile.id &&
            (current.addressChoice === "new" ||
              (current.addressChoice === "account" && hasAccountAddress) ||
              addresses.some(
                (address) =>
                  address.id === current.addressChoice &&
                  deliversToCountry(address.country),
              ))
              ? current.addressChoice
              : addresses.find((address) => deliversToCountry(address.country))
                  ?.id || (hasAccountAddress ? "account" : "new"),
        }));
      })
      .catch(() => {
        if (active) setAddressState("failed");
      });
    return () => {
      active = false;
    };
  }, [hydrated, session.loading, session.profile, route.path]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Preserve transaction lifecycle; host adapters must keep stable identities.
  useEffect(() => {
    const controller = new AbortController();
    setCatalogState("loading");
    Promise.all([
      client.request("catalogue", undefined, { signal: controller.signal }),
      client.request("settings", undefined, { signal: controller.signal }),
    ])
      .then(async ([goods, config]) => {
        const sample =
          goods.articles.find(
            (a) =>
              shopSectionEnabled(categoryKey(a)) &&
              a.type === "PHYSICAL" &&
              !a.pickup_only,
          ) ||
          goods.articles.find(
            (a) => shopSectionEnabled(categoryKey(a)) && a.type === "PHYSICAL",
          );
        const detail = sample
          ? await client
              .request("article", undefined, {
                slug: sample.slug,
                query: "?include_fulfillment_options=true",
                signal: controller.signal,
              })
              .catch(() => undefined)
          : undefined;
        if (controller.signal.aborted) return;
        setPublicOptions(detail?.fulfillment_options || []);
        setArticles(
          [...goods.articles, ...(goods.vouchers || [])].filter((article) =>
            shopSectionEnabled(categoryKey(article)),
          ),
        );
        setSettings(config);
        setCatalogState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalogState("error");
      });
    return () => controller.abort();
  }, [reload]);
  const parts = route.path.split("/").filter(Boolean);
  const category = parts[1];
  const slug = parts[2];
  const isGiftCatalogue =
    parts[0] === "shop" && isGiftBasket(category) && !slug;
  const businessAnchor = sections.find(
    (section) => section.key === category,
  )?.businessAnchor;
  useEffect(() => {
    if (
      isGiftCatalogue &&
      catalogState !== "loading" &&
      businessAnchor &&
      window.location.hash === `#${businessAnchor}`
    ) {
      document.getElementById(businessAnchor)?.scrollIntoView();
    }
  }, [isGiftCatalogue, catalogState, businessAnchor]);
  const isCheckout = parts[0] === "kasse" || route.path === "/bestellung";
  const isSuccess =
    (isCheckout && parts[1] === "erfolg") || route.path === "/bestellung";
  // biome-ignore lint/correctness/useExhaustiveDependencies: Preserve transaction lifecycle; host adapters must keep stable identities.
  useEffect(() => {
    if (parts[0] !== "shop" || !slug || slug === "_") return;
    const controller = new AbortController();
    client
      .request("article", undefined, {
        slug,
        query: "?include_fulfillment_options=true",
        signal: controller.signal,
      })
      .then((article) => {
        if (
          !shopSectionEnabled(categoryKey(article)) ||
          categoryKey(article) !== category
        )
          return;
        setArticles((current) => [
          ...current.filter((a) => a.id !== article.id),
          article,
        ]);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setCheckoutError(
            error instanceof ShopApiError && error.status === 404
              ? text("Diesen Artikel gibt es gerade nicht online.")
              : errorText(error, text),
          );
      });
    return () => controller.abort();
  }, [slug]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Preserve transaction lifecycle; host adapters must keep stable identities.
  useEffect(() => {
    if (!hydrated || !isSuccess) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const query = route.query;
    let pendingId: string | undefined;
    try {
      const pending = JSON.parse(
        sessionStorage.getItem(pendingOrderKey) || "null",
      );
      if (pending?.created > Date.now() - 86400000) pendingId = pending.id;
    } catch {}
    const orderId =
      query.get("order_id") ||
      (route.path === "/kasse/erfolg" ? pendingId : undefined);
    const token = query.get("token");
    const session = query.get("session_id");
    if (!orderId) {
      setOrderState("error");
      return;
    }
    // Remove the guest capability from the address bar before any further navigation.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?order_id=${encodeURIComponent(orderId)}`,
    );
    const verify = async () => {
      try {
        if (session && attempts === 0) {
          try {
            await client.request(
              "confirm",
              { session_id: session },
              { signal: controller.signal },
            );
          } catch {
            /* The webhook may have paid the order even if confirmation fails. */
          }
        }
        const result = await client.request("order", undefined, {
          orderId,
          query: token ? `?token=${encodeURIComponent(token)}` : "",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setOrder(result);
        if (
          ["PAID", "PROCESSING", "COMPLETED"].includes(result.status) ||
          failedWithUnrefundedCard(result)
        ) {
          setOrderState(failedWithUnrefundedCard(result) ? "pending" : "paid");
          if (route.path === "/kasse/erfolg") {
            try {
              const pending = JSON.parse(
                sessionStorage.getItem(pendingOrderKey) || "null",
              );
              if (
                pending?.id === orderId &&
                pending.created > Date.now() - 86400000 &&
                pending.items === JSON.stringify(readCart().items)
              ) {
                updateCart(emptyCart());
                sessionStorage.removeItem(checkoutKey);
              }
              if (
                pending?.id === orderId &&
                pending.created > Date.now() - 86400000
              )
                sessionStorage.setItem(
                  pendingOrderKey,
                  JSON.stringify({ ...pending, confirmedAt: Date.now() }),
                );
              /* Keep the token-free order id for payment-return reloads. */
            } catch {
              /* Preserve the cart when a return cannot be associated with its checkout. */
            }
          }
          return;
        }
        setOrderState("pending");
        if (result.status !== "PENDING" && result.status !== "INCOMPLETE")
          return;
        if (++attempts < 8) timer = setTimeout(verify, 2000);
      } catch {
        if (!controller.signal.aborted) {
          let confirmed = false;
          try {
            const marker = JSON.parse(
              sessionStorage.getItem(pendingOrderKey) || "null",
            );
            confirmed =
              route.path === "/kasse/erfolg" &&
              marker?.id === orderId &&
              marker.confirmedAt > Date.now() - 86400000;
          } catch {}
          setOrderState(confirmed ? "confirmed" : "error");
        }
      }
    };
    void verify();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isSuccess, orderReload]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Preserve transaction lifecycle; host adapters must keep stable identities.
  useEffect(() => {
    const first = document.getElementById(Object.keys(errors)[0]);
    const control = first?.matches("input, select, textarea")
      ? first
      : first?.querySelector<HTMLElement>(
          "input:not(:disabled), select, textarea",
        );
    if (Object.keys(errors).length || checkoutError)
      (control || errorRef.current)?.focus();
  }, [errors, checkoutError]);
  const models = articles.map(productModel);
  const productsById = new Map(models.map((p) => [p.id, p]));
  const articlesById = new Map(
    articles.map((article) => [article.id, article]),
  );
  const voucherOnly =
    cart.items.length > 0 &&
    cart.items.every(
      (item) => productsById.get(item.id)?.category === "gutscheine",
    );
  const multiPurposeVoucherOnly =
    voucherOnly &&
    cart.items.every((item) => {
      const article = articlesById.get(item.id);
      return (article?.voucher_kind ?? article?.kind) === "MULTI_PURPOSE";
    });
  const hasFresh = cart.items.some((i) => productsById.get(i.id)?.pickupOnly);
  const adult = cart.items.some((i) => {
    const p = productsById.get(i.id);
    return Boolean(
      p?.variants?.find((v) => v.id === i.variant)?.adultOnly || p?.adultOnly,
    );
  });
  const shipping = quote?.selected_fulfillment_option?.type === "SHIPPING";
  const delivery = quote?.selected_fulfillment_option?.type === "DELIVERY";
  const needsAddress = shipping || delivery;
  const profile = session.profile;
  const needsContactName = !profile?.first_name || !profile?.last_name;
  const checkoutContact = profile
    ? {
        first_name: profile.first_name || draft.contact.first_name,
        last_name: profile.last_name || draft.contact.last_name,
        email: profile.email || "",
        phone: profile.phone || "",
      }
    : draft.contact;
  const accountAddress: CheckoutAddress | null =
    profile?.address1?.trim() &&
    profile.postal_code?.trim() &&
    profile.city?.trim()
      ? {
          name:
            profile.full_name ||
            `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
          address1: profile.address1,
          address2: profile.address2 || "",
          postal_code: profile.postal_code,
          city: profile.city,
          country: profile.country || "",
        }
      : null;
  const normalizeAddressPart = (value: string) =>
    value.replace(/\s/g, "").toLocaleLowerCase("de-DE");
  const accountAddressIsSaved =
    accountAddress &&
    savedAddresses.some((address) =>
      (["address1", "postal_code", "city", "country"] as const).every(
        (key) =>
          normalizeAddressPart(address[key] || "") ===
          normalizeAddressPart(accountAddress[key] || ""),
      ),
    );
  const addressChoicesReady =
    !!profile && addressState === "ready" && draft.accountId === profile.id;
  const selectedAddress = addressChoicesReady
    ? savedAddresses.find((address) => address.id === draft.addressChoice)
    : undefined;
  const checkoutAddress =
    selectedAddress ||
    (addressChoicesReady && draft.addressChoice === "account"
      ? accountAddress
      : null) ||
    draft.address;
  const quotePostcode =
    quote?.selected_fulfillment_option?.type === "DELIVERY" &&
    /^\d{5}$/.test(checkoutAddress.postal_code)
      ? checkoutAddress.postal_code
      : null;
  const signature = JSON.stringify([cart, quotePostcode]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Preserve transaction lifecycle; host adapters must keep stable identities.
  useEffect(() => {
    if (!hydrated || catalogState !== "ready" || !cart.items.length) {
      setQuote(undefined);
      setQuoteReady(false);
      return;
    }
    const allowedItems = cart.items.filter((item) =>
      articles.some(
        (article) =>
          article.id === item.id && shopSectionEnabled(categoryKey(article)),
      ),
    );
    if (restrictSections && allowedItems.length !== cart.items.length) {
      updateCart({ ...cart, items: allowedItems });
      setQuote(undefined);
      setAnnouncement(
        text(
          "Dein Warenkorb wurde an das aktuelle Online-Sortiment angepasst.",
        ),
      );
      return;
    }
    const controller = new AbortController();
    setQuoteReady(false);
    setQuoteError("");
    client
      .request(
        "quote",
        { ...cart, shipping_country: "DE", shipping_postcode: quotePostcode },
        { signal: controller.signal },
      )
      .then((result) => {
        if (controller.signal.aborted) return;
        setQuote(result);
        setArticles((current) => {
          const refreshed = new Map(
            result.items.map((item) => [item.article.id, item.article]),
          );
          return current.map((article) => {
            const fresh = refreshed.get(article.id);
            return fresh
              ? {
                  ...article,
                  price: fresh.price,
                  availability: fresh.availability ?? article.availability,
                }
              : article;
          });
        });
        const selected = defaultFulfillmentId(result, cart);
        if (selected !== (cart.fulfillment_option_id ?? null)) {
          updateCart({ ...cart, fulfillment_option_id: selected });
          return;
        }
        if (!quoteContainsCart(result, cart)) {
          setQuoteError(
            text(
              "Ein Artikel konnte nicht bestätigt werden. Bitte prüfe Deinen Warenkorb.",
            ),
          );
          return;
        }
        setQuoteReady(true);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const optionId = cart.fulfillment_option_id;
        if (
          error instanceof ShopApiError &&
          error.status === 404 &&
          optionId &&
          !clearedOptionIds.current.has(optionId)
        ) {
          clearedOptionIds.current.add(optionId);
          setQuote(undefined);
          updateCart({ ...cart, fulfillment_option_id: null });
          return;
        }
        setQuoteError(errorText(error, text));
      });
    return () => controller.abort();
    // A stable serialized cart prevents requests caused by equivalent object references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, hydrated, reload, catalogState]);
  const selectedOption = quote?.selected_fulfillment_option;
  const dateKey = fulfillmentDateKey(selectedOption);
  useEffect(() => {
    if (!quoteReady) return;
    setDraft((current) =>
      current.dateKey === dateKey
        ? current
        : { ...current, dateKey, fulfillmentDate: "" },
    );
  }, [dateKey, quoteReady]);
  const physical = hasPhysicalItems(cart, articles);
  const pickup =
    physical && quote?.selected_fulfillment_option?.type === "PICKUP";
  const allOptions = [
    ...new Map(
      [
        ...publicOptions,
        ...articles.flatMap((a) => a.fulfillment_options || []),
      ].map((o) => [o.id, o]),
    ).values(),
  ];
  const shippingOption = allOptions.find((o) => o.type === "SHIPPING");
  const pickupOption = allOptions.find((o) => o.type === "PICKUP");
  const deliveryInfo = { shippingOption, pickupOption, settings };
  const changeQuery = (key: string, value: string) => {
    const query = new URLSearchParams(route.query);
    if (key !== "seite") query.delete("seite");
    if (value) query.set(key, value);
    else query.delete(key);
    setRoute({ ...route, query });
    window.history.replaceState(
      null,
      "",
      resolveHref(`${route.path}${query.size ? `?${query}` : ""}`),
    );
  };
  const add = (
    product: ShopProduct,
    quantity = 1,
    extra: Partial<CartItem> = {},
  ) => {
    updateCart(
      mergeLine(
        {
          ...cart,
          fulfillment_option_id: product.pickupOnly
            ? undefined
            : cart.fulfillment_option_id,
        },
        { id: product.id, quantity, ...extra },
      ),
    );
    setDrawer(true);
    setAnnouncement(text("{0} liegt im Warenkorb.", product.title));
  };
  const card = (p: ShopProduct) => (
    <ShopProductCard
      key={p.id}
      product={{
        ...p,
        title:
          p.producer && p.title.startsWith(`${p.producer} `)
            ? p.title.slice(p.producer.length + 1)
            : p.title,
      }}
      addDisabled={shopPaused()}
      href={resolveHref(
        shopSectionEnabled(p.category)
          ? `/shop/${p.category}/${p.slug}`
          : shopSectionPath(p.category),
      )}
      formatPrice={(amount) =>
        `${p.customerDefinedPrice ? "ab " : ""}${formatPrice(amount)}`
      }
      taxLabel={
        p.category === "gutscheine"
          ? undefined
          : isGiftBasket(p.category)
            ? text("inkl. MwSt., Abholung oder Lieferung")
            : p.pickupOnly
              ? text("inkl. MwSt., Abholung")
              : text("inkl. MwSt., zzgl.")
      }
      shippingLabel={
        p.category === "gutscheine" || isGiftBasket(p.category) || p.pickupOnly
          ? undefined
          : text("Versand")
      }
      shippingHref={resolveHref("/versand")}
      addLabel={`${p.title}: ${p.customerDefinedPrice || (p.variants?.length ?? 0) > 1 || isGiftBasket(p.category) ? text("Auswahl öffnen") : text("in den Warenkorb")}`}
      onAdd={
        p.customerDefinedPrice ||
        (p.variants?.length ?? 0) > 1 ||
        isGiftBasket(p.category) ||
        p.pickupOnly
          ? undefined
          : () => add(p, 1, { variant: p.variants?.[0]?.id ?? null })
      }
    />
  );
  const freeShippingProgress =
    physical &&
    selectedOption?.id === cart.fulfillment_option_id &&
    selectedOption?.type === "SHIPPING" &&
    selectedOption.free_shipping_from != null &&
    quote?.free_shipping_remaining != null ? (
      <FreeShippingProgress
        threshold={selectedOption.free_shipping_from}
        remaining={quote.free_shipping_remaining}
        ready={quoteReady}
      />
    ) : null;
  const drawerSummary = (action?: ReactNode) => (
    <ShopSummary
      title={text("Dein Einkauf")}
      rows={
        quote
          ? [
              {
                label: text("Zwischensumme"),
                amount: quote.subtotal_price - (quote.shipping_cost || 0),
              },
              {
                label: !physical
                  ? text("Gutschein per E-Mail")
                  : shipping
                    ? text("Versand (DHL)")
                    : delivery
                      ? text("Lieferung")
                      : text("Click & Collect"),
                amount: quote.shipping_cost || 0,
                isFrom: selectedOption?.price_is_from,
              },
              ...(quote.voucher_discount_amount
                ? [
                    {
                      label: text("Gutscheine"),
                      amount: -quote.voucher_discount_amount,
                    },
                  ]
                : []),
            ]
          : []
      }
      totalLabel={
        selectedOption?.price_is_from ? text("Gesamt ab") : text("Gesamt")
      }
      total={quote?.total_price || 0}
      formatPrice={formatPrice}
      busy={!quoteReady}
    >
      <span className="sv-shop-meta">
        {multiPurposeVoucherOnly ? (
          text(
            "Beim Kauf eines Gutscheins fällt noch keine Umsatzsteuer an, sie entsteht erst bei der Einlösung.",
          )
        ) : (
          <>
            {text("Inklusive MwSt.")}
            {quote?.tax_breakdown?.map(
              (t) => ` ${formatPrice(t.tax)} (${t.label})`,
            )}
          </>
        )}
      </span>
      {quoteError && (
        <ShopNotice error>
          {quoteError}
          <ShopButton onClick={() => setReload((n) => n + 1)}>
            {text("Erneut prüfen")}
          </ShopButton>
        </ShopNotice>
      )}
      {!quoteReady && !quoteError && cart.items.length > 0 && (
        <p role="status">{text("Preise werden geprüft.")}</p>
      )}
      {freeShippingProgress}
      <p className="sv-shop-meta">
        {voucherOnly
          ? text("Du erhältst Deine Gutscheine per E-Mail.")
          : text("Wir liefern nur innerhalb Deutschlands.")}{" "}
        {text("Zahlungsarten:")} {shopPaymentMethods.join(", ")}.
      </p>
      {action}
    </ShopSummary>
  );
  const summary = (action?: ReactNode) => (
    <aside
      ref={isCheckout ? checkoutAsideRef : undefined}
      className={`vv-shop-checkout-aside${isCheckout && tallSummary ? " vv-shop-summary-tall" : ""}`}
    >
      <section className="sv-shop-summary vv-shop-page-summary">
        <header className="vv-shop-summary-head">
          <h2>{isCheckout ? text("Deine Bestellung") : text("Übersicht")}</h2>
          {isCheckout ? (
            <a href={resolveHref("/warenkorb")}>{text("Ändern")}</a>
          ) : (
            <span>
              {cart.items.reduce((sum, item) => sum + item.quantity, 0)}
              {text(" Artikel")}
            </span>
          )}
        </header>
        <div className="vv-shop-summary-body">
          {isCheckout ? (
            <ul className="vv-shop-summary-items">
              {cart.items.map((item) => {
                const product = productsById.get(item.id);
                const line = quote?.items.find(
                  (line) =>
                    line.id === item.id &&
                    (line.variant?.id || "") === (item.variant || "") &&
                    (item.customer_price == null ||
                      line.price_per_item === item.customer_price) &&
                    (line.line_note || "") === (item.line_note || ""),
                );
                return (
                  product && (
                    <li key={lineKey(item)}>
                      <ShopMedia product={{ ...product, badges: [] }} />
                      <span>
                        {product.title}
                        {product.category === "gutscheine" && (
                          <small>{product.subtitle}</small>
                        )}
                        {item.variant && (
                          <small>
                            {
                              product.variants?.find(
                                (variant) => variant.id === item.variant,
                              )?.name
                            }
                          </small>
                        )}
                        {item.line_note && (
                          <small>
                            {text("Deine Wünsche: ")}
                            {item.line_note}
                          </small>
                        )}
                        {(product.withdrawalExcluded ||
                          (settings?.sealed_goods_exclusion_enabled === true &&
                            articles.find((a) => a.id === product.id)
                              ?.withdrawal_lapses_when_unsealed === true)) && (
                          <span className="sv-shop-meta">
                            {product.withdrawalNotice ||
                              (product.withdrawalExcluded
                                ? text(
                                    "Für schnell verderbliche frische Ware besteht kein Widerrufsrecht.",
                                  )
                                : text(
                                    "Nach Entfernen der Versiegelung erlischt das Widerrufsrecht bei geeigneter versiegelter Ware.",
                                  ))}
                          </span>
                        )}

                        <br />
                        <small>
                          {item.quantity} ×{" "}
                          {formatPrice(line?.price_per_item ?? product.price)}
                        </small>
                      </span>
                      <span>
                        {formatPrice(
                          line?.price ?? item.quantity * product.price,
                        )}
                      </span>
                    </li>
                  )
                );
              })}
            </ul>
          ) : (
            fulfillment()
          )}
          {isCheckout &&
            selectedOption?.schedule &&
            draft.fulfillmentDate &&
            draft.dateKey === dateKey && (
              <p className="vv-shop-selected-date">
                {delivery ? text("Liefertermin") : text("Abholtermin")}:{" "}
                {formatFulfillmentDate(draft.fulfillmentDate)}
              </p>
            )}
          {freeShippingProgress}
          <div className="vv-shop-summary-totals">
            <p>
              <span>{text("Zwischensumme")}</span>
              <span>
                {formatPrice(
                  (quote?.subtotal_price || 0) - (quote?.shipping_cost || 0),
                )}
              </span>
            </p>
            <p>
              <span>
                {!physical
                  ? text("Gutschein per E-Mail")
                  : shipping
                    ? text("Versand (DHL)")
                    : delivery
                      ? text("Lieferung")
                      : text("Click & Collect")}
              </span>
              <span>
                {selectedOption
                  ? fulfillmentPriceLabel(selectedOption)
                  : formatPrice(quote?.shipping_cost || 0)}
              </span>
            </p>
            {!!quote?.voucher_discount_amount && (
              <p>
                <span>{text("Gutscheine")}</span>
                <span>{formatPrice(-quote.voucher_discount_amount)}</span>
              </p>
            )}
            <p className="sv-shop-total">
              <strong>
                {selectedOption?.price_is_from
                  ? text("Gesamt ab")
                  : text("Gesamt")}
              </strong>
              <strong>{formatPrice(quote?.total_price || 0)}</strong>
            </p>
          </div>
          <span className="sv-shop-meta">
            {multiPurposeVoucherOnly ? (
              text(
                "Beim Kauf eines Gutscheins fällt noch keine Umsatzsteuer an, sie entsteht erst bei der Einlösung.",
              )
            ) : (
              <>
                {text("Inklusive MwSt.")}
                {quote?.tax_breakdown?.map(
                  (t) => ` ${formatPrice(t.tax)} (${t.label})`,
                )}
              </>
            )}
          </span>
          {quoteError && (
            <ShopNotice error>
              {quoteError}
              <ShopButton onClick={() => setReload((n) => n + 1)}>
                {text("Erneut prüfen")}
              </ShopButton>
            </ShopNotice>
          )}
          {!quoteReady && !quoteError && (
            <p role="status">{text("Preise werden geprüft.")}</p>
          )}
          {action}
          {!isCheckout && (
            // biome-ignore lint/a11y/useSemanticElements: Preserve host layout and existing div markup during extraction.
            <div
              className="vv-shop-payment-chips"
              role="group"
              aria-label={text("Zahlungsarten")}
            >
              {shopPaymentMethods.map((method) => (
                <span key={method}>{method}</span>
              ))}
            </div>
          )}
        </div>
      </section>
      {isCheckout ? (
        adult && (
          <p className="sv-shop-meta">
            {text("Enthält Alkohol: Abgabe nur an Personen ab 18 Jahren.")}
          </p>
        )
      ) : (
        <p className="sv-shop-meta">
          {voucherOnly ? (
            text("Du erhältst Deine Gutscheine per E-Mail.")
          ) : (
            <>
              {text("Wir liefern nur innerhalb Deutschlands.")}{" "}
              <a href={resolveHref("/versand")}>
                {text("Versand und Abholung")}
              </a>
            </>
          )}
        </p>
      )}
    </aside>
  );

  const cartLines = (readOnly = false) =>
    cart.items.map((item) => {
      const p = productsById.get(item.id);
      const quoted = quote?.items.find(
        (q) =>
          q.id === item.id &&
          (q.variant?.id || "") === (item.variant || "") &&
          (item.customer_price == null ||
            q.price_per_item === item.customer_price) &&
          ((q as typeof q & { line_note?: string }).line_note || "") ===
            (item.line_note || ""),
      );
      if (!p)
        return (
          <ShopNotice key={lineKey(item)} error>
            {text("Ein Artikel ist nicht mehr im Sortiment.")}{" "}
            <ShopButton
              onClick={() =>
                updateCart({
                  ...cart,
                  items: cart.items.filter((i) => lineKey(i) !== lineKey(item)),
                })
              }
            >
              {text("Artikel entfernen")}
            </ShopButton>
          </ShopNotice>
        );
      return (
        <article
          className={`sv-shop-cart-line ${readOnly ? "vv-shop-review-line" : ""}`}
          key={lineKey(item)}
        >
          <ShopMedia product={readOnly ? p : { ...p, badges: [] }} />
          <div>
            {!readOnly && (
              <span className="vv-shop-line-producer">{p.producer}</span>
            )}
            <h3>
              <a
                href={resolveHref(
                  shopSectionEnabled(p.category)
                    ? `/shop/${p.category}/${p.slug}`
                    : shopSectionPath(p.category),
                )}
              >
                {p.producer && p.title.startsWith(`${p.producer} `)
                  ? p.title.slice(p.producer.length + 1)
                  : p.title}
              </a>
            </h3>
            {!readOnly && (
              <strong className="vv-shop-line-total">
                {formatPrice(
                  quoted?.price ??
                    item.quantity * (item.customer_price ?? p.price),
                )}
              </strong>
            )}
            {p.category === "gutscheine" && (
              <span className="sv-shop-meta">{p.subtitle}</span>
            )}
            {item.variant && (
              <span className="sv-shop-meta">
                {p.variants?.find((v) => v.id === item.variant)?.name}
              </span>
            )}
            {item.line_note && (
              <span className="sv-shop-meta">
                {text("Deine Wünsche: ")}
                {item.line_note}
              </span>
            )}
            <ShopPrice
              amount={
                quoted?.price_per_item ??
                item.customer_price ??
                p.variants?.find((v) => v.id === item.variant)?.price ??
                p.price
              }
              formatPrice={formatPrice}
              unitPrice={
                item.variant
                  ? p.variants?.find((v) => v.id === item.variant)?.unitPrice
                  : p.unitPrice
              }
            />
            {isGiftBasket(p.category) ? (
              <span>{text("Abholung oder Lieferung")}</span>
            ) : (
              p.pickupOnly && <span>{text("Nur Abholung")}</span>
            )}
            {(p.withdrawalExcluded ||
              (settings?.sealed_goods_exclusion_enabled === true &&
                articles.find((a) => a.id === p.id)
                  ?.withdrawal_lapses_when_unsealed === true)) && (
              <span className="sv-shop-meta">
                {p.withdrawalNotice ||
                  (p.withdrawalExcluded
                    ? text(
                        "Für schnell verderbliche frische Ware besteht kein Widerrufsrecht.",
                      )
                    : text(
                        "Nach Entfernen der Versiegelung erlischt das Widerrufsrecht bei geeigneter versiegelter Ware.",
                      ))}
              </span>
            )}
            {readOnly ? (
              <p>
                {item.quantity} {text(" Stück ·")}{" "}
                {formatPrice(
                  item.quantity *
                    (quoted?.price_per_item ??
                      item.customer_price ??
                      p.variants?.find((v) => v.id === item.variant)?.price ??
                      p.price),
                )}
              </p>
            ) : (
              <footer>
                <ShopQuantity
                  value={item.quantity}
                  onChange={(quantity) =>
                    updateCart({
                      ...cart,
                      items: cart.items.map((i) =>
                        lineKey(i) === lineKey(item) ? { ...i, quantity } : i,
                      ),
                    })
                  }
                  label={text("Menge {0}", p.title)}
                  decreaseLabel={`${p.title}: weniger`}
                  increaseLabel={`${p.title}: mehr`}
                />
                <button
                  className="vv-shop-remove"
                  type="button"
                  onClick={() =>
                    updateCart({
                      ...cart,
                      items: cart.items.filter(
                        (i) => lineKey(i) !== lineKey(item),
                      ),
                    })
                  }
                  aria-label={`${p.title} entfernen`}
                >
                  <CheckoutIcon kind="trash" />
                </button>
              </footer>
            )}
          </div>
        </article>
      );
    });
  const voucher = () => (
    <VoucherField cart={cart} onChange={updateCart} quote={quote} />
  );
  const fulfillment = () =>
    physical ? (
      <fieldset
        id="fulfillment"
        className="sv-shop-facet vv-shop-method-options"
      >
        <legend>
          {quote?.available_fulfillment_options?.some(
            (o) => o.type === "DELIVERY",
          )
            ? text("Lieferung oder Abholung")
            : text("Versand oder Abholung")}
        </legend>
        {quote?.available_fulfillment_options?.map((option) => (
          <label className="sv-shop-radio" key={option.id}>
            <input
              name="fulfillment"
              type="radio"
              checked={cart.fulfillment_option_id === option.id}
              onChange={() => {
                setDraft({ ...draft, fulfillmentDate: "", dateKey: "" });
                setErrors({});
                setCheckoutError("");
                updateCart({ ...cart, fulfillment_option_id: option.id });
              }}
            />
            <span>
              <CheckoutIcon
                kind={
                  option.type === "PICKUP"
                    ? "PICKUP"
                    : option.type === "DELIVERY"
                      ? "DELIVERY"
                      : "SHIPPING"
                }
              />
              {option.type === "SHIPPING"
                ? text("Versand mit DHL")
                : option.type === "PICKUP"
                  ? text("Click & Collect")
                  : option.type === "DELIVERY"
                    ? text("Lieferung")
                    : option.title}
            </span>
            <span>
              {fulfillmentPriceLabel(
                option.id === selectedOption?.id ? selectedOption : option,
              )}
            </span>
          </label>
        ))}
        {hasFresh && (
          <ShopNotice>
            {text("Frische Ware erhältst Du nur per Click & Collect.")}
          </ShopNotice>
        )}
        {quote?.fulfillment_notice && (
          <ShopNotice>{quote.fulfillment_notice}</ShopNotice>
        )}
        {adult && (
          <p className="sv-shop-meta">
            {shipping
              ? text(
                  "DHL Alterssichtprüfung 18+: bitte halte Deinen Ausweis bereit. Keine Packstation.",
                )
              : delivery
                ? text(
                    "Wir prüfen das Alter bei der Übergabe (18+). Bring bitte Deinen Ausweis mit.",
                  )
                : text(
                    "Bei der Abholung prüfen wir Dein Alter. Bitte bring Deinen Ausweis mit.",
                  )}
          </p>
        )}
      </fieldset>
    ) : (
      <ShopNotice>
        {text(
          "Deine Gutscheine erhältst Du per E-Mail. Kein Versand und keine Abholung nötig.",
        )}
      </ShopNotice>
    );
  const fulfillmentDate = () => (
    <>
      {" "}
      {selectedOption?.schedule && (
        <div className="sv-shop-field">
          <label htmlFor="fulfillment_date">
            {delivery ? text("Liefertermin") : text("Abholtermin")} *
          </label>
          <select
            id="fulfillment_date"
            name="fulfillment_date"
            required
            value={draft.dateKey === dateKey ? draft.fulfillmentDate || "" : ""}
            aria-invalid={!!errors.fulfillment_date}
            aria-describedby={
              errors.fulfillment_date ? "fulfillment_date-error" : undefined
            }
            onChange={(e) => {
              setDraft({
                ...draft,
                dateKey,
                fulfillmentDate: e.target.value,
              });
              setAccepted(false);
              setErrors(
                Object.fromEntries(
                  Object.entries(errors).filter(
                    ([key]) => key !== "fulfillment_date",
                  ),
                ),
              );
              setCheckoutError("");
            }}
          >
            <option value="">{text("Bitte wähle einen Termin")}</option>
            {selectedOption.eligible_dates?.map((date) => (
              <option key={date} value={date}>
                {formatFulfillmentDate(date)}
              </option>
            ))}
          </select>
          {!selectedOption.eligible_dates?.length && (
            <p>{text("Zurzeit ist kein Termin verfügbar.")}</p>
          )}
          {errors.fulfillment_date && (
            <small id="fulfillment_date-error">{errors.fulfillment_date}</small>
          )}
        </div>
      )}
    </>
  );
  const fulfillmentName =
    selectedOption?.type === "SHIPPING"
      ? text("Versand mit DHL")
      : selectedOption?.type === "PICKUP"
        ? text("Click & Collect")
        : selectedOption?.type === "DELIVERY"
          ? text("Lieferung")
          : selectedOption?.title;
  const chosenFulfillment = () =>
    physical ? (
      <div id="fulfillment">
        <div className="vv-shop-checkout-compact vv-shop-chosen-method">
          <CheckoutIcon
            kind={pickup ? "PICKUP" : delivery ? "DELIVERY" : "SHIPPING"}
          />
          <p>
            <strong>{fulfillmentName}</strong>
            {pickup && ` · ${pickupAddress(selectedOption || undefined)}`}
          </p>
          <div className="vv-shop-method-actions">
            <strong>{formatPrice(selectedOption?.price || 0)}</strong>
            <a href={resolveHref("/warenkorb")}>{text("Ändern")}</a>
          </div>
        </div>
        {adult && (
          <p className="sv-shop-meta">
            {shipping
              ? text(
                  "DHL Alterssichtprüfung 18+: bitte halte Deinen Ausweis bereit. Keine Packstation.",
                )
              : delivery
                ? text(
                    "Wir prüfen das Alter bei der Übergabe (18+). Bring bitte Deinen Ausweis mit.",
                  )
                : text(
                    "Bei der Abholung prüfen wir Dein Alter. Bitte bring Deinen Ausweis mit.",
                  )}
          </p>
        )}
        {fulfillmentDate()}
      </div>
    ) : (
      <ShopNotice>
        {text(
          "Deine Gutscheine erhältst Du per E-Mail. Kein Versand und keine Abholung nötig.",
        )}
      </ShopNotice>
    );

  function validateDelivery() {
    const result = validateCheckoutDetails(
      {
        checkoutContact,
        checkoutAddress,
        needsAddress,
        adult,
        shipping,
        physical,
        fulfillmentOptionId: cart.fulfillment_option_id,
        selectedOption,
        dateKey,
        dateKeyInDraft: draft.dateKey,
        fulfillmentDate: draft.fulfillmentDate,
        addressChoicesReady,
        addressChoice: draft.addressChoice,
      },
      text,
    );
    setErrors(result);
    return Object.keys(result).length === 0;
  }
  function chooseAddress(addressChoice: string) {
    setDraft({ ...draft, addressChoice });
    setAccepted(false);
    setErrors(
      Object.fromEntries(
        Object.entries(errors).filter(
          ([key]) =>
            ![
              "address_choice",
              "address1",
              "address2",
              "postal_code",
              "city",
            ].includes(key),
        ),
      ),
    );
    setCheckoutError("");
  }
  async function placeOrder() {
    if (shopPaused() || posting || !quoteReady || !quote || !cart.items.length)
      return;
    if (!validateDelivery()) {
      setCheckoutError(text("Prüfe Deine Lieferdaten."));
      return;
    }
    if (settings?.shop_checkout_review_required !== true) {
      setCheckoutError(
        text(
          "Die Bestellprüfung ist noch nicht eingerichtet. Bitte kontaktiere uns vor Deiner Bestellung.",
        ),
      );
      return;
    }
    if (!accepted) {
      setErrors({
        terms: text(
          "Bitte akzeptiere die AGB und lies die Widerrufsbelehrung.",
        ),
      });
      return;
    }
    if (
      session.loading ||
      (profile && needsAddress && addressState === "loading")
    )
      return;
    if (!session.profile && !securityToken) {
      setErrors({
        security: text("Bitte schließe die Sicherheitsprüfung ab."),
      });
      return;
    }
    setPosting(true);
    setCheckoutError("");
    try {
      const latest = await client.request("quote", {
        ...cart,
        fulfillment_option_id: physical ? cart.fulfillment_option_id : null,
        shipping_country: "DE",
        shipping_postcode: quotePostcode,
      });
      if (!quoteContainsCart(latest, cart)) {
        setQuoteReady(false);
        throw new Error("Incomplete quote");
      }
      if (fulfillmentDateKey(latest.selected_fulfillment_option) !== dateKey) {
        setQuote(latest);
        setDraft({
          ...draft,
          fulfillmentDate: "",
          dateKey: fulfillmentDateKey(latest.selected_fulfillment_option),
        });
        setAccepted(false);
        setErrors({
          fulfillment_date: text(
            "Die verfügbaren Termine haben sich geändert. Bitte wähle erneut einen Termin aus.",
          ),
        });
        setRoute({ ...route, path: "/kasse" });
        window.history.replaceState(null, "", resolveHref("/kasse"));
        return;
      }
      if (
        latest.total_price !== quote.total_price ||
        latest.subtotal_price !== quote.subtotal_price ||
        latest.shipping_cost !== quote.shipping_cost ||
        JSON.stringify(
          latest.items.map((i) => [
            i.id,
            i.variant?.id,
            i.quantity,
            i.price_per_item,
            i.price,
          ]),
        ) !==
          JSON.stringify(
            quote.items.map((i) => [
              i.id,
              i.variant?.id,
              i.quantity,
              i.price_per_item,
              i.price,
            ]),
          ) ||
        latest.selected_fulfillment_option?.id !==
          quote.selected_fulfillment_option?.id
      ) {
        setQuote(latest);
        setAccepted(false);
        setCheckoutError(
          text(
            "Dein Einkauf hat sich geändert. Prüfe die neuen Preise und bestätige Deine Bestellung erneut.",
          ),
        );
        return;
      }
      const response = await client.request("checkout", {
        ...cart,
        ...checkoutFulfillmentFields(selectedOption, draft.fulfillmentDate),
        fulfillment_option_id: physical ? cart.fulfillment_option_id : null,
        shipping_country: "DE",
        shipping_postcode: quotePostcode,
        contact: checkoutContact,
        ...(needsAddress && selectedAddress
          ? { shipping_address_id: selectedAddress.id }
          : {
              shipping_address: needsAddress
                ? {
                    ...checkoutAddress,
                    name: `${checkoutContact.first_name} ${checkoutContact.last_name}`,
                    email: checkoutContact.email,
                  }
                : null,
            }),
        terms_accepted: true,
        turnstile_token: session.profile ? undefined : securityToken,
      });
      if (response.order_id) {
        try {
          sessionStorage.setItem(
            pendingOrderKey,
            JSON.stringify({
              id: response.order_id,
              contact: checkoutContact,
              items: JSON.stringify(cart.items),
              created: Date.now(),
              ...(newsletterOptIn
                ? { newsletter: { accountId: profile?.id ?? null } }
                : {}),
            }),
          );
        } catch {}
      }
      if (response.checkout_url) {
        const target = new URL(response.checkout_url);
        if (
          target.protocol !== "https:" ||
          target.hostname !== STRIPE_CHECKOUT_HOST
        )
          throw new Error("Unexpected checkout destination");
        navigate(target.href);
      } else if (
        response.status === "no_payment_required" &&
        response.order_id
      ) {
        navigate(
          `/kasse/erfolg?order_id=${encodeURIComponent(response.order_id)}${response.order_access_token ? `&token=${encodeURIComponent(response.order_access_token)}` : ""}`,
        );
      } else if (response.status === "no_payment_required") {
        try {
          sessionStorage.removeItem(pendingOrderKey);
          sessionStorage.removeItem(checkoutKey);
        } catch {}
        updateCart(emptyCart());
        navigate("/kasse/erfolg?angelegt=1");
      } else throw new Error("Missing payment destination");
    } catch (error) {
      const detail = errorText(error, text);
      if (error instanceof ShopApiError && error.status === 400) {
        const field =
          /termin/i.test(detail) && selectedOption?.schedule
            ? "fulfillment_date"
            : delivery && /postleitzahl|liefern (nur|nicht)/i.test(detail)
              ? addressChoicesReady && draft.addressChoice !== "new"
                ? "address_choice"
                : "postal_code"
              : null;
        if (field) {
          setErrors({ [field]: detail });
          if (field === "fulfillment_date")
            setDraft({ ...draft, fulfillmentDate: "" });
          setAccepted(false);
          setRoute({ ...route, path: "/kasse" });
          window.history.replaceState(null, "", resolveHref("/kasse"));
        }
      }
      setSecurityToken("");
      setSecurityRevision((n) => n + 1);
      setCheckoutError(errorText(error, text));
    } finally {
      setPosting(false);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: Preserve transaction lifecycle; host adapters must keep stable identities.
  useEffect(() => {
    const aside = checkoutAsideRef.current;
    if (!aside) return;
    const measure = () =>
      setTallSummary(aside.offsetHeight > window.innerHeight - 126);
    const observer = new ResizeObserver(measure);
    observer.observe(aside);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isCheckout, isSuccess, cart.items.length, guestCheckout, profile?.id]);
  const orderContact =
    order && receiptContact?.id === order.id ? receiptContact.contact : null;
  const orderEmail =
    orderContact?.email ||
    order?.fulfillments.find((fulfillment) => fulfillment.shipping_email)
      ?.shipping_email ||
    profile?.email ||
    "";
  const orderFirstName =
    orderContact?.first_name ||
    profile?.first_name ||
    order?.fulfillments
      .find((fulfillment) => fulfillment.shipping_name)
      ?.shipping_name?.split(" ")[0] ||
    "";
  const orderItemTaxes = new Map<number, number>();
  for (const item of order?.items || []) {
    if (item.vat_rate > 0)
      orderItemTaxes.set(
        item.vat_rate,
        (orderItemTaxes.get(item.vat_rate) || 0) +
          item.quantity * (item.gross_price_per_item - item.net_price_per_item),
      );
  }

  let content: ReactNode;
  if (isSuccess)
    content = (
      <div className="sv-shop-success">
        <p className="sv-shop-eyebrow">
          {order
            ? text("Bestellung {0}", order.order_number)
            : text("Deine Bestellung")}
        </p>
        {orderState === "paid" && (
          <span className="vv-shop-success-mark" aria-hidden="true">
            <Check size={20} />
          </span>
        )}
        <h1>
          {orderState === "paid" ? (
            <>
              {text("Danke")}
              {orderFirstName ? (
                <>
                  , <em>{orderFirstName}!</em>
                </>
              ) : (
                " Dir!"
              )}{" "}
            </>
          ) : orderState === "confirmed" ? (
            text("Deine Bestellung ist eingegangen.")
          ) : order ? (
            orderStatusMessage(order, text)
          ) : orderState === "error" ? (
            route.query.get("angelegt") === "1" ? (
              text(
                "Deine Bestellung wurde angelegt. Die Bestätigung kommt per E-Mail.",
              )
            ) : (
              text("Wir konnten die Zahlung noch nicht bestätigen.")
            )
          ) : (
            text("Wir prüfen Deine Bestellung.")
          )}
        </h1>
        {orderState === "paid" && (
          <>
            <p className="sv-shop-lead">
              {text("Deine Bestellung ist bei uns.")}{" "}
              {order?.fulfillments.some((f) => f.type === "SHIPPING") && (
                <>
                  {text(
                    "Wir packen Deinen Einkauf und schicken Dir die Versandbestätigung mit Sendungsnummer per E-Mail.",
                  )}{" "}
                </>
              )}
              {order?.fulfillments.some((f) => f.type === "PICKUP") && (
                <>
                  {text(
                    "Wir schreiben Dir per E-Mail, sobald alles bereitliegt. ",
                  )}
                </>
              )}
              {order?.fulfillments
                .filter((f) => f.type === "DELIVERY")
                .map((f) => (
                  <span key={f.id}>
                    {text("Wir liefern Deinen Einkauf")}
                    {f.scheduled_date
                      ? ` am ${formatFulfillmentDate(f.scheduled_date)}`
                      : text(" zum bestätigten Termin")}{" "}
                    {text("und schicken Dir die Bestätigung per E-Mail.")}{" "}
                  </span>
                ))}
              {order?.items.some((item) => item.voucher_kind !== "NONE") && (
                <>{text("Deine Gutscheine senden wir Dir per E-Mail.")}</>
              )}
              {orderEmail && (
                <>
                  {" "}
                  {text("Alle E-Mails gehen an ")}
                  <strong>{orderEmail}</strong>.
                </>
              )}
            </p>
            {order?.fulfillments
              .filter(
                (fulfillment) =>
                  fulfillment.type === "PICKUP" && fulfillment.code.trim(),
              )
              .map((fulfillment) => (
                <div className="vv-shop-pickup-code" key={fulfillment.id}>
                  <span>{text("Dein Abholcode")}</span>
                  <strong>{fulfillment.code}</strong>
                  <p>
                    {text(
                      "Gilt ab unserer E-Mail „abholbereit“. Ausweis mitbringen.",
                    )}
                  </p>
                </div>
              ))}
          </>
        )}

        {order && (
          <>
            {orderState !== "paid" && (
              <p>
                {text("Status: ")}
                {orderStatusMessage(order, text)}
              </p>
            )}
            <div className="vv-shop-receipt-layout">
              <section className="sv-shop-summary vv-shop-page-summary">
                <header className="vv-shop-summary-head">
                  <h2>{text("Deine Bestellung")}</h2>
                </header>
                <div className="vv-shop-summary-body">
                  <ul className="vv-shop-summary-items vv-shop-order-items">
                    {order.items.map((item) => {
                      const product = models.find(
                        (model) => model.title === item.title,
                      );
                      return (
                        <li key={item.id}>
                          {product ? (
                            <ShopMedia product={{ ...product, badges: [] }} />
                          ) : (
                            <span
                              className="sv-shop-media"
                              aria-hidden="true"
                            />
                          )}
                          <span>
                            <strong>{item.title}</strong>
                            <span>
                              {item.quantity} ×{" "}
                              {formatPrice(item.gross_price_per_item)}
                              {text(" pro Stück")}
                              {item.voucher_kind === "MULTI_PURPOSE"
                                ? text(
                                    ", Mehrzweckgutschein, einlösbar für das komplette Sortiment",
                                  )
                                : text(", inkl. MwSt.")}
                            </span>
                            {item.withdrawal_lapses_when_unsealed && (
                              <span>
                                {text(
                                  "Bei geeigneter versiegelter Ware erlischt das Widerrufsrecht nach Entfernen der Versiegelung.",
                                )}
                              </span>
                            )}
                            {item.withdrawal_excluded_reason ===
                              "PERISHABLE" && (
                              <span>
                                {text(
                                  "Schnell verderbliche Ware: kein Widerrufsrecht.",
                                )}
                              </span>
                            )}
                            {item.line_note && (
                              <span>
                                {text("Deine Wünsche: ")}
                                {item.line_note}
                              </span>
                            )}
                          </span>
                          <span>
                            {formatPrice(
                              item.quantity * item.gross_price_per_item,
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {order.status !== "FAILED" && (
                    <>
                      <div className="vv-shop-summary-totals">
                        <p>
                          <span>{text(" Artikel")}</span>
                          <span>
                            {formatPrice(
                              order.items.reduce(
                                (total, item) =>
                                  total +
                                  item.quantity * item.gross_price_per_item,
                                0,
                              ),
                            )}
                          </span>
                        </p>
                        <p>
                          <span>
                            {order.fulfillments
                              .map((f) =>
                                f.type === "SHIPPING"
                                  ? text("Versand (DHL)")
                                  : f.type === "DELIVERY"
                                    ? text("Lieferung")
                                    : f.type === "PICKUP"
                                      ? text("Click & Collect")
                                      : f.name,
                              )
                              .join(" / ") || text("Gutschein per E-Mail")}
                          </span>
                          <span>
                            {formatPrice(
                              order.fulfillments.reduce(
                                (total, fulfillment) =>
                                  total + fulfillment.price,
                                0,
                              ),
                            )}
                          </span>
                        </p>
                        {!!orderAmounts(order).vouchers && (
                          <p>
                            <span>{text("Gutscheine")}</span>
                            <span>
                              {formatPrice(-orderAmounts(order).vouchers)}
                            </span>
                          </p>
                        )}
                        {!!orderAmounts(order).discount && (
                          <p>
                            <span>{text("Rabatt")}</span>
                            <span>
                              {formatPrice(-orderAmounts(order).discount)}
                            </span>
                          </p>
                        )}
                        <p className="sv-shop-total">
                          <strong>
                            {orderState === "paid"
                              ? text("Bezahlt")
                              : text("Gesamt")}
                          </strong>
                          <strong>
                            {formatPrice(orderAmounts(order).paid)}
                          </strong>
                        </p>
                      </div>
                      <span className="sv-shop-meta">
                        {text("Inklusive MwSt. (Artikel):")}{" "}
                        {[...orderItemTaxes]
                          .map(
                            ([rate, tax]) =>
                              `${Math.round(rate * 100)} %: ${formatPrice(tax)}`,
                          )
                          .join(" · ") || "0,00 €"}
                      </span>
                    </>
                  )}
                </div>
              </section>
              <div className="vv-shop-receipt-fulfillment">
                {order.fulfillments
                  .filter(
                    (f) =>
                      f.type === "SHIPPING" ||
                      f.type === "PICKUP" ||
                      f.type === "DELIVERY",
                  )
                  .map((fulfillment) => (
                    <ShopNotice key={fulfillment.id}>
                      <strong>
                        {fulfillment.type === "SHIPPING"
                          ? text("Versand")
                          : fulfillment.type === "DELIVERY"
                            ? text("Lieferung")
                            : text("Click & Collect")}
                      </strong>
                      {fulfillment.scheduled_date && (
                        <p>
                          {fulfillment.type === "DELIVERY"
                            ? text("Liefertermin")
                            : text("Abholtermin")}
                          : {formatFulfillmentDate(fulfillment.scheduled_date)}
                        </p>
                      )}
                      <p>
                        {fulfillment.shipping_name || fulfillment.pickup_name}
                        <br />
                        {fulfillment.shipping_address1 ||
                          fulfillment.pickup_address}
                        <br />
                        {fulfillment.shipping_address2 && (
                          <>
                            {fulfillment.shipping_address2}
                            <br />
                          </>
                        )}
                        {fulfillment.shipping_postal_code ||
                          fulfillment.pickup_postal_code}{" "}
                        {fulfillment.shipping_city || fulfillment.pickup_city}
                        <br />
                        {(fulfillment.shipping_country ||
                          fulfillment.pickup_country) === "DE"
                          ? text("Deutschland")
                          : fulfillment.shipping_country ||
                            fulfillment.pickup_country}
                      </p>
                      {fulfillment.shipping_tracking_number && (
                        <p>
                          {text("Sendungsnummer: ")}
                          {fulfillment.shipping_tracking_number}
                        </p>
                      )}
                    </ShopNotice>
                  ))}
              </div>
            </div>
          </>
        )}
        {orderState !== "paid" && (
          <p>
            {orderState === "confirmed"
              ? text(
                  "Die Zahlung war bestätigt. Für den aktuellen Stand öffne bitte den Bestelllink aus Deiner E-Mail.",
                )
              : route.path === "/kasse/erfolg" &&
                  (!order || ["PENDING", "INCOMPLETE"].includes(order.status))
                ? text(
                    "Dein Warenkorb bleibt erhalten, bis die Zahlung bestätigt wurde.",
                  )
                : text(
                    "Den aktuellen Stand Deiner Bestellung findest Du hier.",
                  )}
          </p>
        )}
        {orderState === "paid" &&
          (newsletterSubscribed ||
            (!session.loading &&
              (!profile?.newsletter_consent ||
                receiptNewsletterIntent?.accountId === profile?.id))) && (
            <NewsletterSignup
              siteKey={settings?.turnstile_site_key || turnstileSiteKey || ""}
              initialEmail={profile?.email || orderEmail}
              initialFirstName={orderFirstName}
              variant="card"
              pending={
                !!profile?.newsletter_requested_at &&
                !profile?.newsletter_confirmed_at
              }
              automatic={
                route.path === "/kasse/erfolg" &&
                receiptContact?.id === order?.id &&
                receiptNewsletterIntent &&
                receiptNewsletterIntent.accountId === (profile?.id ?? null) &&
                !session.loading
                  ? {
                      onAttempt: () =>
                        consumeNewsletterIntent(
                          sessionStorage,
                          order!.id,
                          profile?.id ?? null,
                          pendingOrderKey,
                        ),
                      alreadySubscribed:
                        !!profile?.newsletter_consent ||
                        !!profile?.newsletter_requested_at,
                    }
                  : undefined
              }
              onSubscribe={
                profile
                  ? async () => {
                      await newsletterAdapter.subscribe();
                      setNewsletterSubscribed(true);
                      session.reload();
                    }
                  : undefined
              }
            />
          )}
        <div className="sv-shop-actions">
          {orderState !== "paid" && (
            <ShopButton onClick={() => setOrderReload((n) => n + 1)}>
              {text("Erneut prüfen")}
            </ShopButton>
          )}
          <LinkButton href="/shop">{text("Weiter stöbern")}</LinkButton>
          {accountEnabled() && (
            <LinkButton href="/konto" secondary>
              {text("Mein Konto")}
            </LinkButton>
          )}
        </div>
      </div>
    );
  else if (isCheckout && parts[1] === "abgebrochen")
    content = (
      <ShopEmpty
        title={text("Die Zahlung wurde abgebrochen.")}
        action={
          <LinkButton href="/kasse">{text("Erneut zur Zahlung")}</LinkButton>
        }
      >
        {text(
          "Dein Warenkorb und Deine Lieferdaten bleiben erhalten. Du kannst es noch einmal versuchen.",
        )}
      </ShopEmpty>
    );
  else if (isCheckout) {
    content = (
      <>
        {!cart.items.length && (
          <h1>
            {text("Fast ")}
            <em>{text("geschafft.")}</em>
          </h1>
        )}
        {!cart.items.length ? (
          <ShopEmpty
            title={text("Dein Warenkorb ist leer.")}
            action={<LinkButton href="/shop">{text("Zum Shop")}</LinkButton>}
          >
            {text("Such Dir etwas Schönes aus.")}
          </ShopEmpty>
        ) : (
          <div className="sv-shop-checkout-layout">
            <div className="vv-shop-checkout-main">
              <h1>
                {text("Fast ")}
                <em>{text("geschafft.")}</em>
              </h1>
              {(Object.keys(errors).length > 0 || checkoutError) && (
                <div
                  className="vv-shop-error-summary"
                  role="alert"
                  tabIndex={-1}
                  ref={errorRef}
                >
                  <h2>
                    {checkoutError
                      ? text("Die Bestellung konnte nicht abgeschlossen werden")
                      : text("Bitte prüfe Deine Angaben")}
                  </h2>
                  {checkoutError && <p>{checkoutError}</p>}
                  <ul>
                    {Object.entries(errors).map(([key, error]) => (
                      <li key={key}>
                        <a href={resolveHref(`#${key}`)}>{error}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!session.loading && !profile && accountEnabled() && (
                <AccountAccess
                  client={accountClient}
                  returnPath={resolveHref("/kasse")}
                  onAuthenticated={session.reload}
                  onGuest={
                    settings?.guest_shop_checkout_enabled !== false
                      ? () => setGuestCheckout(true)
                      : undefined
                  }
                />
              )}
              {(profile || guestCheckout || !accountEnabled()) && (
                <form
                  className="sv-shop-form"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void placeOrder();
                  }}
                >
                  {settings?.guest_shop_checkout_enabled === false && (
                    <ShopNotice>
                      {text("Für diese Bestellung melde Dich bitte zuerst an.")}{" "}
                      {accountEnabled() && (
                        <a href={resolveHref("/konto/anmelden?weiter=/kasse")}>
                          {text("Anmelden")}
                        </a>
                      )}
                    </ShopNotice>
                  )}
                  <div className="vv-shop-checkout-details">
                    <h2>{text("Lieferart")}</h2>
                    {chosenFulfillment()}
                    {(!profile || needsContactName) && (
                      <>
                        <h2>{profile ? text("Name") : text("Kontakt")}</h2>
                        <>
                          <div className="sv-shop-form-row">
                            {(
                              [
                                ["first_name", text("Vorname"), "given-name"],
                                ["last_name", text("Nachname"), "family-name"],
                              ] as const
                            )
                              .filter(([key]) => !profile?.[key])
                              .map(([key, label, autocomplete]) => (
                                <Field
                                  key={key}
                                  name={key}
                                  label={label}
                                  autoComplete={autocomplete}
                                  value={draft.contact[key]}
                                  onChange={(value) =>
                                    setDraft({
                                      ...draft,
                                      contact: {
                                        ...draft.contact,
                                        [key]: value,
                                      },
                                    })
                                  }
                                  error={errors[key]}
                                  required
                                />
                              ))}
                          </div>
                          {!profile && (
                            <>
                              <Field
                                name="email"
                                label="E-Mail-Adresse"
                                type="email"
                                autoComplete="email"
                                value={draft.contact.email}
                                onChange={(email) =>
                                  setDraft({
                                    ...draft,
                                    contact: { ...draft.contact, email },
                                  })
                                }
                                error={errors.email}
                                required
                              />
                              <Field
                                name="phone"
                                label={text("Telefon (optional)")}
                                type="tel"
                                autoComplete="tel"
                                value={draft.contact.phone || ""}
                                onChange={(phone) =>
                                  setDraft({
                                    ...draft,
                                    contact: { ...draft.contact, phone },
                                  })
                                }
                              />
                            </>
                          )}
                        </>
                      </>
                    )}
                    {pickup && (
                      <>
                        <h2>{text("Abholung im Geschäft")}</h2>
                        <div className="vv-shop-store-card">
                          <img
                            src={shopImages.laden}
                            alt={text("Unser Geschäft")}
                          />
                          <div>
                            <strong>{text("Unser Geschäft")}</strong>
                            <p>{pickupAddress(selectedOption || undefined)}</p>
                            <p>
                              {OPENING_HOURS.map((line, index) => (
                                <span key={line}>
                                  {index > 0 && <br />}
                                  {line}
                                </span>
                              ))}
                            </p>
                          </div>
                        </div>
                        <p>{pickupTerms(settings)}</p>
                      </>
                    )}
                    {needsAddress && (
                      <>
                        <h2>{text("Lieferadresse")}</h2>
                        {addressChoicesReady && (
                          <fieldset
                            id="address_choice"
                            className="sv-shop-facet"
                            aria-describedby={
                              errors.address_choice
                                ? "address_choice-error"
                                : undefined
                            }
                          >
                            <legend>{text("Adresse auswählen")}</legend>
                            {[
                              ...savedAddresses.map((address) => ({
                                id: address.id,
                                address,
                              })),
                              ...(accountAddress && !accountAddressIsSaved
                                ? [{ id: "account", address: accountAddress }]
                                : []),
                            ].map(({ id, address }) => (
                              <label className="sv-shop-radio" key={id}>
                                <input
                                  type="radio"
                                  name="address_choice"
                                  checked={draft.addressChoice === id}
                                  disabled={!deliversToCountry(address.country)}
                                  onChange={() => chooseAddress(id)}
                                />
                                <CheckoutIcon kind="address" />
                                <span>
                                  {address.name}, {address.address1},{" "}
                                  {address.postal_code} {address.city}
                                  {!deliversToCountry(address.country) && (
                                    <small>
                                      {text(
                                        "Wir liefern nur innerhalb Deutschlands",
                                      )}
                                    </small>
                                  )}
                                </span>
                              </label>
                            ))}
                            <label className="sv-shop-radio">
                              <input
                                type="radio"
                                name="address_choice"
                                checked={draft.addressChoice === "new"}
                                onChange={() => chooseAddress("new")}
                              />
                              <span>{text("Neue Adresse eingeben")}</span>
                            </label>
                            {errors.address_choice && (
                              <p id="address_choice-error" role="alert">
                                {errors.address_choice}
                              </p>
                            )}
                          </fieldset>
                        )}
                        {(!addressChoicesReady ||
                          draft.addressChoice === "new") && (
                          <>
                            {(
                              [
                                [
                                  "address1",
                                  text("Straße und Hausnummer"),
                                  "address-line1",
                                ],
                                [
                                  "address2",
                                  text("Adresszusatz (optional)"),
                                  "address-line2",
                                ],
                                [
                                  "postal_code",
                                  text("Postleitzahl"),
                                  "postal-code",
                                ],
                                ["city", text("Ort"), "address-level2"],
                              ] as const
                            ).map(([key, label, autocomplete]) => (
                              <Field
                                key={key}
                                name={key}
                                label={label}
                                autoComplete={autocomplete}
                                value={draft.address[key] || ""}
                                onChange={(value) => {
                                  setDraft({
                                    ...draft,
                                    address: { ...draft.address, [key]: value },
                                  });
                                  setErrors(
                                    Object.fromEntries(
                                      Object.entries(errors).filter(
                                        ([field]) => field !== key,
                                      ),
                                    ),
                                  );
                                  setCheckoutError("");
                                }}
                                error={errors[key]}
                                required={key !== "address2"}
                              />
                            ))}
                          </>
                        )}
                        {(!addressChoicesReady ||
                          draft.addressChoice === "new") && (
                          <p>{text("Lieferland: Deutschland")}</p>
                        )}
                      </>
                    )}
                    {(!profile ||
                      needsContactName ||
                      (needsAddress &&
                        (!addressChoicesReady ||
                          draft.addressChoice === "new"))) && (
                      <p className="sv-shop-meta">
                        {text(
                          "* Pflichtfeld. Wir verwenden Deine Daten für Deine Bestellung. ",
                        )}
                        <a href={resolveHref("/datenschutz")}>
                          {text("Datenschutz")}
                        </a>
                      </p>
                    )}
                  </div>
                  {summary(
                    <div className="vv-shop-checkout-confirmation">
                      <section className="sv-shop-legal">
                        {!profile?.newsletter_consent &&
                          !profile?.newsletter_requested_at && (
                            <div>
                              <label htmlFor="newsletter-opt-in">
                                <input
                                  id="newsletter-opt-in"
                                  type="checkbox"
                                  aria-describedby="newsletter-opt-in-description"
                                  checked={newsletterOptIn}
                                  onChange={(e) =>
                                    setNewsletterOptIn(e.target.checked)
                                  }
                                />
                                <span>{newsletterOptInLabel}</span>
                              </label>
                              <p
                                id="newsletter-opt-in-description"
                                className="sv-shop-meta"
                              >
                                <span>
                                  {profile
                                    ? text(
                                        "Du bekommst nach der Bestellung eine separate Bestätigungs-E-Mail an {0}. Bitte bestätige Deine Anmeldung über den Link darin. Abmeldung jederzeit im Konto oder über den Link in jeder Mail. ",
                                        profile.email,
                                      )
                                    : text(
                                        "Du bekommst nach der Bestellung eine Bestätigungs-E-Mail (Double-Opt-in). Abmeldung jederzeit über den Link in jeder Mail. ",
                                      )}
                                  <a
                                    href={resolveHref("/datenschutz")}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {text("Datenschutz")}
                                  </a>
                                </span>
                              </p>
                            </div>
                          )}
                        <label htmlFor="terms">
                          <input
                            id="terms"
                            type="checkbox"
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                            aria-invalid={!!errors.terms}
                            aria-describedby={
                              errors.terms ? "terms-error" : undefined
                            }
                          />
                          <span>
                            {text("Ich akzeptiere die")}{" "}
                            <a
                              href={resolveHref("/agb")}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {text("AGB")}
                            </a>{" "}
                            {text("und habe die")}{" "}
                            <a
                              href={resolveHref("/widerruf")}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {text("Widerrufsbelehrung")}
                            </a>{" "}
                            {text("zur Kenntnis genommen.")}
                          </span>
                        </label>
                        {errors.terms && (
                          <p id="terms-error" role="alert">
                            {errors.terms}
                          </p>
                        )}
                      </section>
                      <div id="security">
                        {!session.loading &&
                          !session.profile &&
                          (settings?.turnstile_site_key ? (
                            <Turnstile
                              key={securityRevision}
                              siteKey={settings.turnstile_site_key}
                              onToken={setSecurityToken}
                            />
                          ) : (
                            <ShopNotice error>
                              {text(
                                "Die Sicherheitsprüfung ist noch nicht eingerichtet. Bitte kontaktiere uns vor Deiner Bestellung.",
                              )}
                            </ShopNotice>
                          ))}
                        {errors.security && (
                          <p role="alert">{errors.security}</p>
                        )}
                      </div>

                      <div className="vv-shop-final-order">
                        <ShopButton
                          type="submit"
                          disabled={
                            shopPaused() ||
                            !quoteReady ||
                            posting ||
                            session.loading ||
                            (!!profile &&
                              needsAddress &&
                              addressState === "loading") ||
                            settings?.shop_checkout_review_required !== true
                          }
                        >
                          {posting
                            ? text("Bestellung wird aufgegeben …")
                            : text("Zahlungspflichtig bestellen")}
                        </ShopButton>
                        <p className="sv-shop-meta">
                          {text(
                            "Du bezahlst im nächsten Schritt auf der sicheren Seite von Stripe. Zahlungsarten:",
                          )}{" "}
                          {shopPaymentMethods.join(", ")}.
                        </p>
                        {profile && (
                          <p className="sv-shop-meta vv-shop-confirmation-email">
                            {text("Die Bestätigung geht an ")}
                            {checkoutContact.email}.
                          </p>
                        )}
                      </div>
                    </div>,
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </>
    );
  } else if (route.path === "/warenkorb")
    content = (
      <>
        {!cart.items.length && (
          <h1 className="vv-shop-cart-heading">
            {text("Dein ")}
            <em>{text("Warenkorb")}</em>
          </h1>
        )}
        {!cart.items.length ? (
          <ShopEmpty
            title={text("Noch nichts im Korb.")}
            action={
              <LinkButton href="/shop">{text("Im Shop stöbern")}</LinkButton>
            }
          >
            {text(
              "Eine Entdeckung oder ein Geschenk: Such Dir etwas Schönes aus.",
            )}
          </ShopEmpty>
        ) : (
          <div className="sv-shop-cart-layout">
            <div>
              <h1 className="vv-shop-cart-heading">
                {text("Dein ")}
                <em>{text("Warenkorb")}</em>
              </h1>
              {cartLines()}
              <h2 className="vv-shop-voucher-heading">{text("Gutschein")}</h2>
              {voucher()}
            </div>
            {summary(
              <ShopButton
                disabled={!quoteReady || shopPaused()}
                onClick={() => navigate("/kasse")}
              >
                {text("Zur Kasse")}
              </ShopButton>,
            )}
          </div>
        )}
      </>
    );
  else if (route.path === "/versand")
    content = (
      <>
        <h1>{text("Versand und Abholung")}</h1>
        <ShippingPage {...deliveryInfo} />
      </>
    );
  else if (catalogState === "error")
    content = (
      <ShopEmpty
        title={text("Der Shop lädt gerade nicht.")}
        action={
          <ShopButton onClick={() => setReload((n) => n + 1)}>
            {text("Erneut laden")}
          </ShopButton>
        }
      >
        {text("Versuch es in ein paar Minuten noch einmal oder ruf uns an:")}{" "}
        <a href={phoneHref}>{phoneLabel}</a>
        {text(". Dein Warenkorb bleibt erhalten.")}
      </ShopEmpty>
    );
  else if (slug) {
    const p = models.find((p) => p.slug === slug && p.category === category);
    content = p ? (
      <ProductPage
        paused={shopPaused()}
        key={p.id}
        product={p}
        onAdd={add}
        {...deliveryInfo}
        nutrition={nutritionRows(
          articles.find((a) => a.id === p.id)?.attributes?.nutrition,
        )}
        sealed={
          settings?.sealed_goods_exclusion_enabled === true &&
          articles.find((a) => a.id === p.id)
            ?.withdrawal_lapses_when_unsealed === true
        }
      />
    ) : catalogState === "loading" ? (
      <Skeleton />
    ) : (
      <ShopEmpty
        title={text("Dieser Artikel ist gerade nicht online.")}
        action={<LinkButton href="/shop">{text("Zum Sortiment")}</LinkButton>}
      >
        {checkoutError ||
          text("Schau Dich im Sortiment um oder frag uns im Laden.")}
      </ShopEmpty>
    );
  } else if (category && category !== "suche")
    content = (
      <Catalogue
        products={models.filter((p) => p.category === category)}
        articles={articles}
        category={category}
        query={route.query}
        onQuery={changeQuery}
        onFilter={() => setFilterSheet(true)}
        card={card}
        loading={catalogState === "loading"}
      />
    );
  else if (category === "suche") {
    const term = route.query.get("q") || "";
    const result = models.filter((p) =>
      [p.title, p.producer, p.subtitle, p.description]
        .join(" ")
        .toLowerCase()
        .includes(term.toLowerCase()),
    );
    content = (
      <>
        <h1>„{term}“</h1>
        <p>
          {result.length} {text(" Treffer im Sortiment.")}
        </p>
        {catalogState === "loading" ? (
          <Skeleton />
        ) : result.length ? (
          <ShopProductGrid>{result.map(card)}</ShopProductGrid>
        ) : (
          <ShopEmpty
            title={text("Dazu haben wir online nichts.")}
            action={
              <LinkButton href="/shop">{text("Alle Artikel")}</LinkButton>
            }
          >
            {text("Vielleicht im Laden. Ruf uns an oder schau vorbei.")}
          </ShopEmpty>
        )}
      </>
    );
  } else
    content = (
      <>
        <ShopHero
          eyebrow={text(
            "Shop · {0}",
            visibleSections.map((section) => section.label).join(" & "),
          )}
          title={
            <>
              {text("Aus unserem Laden. ")}
              <em>{text("Zu Dir.")}</em>
            </>
          }
          description={visibleSections
            .map((section) => `${section.label}: ${section.description}`)
            .join(". ")}
          image={shopImages.regal}
          imageAlt={text("Unser Sortiment")}
          note={
            physicalSectionsEnabled && (
              <>
                <strong>{text("Click & Collect:")}</strong>
                {text(" Wir schreiben Dir, sobald alles abholbereit ist.")}
              </>
            )
          }
          actions={
            <>
              {visibleSections.slice(0, 2).map((section, index) => (
                <LinkButton
                  key={section.key}
                  href={`/shop/${section.key}`}
                  secondary={index > 0}
                >
                  {section.label} {text(" entdecken →")}
                </LinkButton>
              ))}
            </>
          }
        />
        {physicalSectionsEnabled && (
          <div className="sv-shop-services">
            <div>
              <strong>{text("Versand in ganz Deutschland")}</strong>
              <span>{shippingTerms(shippingOption)}</span>
            </div>
            <div>
              <strong>
                {text("Click & Collect")}{" "}
                {pickupOption ? formatPrice(pickupOption.price) : ""}
              </strong>
              <span>{pickupAddress(pickupOption)}</span>
            </div>
            {ageNotice && (
              <div>
                <strong>{ageNotice.title}</strong>
                <span>{ageNotice.description}</span>
              </div>
            )}
          </div>
        )}
        <ShopSection title={text("Sortiment")}>
          <ul className="sv-shop-categories">
            {visibleSections.map((s) => (
              <li key={s.key}>
                <a
                  href={resolveHref(`/shop/${s.key}`)}
                  className="sv-shop-category"
                >
                  <img
                    src={shopImages[s.image as keyof typeof shopImages]}
                    alt=""
                  />
                  <div>
                    <span>
                      {models.filter((p) => p.category === s.key).length}
                      {text(" online")}
                    </span>
                    <h3>{s.label}</h3>
                    <span>{s.description}</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </ShopSection>
        {models.some((p) =>
          p.badges?.includes(text("Bei Veranstaltungen")),
        ) && (
          <ShopSection
            title={
              <>
                {text("Aus unseren ")}
                <em>{text("Veranstaltungen")}</em>
              </>
            }
            link={
              bookingEnabled() ? (
                <a href={resolveHref("/termine")}>
                  {text("Veranstaltungstermine")}
                </a>
              ) : undefined
            }
          >
            {catalogState === "loading" ? (
              <Skeleton />
            ) : (
              <ShopProductGrid rail>
                {models
                  .filter((p) =>
                    p.badges?.includes(text("Bei Veranstaltungen")),
                  )
                  .slice(0, 5)
                  .map(card)}
              </ShopProductGrid>
            )}
          </ShopSection>
        )}
        <ShopSection
          title={
            <>
              {text("Gerade ")}
              <em>{text("empfohlen")}</em>
            </>
          }
          link={
            recommendedSection ? (
              <a href={resolveHref(`/shop/${recommendedSection.key}`)}>
                {recommendationLinkLabel || recommendedSection.label}
              </a>
            ) : undefined
          }
        >
          <ShopProductGrid rail>
            {models
              .filter(
                (p) =>
                  !p.unavailable &&
                  (!recommendedSection ||
                    p.category === recommendedSection.key),
              )
              .slice(0, 5)
              .map(card)}
          </ShopProductGrid>
        </ShopSection>
        {physicalSectionsEnabled && <ShippingPage compact {...deliveryInfo} />}
      </>
    );
  return (
    <div
      className={
        isCheckout
          ? "vv-shop-checkout-surface"
          : route.path === "/warenkorb"
            ? "vv-shop-cart-surface"
            : undefined
      }
    >
      <ShopSurface>
        {!isCheckout &&
          (shopSectionEnabled("suche") ? (
            <ShopNavigation
              label={text("Shop")}
              links={[
                {
                  label: text("Übersicht"),
                  href: resolveHref("/shop"),
                  current: route.path === "/shop",
                },
                ...visibleSections.map((s) => ({
                  label: s.label,
                  href: resolveHref(`/shop/${s.key}`),
                  current: category === s.key,
                })),
              ]}
              searchLabel={text("Im Shop suchen")}
              searchPlaceholder={text("Produkte und Gutscheine suchen")}
              searchAction={resolveHref("/shop/suche")}
              query={route.query.get("q") || ""}
            />
          ) : (
            <nav
              aria-label={text("Shop")}
              className="vv-shop-section-navigation"
            >
              <a href={resolveHref("/shop")}>{text("Übersicht")}</a>
              {visibleSections.map((section) => (
                <a key={section.key} href={resolveHref(`/shop/${section.key}`)}>
                  {section.label}
                </a>
              ))}
            </nav>
          ))}
        <div className="sv-shop-page">
          {shopPaused() && (
            <ShopNotice>
              <strong>{text("Der Online-Shop macht gerade Pause.")}</strong>
              {text(
                " Stöbern geht weiterhin. Im Laden sind wir wie gewohnt für Dich da.",
              )}
            </ShopNotice>
          )}
          {isCheckout &&
            !isSuccess &&
            settings &&
            settings.shop_checkout_review_required !== true && (
              <ShopNotice error>
                {text(
                  "Die Bestellprüfung ist noch nicht eingerichtet. Bitte kontaktiere uns vor Deiner Bestellung.",
                )}
              </ShopNotice>
            )}
          {content}
          {isGiftCatalogue && businessGiftSection}
        </div>
        {!drawer && (
          <span className="sv-shop-sr" role="status">
            {announcement}
          </span>
        )}
        {drawer && (
          <ShopDialog
            title={text("Dein Warenkorb")}
            closeLabel={text("Warenkorb schließen")}
            onClose={() => setDrawer(false)}
          >
            <p role="status">{announcement}</p>
            {cartLines()}
            {drawerSummary(
              <>
                <LinkButton href="/warenkorb">
                  {text("Zum Warenkorb")}
                </LinkButton>
                <ShopButton
                  className="is-secondary"
                  onClick={() => setDrawer(false)}
                >
                  {text("Weiter stöbern")}
                </ShopButton>
              </>,
            )}
          </ShopDialog>
        )}
        {filterSheet && (
          <MobileFilters
            articles={articles.filter((a) => categoryKey(a) === category)}
            query={route.query}
            onClose={() => setFilterSheet(false)}
            onApply={(query) => {
              setRoute({ ...route, query });
              window.history.replaceState(
                null,
                "",
                resolveHref(`${route.path}${query.size ? `?${query}` : ""}`),
              );
            }}
          />
        )}
      </ShopSurface>
    </div>
  );
}
function VoucherField({
  cart,
  onChange,
  quote,
}: {
  cart: ShopCart;
  onChange: (cart: ShopCart) => void;
  quote?: Quote;
}) {
  const { text } = useShopFlow();

  const [code, setCode] = useState("");
  return (
    <>
      <form
        className="sv-shop-voucher"
        onSubmit={(e) => {
          e.preventDefault();
          const value = code.trim();
          if (
            value &&
            !cart.voucher_codes.includes(value) &&
            cart.voucher_codes.length < 10
          ) {
            onChange({
              ...cart,
              voucher_codes: [...cart.voucher_codes, value],
            });
            setCode("");
          }
        }}
      >
        <Field
          name="voucher-code"
          label={text("Gutscheincode")}
          value={code}
          onChange={setCode}
        />
        <ShopButton
          type="submit"
          className="is-secondary"
          disabled={!code.trim() || cart.voucher_codes.length >= 10}
        >
          {text("Einlösen")}
        </ShopButton>
      </form>
      {cart.voucher_codes.map((code) => {
        const discount = quote?.vouchers_discounts?.find(
          (v) => v.code === code,
        );
        return (
          <div key={code}>
            <span>
              {code}:{" "}
              {discount?.is_valid
                ? text("{0} eingelöst", formatPrice(discount.discount_amount))
                : discount?.reason || text("Wird geprüft")}
            </span>
            <button
              type="button"
              className="vv-shop-remove"
              onClick={() =>
                onChange({
                  ...cart,
                  voucher_codes: cart.voucher_codes.filter((c) => c !== code),
                })
              }
              aria-label={text("Gutschein {0} entfernen", code)}
            >
              {text("Entfernen")}
            </button>
          </div>
        );
      })}
    </>
  );
}
function Filters({
  articles,
  query,
  onQuery,
}: {
  articles: Article[];
  query: URLSearchParams;
  onQuery: (key: string, value: string) => void;
}) {
  const { text, filterArticles, sections, categoryKey } = useShopFlow();
  const section = sections.find((s) =>
    articles.some((a) => categoryKey(a) === s.key),
  );

  const group = (
    key: string,
    label: string,
    values: { value: string; label: string }[],
    open = false,
  ) => (
    <details
      className="vv-shop-facet-group"
      key={key}
      open={open || !!query.get(key)}
    >
      <summary>{label}</summary>
      <fieldset className="sv-shop-facet">
        <legend className="sv-shop-sr">{label}</legend>
        {values.map(({ value, label }) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={(query.get(key) || "").split(",").includes(value)}
              onChange={(e) => {
                const selected = (query.get(key) || "")
                  .split(",")
                  .filter(Boolean);
                onQuery(
                  key,
                  (e.target.checked
                    ? [...selected, value]
                    : selected.filter((v) => v !== value)
                  ).join(","),
                );
              }}
            />
            <span>{label}</span>
            <small>
              {
                filterArticles(
                  articles,
                  new URLSearchParams({
                    ...Object.fromEntries(query),
                    [key]: value,
                  }),
                ).length
              }
            </small>
          </label>
        ))}
      </fieldset>
    </details>
  );
  const originGroups = (
    [
      ["land", text("Land"), "country"],
      ["region", text("Region"), "region"],
    ] as const
  ).map(([key, label, attribute], order) => {
    const values = [
      ...new Set(
        articles.flatMap((article) => {
          const value = article.attributes?.[attribute];
          return value ? [value] : [];
        }),
      ),
    ].sort();
    return {
      order,
      node: values.length
        ? group(
            key,
            label,
            values.map((value) => ({ value, label: value })),
            key === "land",
          )
        : null,
    };
  });
  const hostGroups = (section?.filterGroups ?? [])
    .filter((filter) => filter.visible?.(articles) !== false)
    .map((filter) => {
      const options =
        filter.options ??
        [
          ...new Set(
            articles.flatMap((article) => {
              const value = article.attributes?.[filter.attribute];
              return (
                Array.isArray(value) ? value : value == null ? [] : [value]
              ).map(String);
            }),
          ),
        ]
          .sort()
          .map((value) => ({ value, label: value }));
      return {
        order: filter.order ?? 2,
        node: options.length
          ? group(
              filter.queryKey,
              text(filter.label ?? filter.queryKey),
              options.map((option) => ({
                ...option,
                label: text(option.label),
              })),
              filter.open,
            )
          : null,
      };
    });
  const priceGroup = (
    <details key="preis" className="vv-shop-facet-group" open>
      <summary>{text("Preis")}</summary>
      <div className="sv-shop-chips">
        {[
          ["bis-15", "bis 15 €"],
          ["15-30", "15 bis 30 €"],
          ["30-60", "30 bis 60 €"],
          ["ab-60", text("über 60 €")],
        ].map(([value, label]) => (
          <button
            type="button"
            className="sv-shop-chip"
            key={value}
            aria-pressed={query.get("preis") === value}
            onClick={() =>
              onQuery("preis", query.get("preis") === value ? "" : value)
            }
          >
            {text(label)}
          </button>
        ))}
      </div>
    </details>
  );
  return (
    <>
      {[
        ...originGroups,
        ...hostGroups,
        { order: 3, node: priceGroup },
        {
          order: 5,
          node: group(
            "bio",
            text("Bio"),
            [{ value: "1", label: text("Bio-zertifiziert") }],
            true,
          ),
        },
        {
          order: 6,
          node: group("tasting", text("Aus unseren Veranstaltungen"), [
            { value: "1", label: text("Bei Veranstaltungen") },
          ]),
        },
        {
          order: 7,
          node: group("sofort", text("Verfügbarkeit"), [
            { value: "1", label: text("Sofort verfügbar") },
          ]),
        },
      ]
        .sort((a, b) => a.order - b.order)
        .map((group) => group.node)}
    </>
  );
}
function MobileFilters({
  articles,
  query,
  onApply,
  onClose,
}: {
  articles: Article[];
  query: URLSearchParams;
  onApply: (query: URLSearchParams) => void;
  onClose: () => void;
}) {
  const { text, filterArticles } = useShopFlow();

  const [draft, setDraft] = useState(() => new URLSearchParams(query));
  const count = filterArticles(articles, draft).length;
  return (
    <ShopDialog
      title={text("Filter")}
      closeLabel={text("Filter schließen")}
      variant="sheet"
      onClose={onClose}
    >
      <Filters
        articles={articles}
        query={draft}
        onQuery={(key, value) =>
          setDraft((current) => {
            const next = new URLSearchParams(current);
            if (value) next.set(key, value);
            else next.delete(key);
            next.delete("seite");
            return next;
          })
        }
      />
      <div className="sv-shop-actions">
        <ShopButton
          className="is-secondary"
          onClick={() => setDraft(new URLSearchParams())}
        >
          {text("Zurücksetzen")}
        </ShopButton>
        <ShopButton
          disabled={!count}
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          {count} {text(" Artikel anzeigen")}
        </ShopButton>
      </div>
    </ShopDialog>
  );
}
function Catalogue({
  products,
  articles,
  category,
  query,
  onQuery,
  onFilter,
  card,
  loading,
}: {
  products: ShopProduct[];
  articles: Article[];
  category: string;
  query: URLSearchParams;
  onQuery: (key: string, value: string) => void;
  onFilter: () => void;
  card: (p: ShopProduct) => ReactNode;
  loading: boolean;
}) {
  const {
    categoryKey,
    sections,
    resolveHref,
    text,
    isGiftBasket,
    filterArticles,
  } = useShopFlow();

  const section = sections.find((s) => s.key === category);
  const chips = section?.filterChips;
  const base = articles.filter((a) => categoryKey(a) === category);
  const matches = new Set(filterArticles(base, query).map((a) => a.id));
  const matching = products.filter((p) => matches.has(p.id));
  const sorted = [...matching].sort((a, b) =>
    query.get("sort") === "preis-auf"
      ? a.price - b.price
      : query.get("sort") === "preis-ab"
        ? b.price - a.price
        : query.get("sort") === "name"
          ? a.title.localeCompare(b.title)
          : 0,
  );
  const page = Math.max(1, Number.parseInt(query.get("seite") || "1", 10) || 1);
  const shown = sorted.slice(0, page * 12);
  return (
    <>
      <div className="sv-shop-crumbs">
        <a href={resolveHref("/shop")}>{text("Shop")}</a>
        <span>/</span>
        <span>{section?.label}</span>
      </div>
      <header className="sv-shop-list-head">
        <h1>{section?.label}</h1>
        <p className="sv-shop-lead">{section?.description}</p>
      </header>
      {isGiftBasket(category) && (
        <ShopNotice>
          {products.length > 0 &&
            `${products
              .map(
                (p) =>
                  `${p.title}: ${p.customerDefinedPrice ? "ab " : ""}${formatPrice(p.minimumPrice || p.price)}`,
              )
              .join(" · ")}. `}
          {text("Wir packen jeden Korb für Dich von Hand.")}
        </ShopNotice>
      )}
      <div
        className={`sv-shop-list-layout ${category === "gutscheine" ? "vv-shop-no-filters" : ""}`}
      >
        {category !== "gutscheine" && (
          <aside className="sv-shop-facets" aria-label={text("Filter")}>
            <Filters
              articles={articles.filter((a) => categoryKey(a) === category)}
              query={query}
              onQuery={onQuery}
            />
            <a href={resolveHref(`/shop/${category}`)}>
              {text("Alle Filter zurücksetzen")}
            </a>
          </aside>
        )}
        <div>
          {chips && (
            <div className="sv-shop-chips">
              {(chips.options ?? []).map(({ value, label }) => (
                <button
                  type="button"
                  className="sv-shop-chip"
                  key={value}
                  aria-pressed={(query.get(chips.queryKey) || "") === value}
                  onClick={() => onQuery(chips.queryKey, value)}
                >
                  {text(label)}
                </button>
              ))}
            </div>
          )}
          <div className="sv-shop-toolbar">
            <span role="status">
              {sorted.length} {text(" Artikel")}
            </span>
            {category !== "gutscheine" && (
              <ShopButton
                className="is-secondary sv-shop-mobile-filter"
                onClick={onFilter}
              >
                {text("Filter")}
              </ShopButton>
            )}
            <select
              aria-label={text("Sortieren")}
              value={query.get("sort") || "empfehlung"}
              onChange={(e) => onQuery("sort", e.target.value)}
            >
              <option value="empfehlung">{text("Empfehlung")}</option>
              <option value="preis-auf">{text("Preis aufsteigend")}</option>
              <option value="preis-ab">{text("Preis absteigend")}</option>
              <option value="name">{text("Name A bis Z")}</option>
            </select>
          </div>
          <div className="sv-shop-chips">
            {[
              ...new Set([
                ...filterKeys,
                ...(section?.filterGroups?.map((group) => group.queryKey) ??
                  []),
                ...(section?.filterChips ? [section.filterChips.queryKey] : []),
              ]),
            ]
              .filter((key) => query.get(key))
              .flatMap((key) =>
                (query.get(key) || "").split(",").map((value) => (
                  <button
                    type="button"
                    className="sv-shop-chip"
                    key={`${key}:${value}`}
                    onClick={() =>
                      onQuery(
                        key,
                        (query.get(key) || "")
                          .split(",")
                          .filter((v) => v !== value)
                          .join(","),
                      )
                    }
                    aria-label={text("Filter {0} entfernen", value)}
                  >
                    {["bio", "tasting", "sofort"].includes(key)
                      ? {
                          bio: text("Bio"),
                          tasting: text("Bei Veranstaltungen"),
                          sofort: text("Verfügbar"),
                        }[key as "bio" | "tasting" | "sofort"]
                      : value}{" "}
                    ×
                  </button>
                )),
              )}
          </div>{" "}
          {loading ? (
            <Skeleton />
          ) : !sorted.length ? (
            <ShopEmpty
              title={
                products.length
                  ? text("Keine Artikel für diese Auswahl.")
                  : text("Hier ist gerade nichts online.")
              }
              action={
                <LinkButton href={`/shop/${category}`}>
                  {text("Alle Filter zurücksetzen")}
                </LinkButton>
              }
            >
              {text(
                "Schau später wieder vorbei oder setze Deine Filter zurück.",
              )}
            </ShopEmpty>
          ) : (
            <>
              <ShopProductGrid>{shown.map(card)}</ShopProductGrid>
              {shown.length < sorted.length && (
                <div className="vv-shop-more">
                  <span>
                    {shown.length} {text(" von ")}
                    {sorted.length} {text(" Artikeln")}
                  </span>
                  <progress
                    value={shown.length}
                    max={sorted.length}
                    aria-label={text("Angezeigte Artikel")}
                  />
                  <ShopButton
                    className="is-secondary"
                    onClick={() => onQuery("seite", String(page + 1))}
                  >
                    {text("Weitere ")}
                    {Math.min(12, sorted.length - shown.length)}{" "}
                    {text("anzeigen")}
                  </ShopButton>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
function ProductPage({
  sealed,
  paused,
  product: p,
  onAdd,
  shippingOption,
  pickupOption,
  nutrition,
}: {
  product: ShopProduct;
  sealed: boolean;
  paused: boolean;
  onAdd: (p: ShopProduct, quantity: number, extra: Partial<CartItem>) => void;
  shippingOption?: Fulfillment;
  pickupOption?: Fulfillment;
  settings?: Settings;
  nutrition: { label: string; value: string }[];
}) {
  const {
    sections,
    giftBasketDelivery,
    isGiftBasket,
    resolveHref,
    text,
    phoneHref,
    phoneLabel,
  } = useShopFlow();

  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState(p.variants?.[0]?.id || "");
  const [note, setNote] = useState("");
  const [value, setValue] = useState(String((p.minimumPrice ?? p.price) / 100));
  const selected = p.variants?.find((v) => v.id === variant);
  const custom = !!p.customerDefinedPrice;
  const amount = Math.round(Number(value.replace(",", ".")) * 100);
  const valid =
    !custom ||
    (Number.isSafeInteger(amount) &&
      /^\d+(?:[.,]\d{1,2})?$/.test(value) &&
      amount >= (p.minimumPrice ?? p.price) &&
      amount <= 10000000);
  return (
    <>
      <div className="sv-shop-crumbs">
        <a href={resolveHref("/shop")}>{text("Shop")}</a>
        <span>/</span>
        <a href={resolveHref(`/shop/${p.category}`)}>
          {sections.find((s) => s.key === p.category)?.label}
        </a>
      </div>
      <div className="sv-shop-product">
        <ShopMedia product={p} />
        <div className="sv-shop-product-info">
          <p className="sv-shop-eyebrow">{p.producer}</p>
          <h1>{p.title}</h1>
          <p className="sv-shop-lead">{p.subtitle}</p>
          <ShopPrice
            amount={custom && valid ? amount : (selected?.price ?? p.price)}
            formatPrice={formatPrice}
            unitPrice={selected ? selected.unitPrice : p.unitPrice}
            taxLabel={
              p.category === "gutscheine"
                ? undefined
                : isGiftBasket(p.category)
                  ? text("inkl. MwSt., Abholung oder Lieferung")
                  : p.pickupOnly
                    ? text("inkl. MwSt., Abholung")
                    : text("inkl. MwSt., zzgl.")
            }
            shippingLabel={
              p.category === "gutscheine" ||
              isGiftBasket(p.category) ||
              p.pickupOnly
                ? undefined
                : text("Versandkosten")
            }
            shippingHref={resolveHref("/versand")}
          />
          {p.availability && <p>{p.availability}</p>}
          {(p.variants?.length ?? 0) > 1 ? (
            <div className="sv-shop-field">
              <label htmlFor="variant">{text("Deine Auswahl")}</label>
              <select
                id="variant"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
              >
                {p.variants?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {!custom && ` · ${formatPrice(v.price)}`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {custom && (
            <Field
              name="basket-value"
              label={text(
                "Dein Wunschwert in Euro (ab {0})",
                formatPrice(p.minimumPrice ?? p.price),
              )}
              value={value}
              onChange={setValue}
              error={
                valid
                  ? undefined
                  : text(
                      "Bitte wähle einen Wert ab {0}.",
                      formatPrice(p.minimumPrice ?? p.price),
                    )
              }
            />
          )}{" "}
          {isGiftBasket(p.category) && (
            <div className="sv-shop-field">
              <label htmlFor="line-note">
                {text("Deine Wünsche / Grußkarte (optional)")}
              </label>
              <textarea
                id="line-note"
                value={note}
                maxLength={200}
                rows={3}
                onChange={(e) => setNote(e.target.value)}
              />
              <span className="sv-shop-meta">
                {note.length}
                {text("/200 Zeichen")}
              </span>
            </div>
          )}
          <div className="sv-shop-actions">
            <ShopQuantity
              value={quantity}
              onChange={setQuantity}
              label={text("Menge")}
              decreaseLabel={text("Weniger")}
              increaseLabel={text("Mehr")}
            />
            <ShopButton
              disabled={paused || p.unavailable || !valid}
              onClick={() =>
                onAdd(p, quantity, {
                  variant: variant || null,
                  line_note: note || null,
                  customer_price: custom ? amount : null,
                })
              }
            >
              {p.unavailable ? text("Ausverkauft") : text("In den Warenkorb")}
            </ShopButton>
          </div>
          <ShopNotice>
            {isGiftBasket(p.category)
              ? giftBasketDelivery
              : p.pickupOnly
                ? text(
                    "Kein Versand. Frische Ware ist nur zur Abholung erhältlich.",
                  )
                : p.category === "gutscheine"
                  ? text("Dein Gutschein kommt per E-Mail.")
                  : shippingOption
                    ? text(
                        "Versand mit DHL: {0}, innerhalb Deutschlands.",
                        shippingTerms(shippingOption),
                      )
                    : text(
                        "Versandkosten werden vor der Bestellung angezeigt.",
                      )}
            <br />
            {p.category !== "gutscheine" &&
              !isGiftBasket(p.category) &&
              pickupOption &&
              text(
                "Click & Collect: {0}, {1}.",
                formatPrice(pickupOption.price),
                pickupAddress(pickupOption),
              )}
          </ShopNotice>
          {sealed && (
            <p className="sv-shop-meta">
              {text(
                "Nach Entfernen der Versiegelung erlischt das Widerrufsrecht bei versiegelter Ware, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet ist.",
              )}
            </p>
          )}
          {p.withdrawalExcluded && (
            <p className="sv-shop-meta">
              {text(
                "Für schnell verderbliche frische Ware besteht kein Widerrufsrecht.",
              )}
            </p>
          )}
          {p.unavailable && (
            <p>
              {text("Frag uns im Laden:")} <a href={phoneHref}>{phoneLabel}</a>
            </p>
          )}
        </div>
      </div>
      {p.description && (
        <ShopSection title={text("Beschreibung")}>
          <p>{p.description.replace(/<[^>]*>/g, " ")}</p>
        </ShopSection>
      )}
      <ShopDeclarations
        title={text("Steckbrief")}
        rows={p.declarations || []}
      />
      {nutrition.length > 0 && (
        <ShopDeclarations
          title={text("Nährwerte je 100 g / ml")}
          rows={nutrition}
        />
      )}
    </>
  );
}
function ShippingPage({
  compact = false,
  shippingOption,
  pickupOption,
  settings,
}: {
  compact?: boolean;
  shippingOption?: Fulfillment;
  pickupOption?: Fulfillment;
  settings?: Settings;
}) {
  const {
    businessInformation,
    shopImages,
    shopPaymentMethods,
    giftBasketDelivery,
    ageNotice,
    resolveHref,
    text,
  } = useShopFlow();

  return (
    <>
      <ShopSection
        title={
          compact ? (
            <>
              {text("So kommt Dein Einkauf ")}
              <em>{text("zu Dir")}</em>
            </>
          ) : (
            text("Versand und Abholung")
          )
        }
        link={
          compact ? (
            <a href={resolveHref("/versand")}>{text("Versand und Abholung")}</a>
          ) : undefined
        }
      >
        <div className="sv-shop-how">
          <article>
            <img
              src={shopImages.lieferung}
              alt={text("Ware wird für den Versand vorbereitet")}
            />
            <div>
              <p className="sv-shop-eyebrow">{text("Versand")}</p>
              <h3>{text("Nach Hause, innerhalb Deutschlands")}</h3>
              <ul>
                {shippingOption && <li>{shippingTerms(shippingOption)}</li>}

                {ageNotice?.shippingNote && <li>{ageNotice.shippingNote}</li>}
                <li>{giftBasketDelivery}</li>
              </ul>
            </div>
          </article>
          <article>
            <img src={shopImages.laden} alt={text("Geschäft")} />
            <div>
              <p className="sv-shop-eyebrow">{text("Click & Collect")}</p>
              <h3>{pickupAddress(pickupOption) || text("Abholung")}</h3>
              <ul>
                {pickupOption && <li>{formatPrice(pickupOption.price)}</li>}
                <li>{text("Wir schreiben Dir, sobald alles bereitliegt")}</li>
                {pickupTerms(settings) && <li>{pickupTerms(settings)}</li>}
              </ul>
            </div>
          </article>
        </div>
      </ShopSection>
      <ShopSection title={text("Gut zu wissen")}>
        <p>{giftBasketDelivery}</p>
        <div className="sv-shop-info">
          <div>
            <h3>{text("Bezahlen")}</h3>
            <p>
              {text(
                "Du wirst nach Deiner Bestellung zur sicheren Zahlungsseite von Stripe weitergeleitet. Zahlungsarten:",
              )}{" "}
              {shopPaymentMethods.join(", ")}
              {text(". Gutscheine löst Du bereits an der Kasse ein. ")}
              <a href={resolveHref("/widerruf")}>
                {text("Widerrufsbelehrung")}
              </a>
            </p>
          </div>
          {businessInformation}
        </div>
      </ShopSection>
    </>
  );
}

/** Complete catalogue, cart, checkout and order-return flow. The host supplies routes, branding and optional editorial slots. */
export function ShopFlow({ initialPath = "/shop", ...config }: ShopFlowProps) {
  return (
    <ShopFlowProvider config={config}>
      <ShopFlowPage initialPath={initialPath} />
    </ShopFlowProvider>
  );
}
