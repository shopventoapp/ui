import type { AccountProfile } from "./account-client";
import type { CheckoutAddress, CheckoutContact } from "./shop-model";
/** Persisted checkout contact, address and fulfilment-date draft. */
export type Draft = {
  fulfillmentDate?: string;
  dateKey?: string;
  contact: CheckoutContact;
  address: CheckoutAddress;
  addressChoice?: string;
  accountId?: number;
  updated: number;
};
/** Create an empty checkout draft with a fresh timestamp. */
export const freshDraft = (): Draft => ({
  contact: { first_name: "", last_name: "", email: "", phone: "" },
  address: {
    name: "",
    address1: "",
    address2: "",
    postal_code: "",
    city: "",
    country: "DE",
  },
  updated: Date.now(),
});

/** Fill missing contact values from the account profile and clear private data when the account changes. */
export function prefillCheckoutDraft(
  draft: Draft,
  profile: AccountProfile | null,
): Draft {
  const current =
    draft.accountId != null && draft.accountId !== profile?.id
      ? {
          ...freshDraft(),
          fulfillmentDate: draft.fulfillmentDate,
          dateKey: draft.dateKey,
        }
      : draft;
  if (!profile) return current;
  return {
    ...current,
    accountId: profile.id,
    contact: {
      first_name: current.contact.first_name || profile.first_name || "",
      last_name: current.contact.last_name || profile.last_name || "",
      email: current.contact.email || profile.email || "",
      phone: current.contact.phone || profile.phone || "",
    },
  };
}
/** Accept Germany or an unspecified country for the supported domestic delivery flow. */
export function deliversToCountry(country?: string | null): boolean {
  return !country || country === "DE";
}
