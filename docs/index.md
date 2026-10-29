# Build your Shopvento storefront.

<div class="home-intro">React components and typed clients for event booking, vouchers, customer accounts and shop presentation. Keep your routes, your design and your customer relationship.</div>

<div class="home-meta">@shopvento/ui 0.2.0 · React 18.2 or 19 · ESM · TypeScript</div>

<div class="home-install">

```sh
bun add @shopvento/ui
```

</div>

Start with the [installation guide](/guides/getting-started/), or use the [Next.js App Router example](/guides/nextjs/) to connect a host application.

<div class="flow-links">
<a href="/guides/event-booking/"><strong>Event booking</strong><span>Availability, seats, guest consent and payment returns.</span></a>
<a href="/guides/vouchers/"><strong>Vouchers</strong><span>Lookup, seat allocation and customer voucher history.</span></a>
<a href="/guides/customer-account/"><strong>Customer account</strong><span>Sign-in, dashboard and the host session proxy.</span></a>
<a href="/guides/shop/"><strong>Shop primitives</strong><span>Product cards, prices, dialogs and summaries.</span></a>
</div>

## Make it yours

Set [CSS theme tokens](/guides/theming/) and pass [host-owned labels](/guides/labels/). The default component interface is German; these integration guides are English. Prices, capacity, voucher balances and booking eligibility remain authoritative in the backend.

> Complete cart and checkout UI flows are not in the package yet. The package includes presentation primitives and API clients for hosts building those flows.

## Look up a contract

The [component and type reference](/reference/) is generated from the public exports. The [Shop API reference](/api/) covers only operations called by the package. Read the API source note before relying on backend validation constraints.
