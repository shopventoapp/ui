# Shop presentation primitives

The shop exports controlled React components for presentation. The host supplies product copy, labels, prices, legal content, actions and state. Import both stylesheets and define the theme tokens on `.sv-shop` or an ancestor outside any component scope.

> Complete cart and checkout UI flows are not in the package yet. `ShopQuantity`, `ShopSummary` and `ShopCheckoutSteps` are presentation primitives. The host implements cart persistence, checkout routing, validation and payment recovery.

<!-- example:examples/shop.tsx -->

## Components

- `ShopSurface`, `ShopNavigation`, `ShopHero` and `ShopSection` provide page structure.
- `ShopProductGrid`, `ShopProductCard`, `ShopMedia` and `ShopPrice` render host-mapped catalogue data. `ShopButton` exposes a styled standard button.
- `ShopQuantity`, `ShopDialog`, `ShopSummary` and `ShopCheckoutSteps` render controlled selection and summary surfaces.
- `ShopDeclarations`, `ShopNotice` and `ShopEmpty` display legal/product information and states.

Dialogs use the native modal element for focus containment, Escape dismissal and focus restoration. Product illustrations use the optional `--sv-product-fill` token.

## Client and prices

`createShopClient()` defaults to relative same-origin API paths and includes cookies. Use the [host API proxy](/guides/customer-account/) for catalogue, settings, cart quote, checkout session creation, order and payment confirmation. Its optional `baseUrl` changes the request prefix; it does not replace the host session contract. Abort signals are forwarded, and unsuccessful responses throw `ShopApiError`.

Amounts are integer cents. Use server quotes and checkout totals. Fulfillment responses include delivery zones, `price_is_from`, out-of-area hints and recurring closures. Send `shipping_postcode` when requesting an exact quote; checkout derives the charged delivery zone from the shipping address. A `ShopSummary` row with `isFrom: true` prefixes a minimum with `ab`.

Nutrition fields retain their units: `energy_kj`, `energy_kcal`, `fat_g`, `saturated_fat_g`, `carbohydrates_g`, `sugars_g`, `protein_g` and `salt_g`.

See the [component reference](/reference/) for props and the [Shop API reference](/api/) for the limited wire contract. No legal-content endpoint is called by the current clients; the host supplies legal content as props.
