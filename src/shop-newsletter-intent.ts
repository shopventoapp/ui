/** Default session-storage key for token-free pending order recovery. */
export const pendingOrderKey = "sv-shop-pending-order-v1";

// Consume before sending so rerenders, retries and return-page reloads cannot repeat consent.
/** Consume an unexpired, order-bound and account-bound newsletter consent before sending an opt-in request. */
export function consumeNewsletterIntent(
  storage: Pick<Storage, "getItem" | "setItem">,
  orderId: string,
  accountId: number | null,
  key = pendingOrderKey,
) {
  try {
    const pending = JSON.parse(storage.getItem(key) || "null");
    if (
      pending?.id !== orderId ||
      !(pending.created > Date.now() - 86400000) ||
      !pending.newsletter ||
      pending.newsletter.accountId !== accountId
    )
      return false;
    delete pending.newsletter;
    storage.setItem(key, JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}
