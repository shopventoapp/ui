# Catalogue, cart and checkout

`ShopFlow` owns catalogue/category/product views, persistent cart state, voucher entry, guest and account checkout, fulfilment dates, delivery-zone quotes, legal acceptance, hosted Stripe Checkout navigation and order returns. All 0.2 presentation primitives remain available. Import `styles.css` and `shop.css`; mount the flow inside the host layout and keep the same component configuration across its routes.

<!-- example:examples/shop-flow.tsx -->

## Host composition

The host supplies page routes, legal pages, branding, product presentation, feature switches, service details and editorial sections. `sections`, `categoryKey` and `productModel` adapt backend articles without putting host assets or brand logic in the package. `businessGiftSection` is an optional editorial slot below the gift catalogue; `businessInformation` supplies host business copy beside the payment information. `images`, `openingHours`, `giftDeliveryNote`, `paymentMethods`, `phoneHref` and `phoneLabel` carry host content. For a bespoke category mapping, supply both the classifier and product mapper so their slugs agree.

The default route shells are `/shop`, `/shop/:category`, `/shop/:category/:slug`, `/warenkorb`, `/kasse`, `/kasse/erfolg`, `/kasse/abgebrochen`, `/bestellung` and `/versand`. The host must serve these paths. Legacy checkout URLs `/kasse/lieferung`, `/kasse/zahlung` and `/kasse/pruefen` normalize to the current single checkout form. No Next.js or router dependency is included. `initialPath` seeds canonical server-rendered markup; the browser location becomes authoritative after hydration. Override `routes` for different roots, or supply `resolveHref` and `onNavigate` for host routing. When a client router reuses one component instance across pages, key `ShopFlow` by the canonical route so browser-location hydration runs for the new page. Account return URLs and the installation's Stripe success/cancel URLs must match the host configuration. A custom `resolveHref` can also adapt nested login return parameters.

`accountEnabled`, `eventsEnabled`, `paused`, `sectionEnabled`, `sectionPath` and `restrictSections` reflect host feature policy. Keep clients, callbacks, category definitions and configuration identities stable during a mounted transaction. `client`, `accountClient` and `dashboardClient` can be supplied; defaults use the same-origin [session proxy](/guides/customer-account/).

## Storage and upgrade safety

The defaults are `sv-shop-cart-v1` in localStorage, and `sv-shop-checkout-v1` plus `sv-shop-pending-order-v1` in sessionStorage. The cart event is `sv-shop-cart`. Supply **all four** `storage` names when adopting an existing integration. The original JSON shapes are retained; migration does not clear or rename customer carts or drafts. Checkout drafts and pending returns expire after 24 hours. Account changes clear the previous account's private contact and address data while preserving the fulfilment-date selection. Browser-storage failures leave the flow usable in memory.

`readShopCart`, `writeShopCart`, `emptyCart`, `mergeLine`, `lineKey`, `freshCheckoutDraft` and `prefillCheckoutDraft` are available to host navigation and migration adapters. `writeShopCart` accepts the storage key and event name explicitly. Never put Turnstile tokens, session credentials or guest order capabilities into persisted drafts.

## Authoritative quotes and checkout

Amounts are integer euro cents. `formatPrice` formats display values; the cart does not calculate its own payable total. Every cart or delivery postcode change obtains a fresh server quote. Customer price, variant, gift note and quantity identify distinct cart lines. `quoteContainsCart` rejects incomplete confirmations. Before ordering, the flow requotes the cart and asks for renewed acceptance when prices or fulfilment dates have changed.

`validateCheckoutDetails` checks contact, domestic address, five-digit postcodes, alcohol carrier restrictions, physical fulfilment selection and offered dates. Account checkout loads profile and saved addresses; guest checkout requires a live Turnstile token. Legal acceptance starts unchecked. Delivery zones and out-of-area errors come from the backend; send `shipping_postcode` for an exact zone quote. Minimum prices retain the `ab` prefix until the postcode selects a zone. Schedule signatures invalidate dates removed by a newer quote.

Hosted payment navigation accepts only HTTPS URLs on `checkout.stripe.com`. Mock checkout calls in tests; no payment is implied by a return URL. Zero-payment orders use the same verified order return.

## Payment return and order result

The return reads `order_id`, optional `session_id` and an in-memory guest `token`, removes capabilities from the address bar, optionally confirms the payment and loads the authoritative order. Pending orders are polled with a bounded retry count. Failed confirmation does not override a paid webhook result. The cart is cleared only for an associated successful payment return whose stored items still match the current cart. Viewing an unrelated order or returning to a pending payment preserves shopping state. The token-free pending marker supports reload recovery.

Newsletter consent is optional and separate from legal acceptance. `consumeNewsletterIntent` consumes only a matching, unexpired order/account intent before requesting double opt-in; rerenders and return-page reloads cannot repeat it. Supply `NewsletterComponent` to share host copy and public-API configuration with [standalone newsletter signup](/guides/newsletter/).

## Labels, theming and lower-level components

German message overrides use `labels`, keyed by the default message. `defaultShopFlowLabels` lists defaults; numbered `{0}` placeholders retain runtime values. See the [labels guide](/guides/labels/). Colours and typography use `--sv-*` tokens. Retained `vv-shop-*` structural class names support existing host styles and selectors; they carry no customer branding.

The controlled `ShopSurface`, `ShopNavigation`, `ShopHero`, `ShopSection`, product cards/media/prices, quantity, dialog, summary, checkout-step, declaration, notice and empty-state components continue to support independent compositions. Dialogs use native modal focus containment, Escape dismissal and focus restoration. Product illustrations accept `--sv-product-fill`.

<!-- example:examples/shop.tsx -->
