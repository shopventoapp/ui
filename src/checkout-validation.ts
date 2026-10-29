import { deliversToCountry } from "./checkout-draft";
import type {
  CheckoutAddress,
  CheckoutContact,
  Fulfillment,
} from "./shop-model";
/** Values required to validate checkout contact, address and scheduled fulfilment. */
export interface CheckoutValidationInput {
  /** Authoritative account contact, or editable guest contact. */
  checkoutContact: CheckoutContact;
  /** Selected account address or editable guest address. */
  checkoutAddress: CheckoutAddress;
  /** Delivery or shipping requires a postal address. */
  needsAddress: boolean;
  /** Alcohol age-check restrictions apply. */
  adult: boolean;
  /** Carrier shipping is selected. */
  shipping: boolean;
  /** Cart contains physical goods. */
  physical: boolean;
  /** Customer-selected fulfilment identifier. */
  fulfillmentOptionId?: string | null;
  /** Latest server-offered fulfilment option. */
  selectedOption?: Fulfillment | null;
  /** Signature of the current server-offered dates. */
  dateKey: string;
  /** Signature recorded with the selected date. */
  dateKeyInDraft?: string;
  /** Customer-selected date. */
  fulfillmentDate?: string;
  /** Saved account addresses have loaded. */
  addressChoicesReady?: boolean;
  /** Saved address choice or new. */
  addressChoice?: string;
}
/** Validate a checkout step without submitting, calculating prices or consuming consent. */
export function validateCheckoutDetails(
  {
    checkoutContact,
    checkoutAddress,
    needsAddress,
    adult,
    shipping,
    physical,
    fulfillmentOptionId,
    selectedOption,
    dateKey,
    dateKeyInDraft,
    fulfillmentDate,
    addressChoicesReady,
    addressChoice,
  }: CheckoutValidationInput,
  text: (value: string) => string = (value) => value,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!checkoutContact.first_name.trim())
    result.first_name = text("Bitte gib Deinen Vornamen ein.");
  if (!checkoutContact.last_name.trim())
    result.last_name = text("Bitte gib Deinen Nachnamen ein.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checkoutContact.email))
    result.email = text("Bitte gib eine gültige E-Mail-Adresse ein.");
  if (needsAddress) {
    if (!deliversToCountry(checkoutAddress.country))
      result.address_choice = text("Wir liefern nur innerhalb Deutschlands");
    if (!checkoutAddress.address1.trim())
      result.address1 = text("Bitte gib Straße und Hausnummer ein.");
    if (
      /packstation|postfiliale|postfach/i.test(
        [checkoutAddress.address1, checkoutAddress.address2].join(" "),
      ) &&
      adult &&
      shipping
    )
      result.address1 = text(
        "Alkohol versenden wir nicht an Packstationen, Postfilialen oder Postfächer.",
      );
    if (!/^\d{5}$/.test(checkoutAddress.postal_code))
      result.postal_code = text(
        "Bitte gib eine fünfstellige deutsche Postleitzahl ein.",
      );
    if (!checkoutAddress.city.trim())
      result.city = text("Bitte gib Deinen Ort ein.");
  }
  if (physical && !fulfillmentOptionId)
    result.fulfillment = text("Bitte wähle Versand oder Abholung.");
  if (
    selectedOption?.schedule &&
    (dateKeyInDraft !== dateKey ||
      !selectedOption.eligible_dates?.includes(fulfillmentDate || ""))
  )
    result.fulfillment_date = text(
      "Bitte wähle einen Abhol- oder Liefertermin aus.",
    );
  if (addressChoicesReady && addressChoice !== "new") {
    const addressErrors = ["address1", "postal_code", "city"].filter(
      (key) => result[key],
    );
    if (addressErrors.length)
      result.address_choice = addressErrors.map((key) => result[key]).join(" ");
    addressErrors.forEach((key) => {
      delete result[key];
    });
  }
  return result;
}
