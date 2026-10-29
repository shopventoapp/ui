import { AccountApiError, type AccountClientOptions } from "./account-client";
import type { AccountOperations } from "./wire";
/** Public account order contract used by the storefront clients. */
export type AccountOrder = AccountOperations["orders"]["response"][number];
/** Public account booking contract used by the storefront clients. */
export type AccountBooking = AccountOperations["bookings"]["response"][number];
/** Public account reservation contract used by the storefront clients. */
export type AccountReservation =
  AccountOperations["reservations"]["response"][number];
/** Public account voucher contract used by the storefront clients. */
export type AccountVoucher = AccountOperations["vouchers"]["response"][number];
/** Public voucher history entry contract used by the storefront clients. */
export type VoucherHistoryEntry =
  AccountOperations["voucherHistory"]["response"][number];
/** Public withdrawal option contract used by the storefront clients. */
export type WithdrawalOption =
  AccountOperations["withdrawalItems"]["response"][number];
/** Public shipping address contract used by the storefront clients. */
export type ShippingAddress =
  AccountOperations["addresses"]["response"][number];
/** Create the same-origin customer dashboard transport for bookings, orders, reservations, vouchers and settings.
 * @param options - Options supplied by the host. Defaults to {}. */
export function createDashboardClient(options: AccountClientOptions = {}) {
  const transport = options.fetch ?? globalThis.fetch.bind(globalThis);
  async function request<K extends keyof AccountOperations>(
    key: K,
    path: string,
    method: string,
    body?: AccountOperations[K]["body"],
    signal?: AbortSignal,
  ): Promise<AccountOperations[K]["response"]> {
    const response = await transport(path, {
      method,
      signal,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && !signal?.aborted)
        options.onUnauthorized?.();
      throw new AccountApiError(response.status, value?.detail ?? value?.error);
    }
    if (value === null && key !== "moveBooking")
      throw new Error("Invalid account response");
    return value;
  }
  const id = (value: string | number) => encodeURIComponent(String(value));
  return {
    /** List customer orders. Optional signal cancels the read. */
    orders: (signal?: AbortSignal) =>
      request("orders", "/api/shop/orders/", "GET", undefined, signal),
    /** List customer event bookings. Optional signal cancels the read. */
    bookings: (signal?: AbortSignal) =>
      request(
        "bookings",
        "/api/shop/tastings/bookings",
        "GET",
        undefined,
        signal,
      ),
    /** Read one customer booking by opaque identifier. */
    booking: (value: string, signal?: AbortSignal) =>
      request(
        "booking",
        `/api/shop/tastings/bookings/${id(value)}`,
        "GET",
        undefined,
        signal,
      ),
    /** Reschedule a booking to the supplied backend timewindow identifier. */
    moveBooking: (
      value: string,
      body: AccountOperations["moveBooking"]["body"],
    ) =>
      request(
        "moveBooking",
        `/api/shop/tastings/bookings/${id(value)}/move`,
        "POST",
        body,
      ),
    /** List customer table reservations. */
    reservations: (signal?: AbortSignal) =>
      request(
        "reservations",
        "/api/shop/table-reservations",
        "GET",
        undefined,
        signal,
      ),
    /** Read a customer reservation by opaque identifier. */
    reservation: (value: number, signal?: AbortSignal) =>
      request(
        "reservation",
        `/api/shop/table-reservations/${id(value)}`,
        "GET",
        undefined,
        signal,
      ),
    /** Patch only changed reservation fields. */
    updateReservation: (
      value: number,
      body: AccountOperations["updateReservation"]["body"],
    ) =>
      request(
        "updateReservation",
        `/api/shop/table-reservations/${id(value)}`,
        "PATCH",
        body,
      ),
    /** Cancel the supplied customer reservation. */
    cancelReservation: (value: number) =>
      request(
        "cancelReservation",
        `/api/shop/table-reservations/${id(value)}/cancel`,
        "POST",
      ),
    /** List customer-owned vouchers. */
    vouchers: (signal?: AbortSignal) =>
      request(
        "vouchers",
        "/api/shop/vouchers/customer",
        "GET",
        undefined,
        signal,
      ),
    /** Read a customer voucher by opaque identifier. */
    voucher: (value: string, signal?: AbortSignal) =>
      request(
        "voucher",
        `/api/shop/vouchers/customer/${id(value)}`,
        "GET",
        undefined,
        signal,
      ),
    /** Read a customer voucher usage history. */
    voucherHistory: (value: string, signal?: AbortSignal) =>
      request(
        "voucherHistory",
        `/api/shop/vouchers/customer/${id(value)}/history`,
        "GET",
        undefined,
        signal,
      ),
    /** Read backend-authoritative withdrawal eligibility per order line. */
    withdrawalItems: (value: string, signal?: AbortSignal) =>
      request(
        "withdrawalItems",
        `/api/shop/orders/${id(value)}/withdrawal-items`,
        "GET",
        undefined,
        signal,
      ),
    /** Request withdrawal for selected eligible quantities. */
    withdraw: (value: string, body: AccountOperations["withdraw"]["body"]) =>
      request(
        "withdraw",
        `/api/shop/orders/${id(value)}/cancellation-request`,
        "POST",
        body,
      ),
    /** Save changed customer profile fields. */
    updateProfile: (body: AccountOperations["updateProfile"]["body"]) =>
      request("updateProfile", "/api/shop/user/profile", "PUT", body),
    /** Revoke newsletter consent without a request body. */
    newsletterUnsubscribe: () =>
      request(
        "newsletterUnsubscribe",
        "/api/shop/user/newsletter/unsubscribe",
        "POST",
      ),
    /** List customer shipping addresses. */
    addresses: (signal?: AbortSignal) =>
      request(
        "addresses",
        "/api/shop/user/shipping-addresses",
        "GET",
        undefined,
        signal,
      ),
    /** Create a customer shipping address. */
    createAddress: (body: AccountOperations["createAddress"]["body"]) =>
      request(
        "createAddress",
        "/api/shop/user/shipping-addresses",
        "POST",
        body,
      ),
    /** Replace the selected customer shipping address. */
    updateAddress: (
      value: string,
      body: AccountOperations["updateAddress"]["body"],
    ) =>
      request(
        "updateAddress",
        `/api/shop/user/shipping-addresses/${id(value)}`,
        "PUT",
        body,
      ),
    /** Delete the selected customer shipping address. */
    deleteAddress: (value: string) =>
      request(
        "deleteAddress",
        `/api/shop/user/shipping-addresses/${id(value)}`,
        "DELETE",
      ),
    /** Change the account password. */
    updatePassword: (body: AccountOperations["updatePassword"]["body"]) =>
      request("updatePassword", "/api/shop/user/password-update", "POST", body),
    /** Request a confirmed account email change. */
    updateEmail: (body: AccountOperations["updateEmail"]["body"]) =>
      request("updateEmail", "/api/shop/user/update-email", "POST", body),
  };
}
/** Public dashboard client contract used by the storefront clients. */
export type DashboardClient = ReturnType<typeof createDashboardClient>;
/** Read and change newsletter status, including a pending double-opt-in request. */
export interface NewsletterAdapter {
  /** Read the current newsletter state: false, pending or true. */
  status: () => Promise<boolean | "pending">;
  /** Request or resend newsletter double opt-in. */
  subscribe: () => Promise<void>;
  /** Revoke newsletter consent. */
  unsubscribe: () => Promise<void>;
}
/** Adapt profile consent timestamps and dashboard mutations into newsletter status and double-opt-in actions.
 * @param client - Stable client instance used for API requests.
 * @param profile - Authoritative authenticated profile; null represents a guest. */
