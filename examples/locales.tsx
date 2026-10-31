import {
  NewsletterSignup,
  ShopFlow,
  type ShopventoCatalogue,
  ShopventoProvider,
} from "@shopvento/ui";

const french = {
  shop: { "Dein Einkauf": "Vos achats" },
} satisfies ShopventoCatalogue;
/** Independent language scopes can be rendered concurrently. */
export function LocaleExamples() {
  return (
    <>
      <ShopventoProvider locale="en">
        <NewsletterSignup siteKey="PUBLIC-KEY" />
      </ShopventoProvider>
      <ShopventoProvider locale="fr" messages={french}>
        <ShopFlow labels={{ "Dein Einkauf": "Votre panier" }} />
      </ShopventoProvider>
      <ShopFlow locale="de" />
    </>
  );
}