export function profileNewsletterAdapter(
  client: DashboardClient,
  profile: () => Promise<{
    /** Newsletter consent in the profile newsletter adapter contract. Optional; omitted unless supplied by the host or backend. */
    newsletter_consent?: boolean | null;
    /** Newsletter requested at in the profile newsletter adapter contract. Optional; omitted unless supplied by the host or backend. */
    newsletter_requested_at?: string | null;
    /** Newsletter confirmed at in the profile newsletter adapter contract. Optional; omitted unless supplied by the host or backend. */
    newsletter_confirmed_at?: string | null;
  }>,
): NewsletterAdapter {
  return {
    /** Read newsletter state: false, pending or true. */
    status: async () => {
      const value = await profile();
      if (value.newsletter_requested_at && !value.newsletter_confirmed_at)
        return "pending";
      return Boolean(value.newsletter_consent);
    },
    /** Request or resend newsletter double opt-in. */
    subscribe: async () => {
      const before = await profile();
      const value = await client.updateProfile({ newsletter_consent: true });
      // An unchanged request timestamp means the backend kept the existing link.
      if (
        value.newsletter_requested_at &&
        !value.newsletter_confirmed_at &&
        value.newsletter_requested_at === before.newsletter_requested_at
      )
        throw new AccountApiError(429, "newsletter_cooldown");
    },
    /** Revoke newsletter consent. */
    unsubscribe: async () => {
      await client.newsletterUnsubscribe();
    },
  };
}
