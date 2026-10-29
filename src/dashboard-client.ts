import { AccountApiError, type AccountClientOptions } from "./account-client";
import type { AccountOperations } from "./wire";
export type AccountOrder = AccountOperations["orders"]["response"][number];
export type AccountBooking = AccountOperations["bookings"]["response"][number];
export type AccountReservation =
  AccountOperations["reservations"]["response"][number];
export type AccountVoucher = AccountOperations["vouchers"]["response"][number];
export type VoucherHistoryEntry =
  AccountOperations["voucherHistory"]["response"][number];
export type WithdrawalOption =
  AccountOperations["withdrawalItems"]["response"][number];
export type ShippingAddress =
  AccountOperations["addresses"]["response"][number];
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
    orders: (signal?: AbortSignal) =>
      request("orders", "/api/shop/orders/", "GET", undefined, signal),
    bookings: (signal?: AbortSignal) =>
      request(
        "bookings",
        "/api/shop/tastings/bookings",
        "GET",
        undefined,
        signal,
      ),
    booking: (value: string, signal?: AbortSignal) =>
      request(
        "booking",
        `/api/shop/tastings/bookings/${id(value)}`,
        "GET",
        undefined,
        signal,
      ),
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
    reservations: (signal?: AbortSignal) =>
      request(
        "reservations",
        "/api/shop/table-reservations",
        "GET",
        undefined,
        signal,
      ),
    reservation: (value: number, signal?: AbortSignal) =>
      request(
        "reservation",
        `/api/shop/table-reservations/${id(value)}`,
        "GET",
        undefined,
        signal,
      ),
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
    cancelReservation: (value: number) =>
      request(
        "cancelReservation",
        `/api/shop/table-reservations/${id(value)}/cancel`,
        "POST",
      ),
    vouchers: (signal?: AbortSignal) =>
      request(
        "vouchers",
        "/api/shop/vouchers/customer",
        "GET",
        undefined,
        signal,
      ),
    voucher: (value: string, signal?: AbortSignal) =>
      request(
        "voucher",
        `/api/shop/vouchers/customer/${id(value)}`,
        "GET",
        undefined,
        signal,
      ),
    voucherHistory: (value: string, signal?: AbortSignal) =>
      request(
        "voucherHistory",
        `/api/shop/vouchers/customer/${id(value)}/history`,
        "GET",
        undefined,
        signal,
      ),
    withdrawalItems: (value: string, signal?: AbortSignal) =>
      request(
        "withdrawalItems",
        `/api/shop/orders/${id(value)}/withdrawal-items`,
        "GET",
        undefined,
        signal,
      ),
    withdraw: (value: string, body: AccountOperations["withdraw"]["body"]) =>
      request(
        "withdraw",
        `/api/shop/orders/${id(value)}/cancellation-request`,
        "POST",
        body,
      ),
    updateProfile: (body: AccountOperations["updateProfile"]["body"]) =>
      request("updateProfile", "/api/shop/user/profile", "PUT", body),
    newsletterUnsubscribe: () =>
      request(
        "newsletterUnsubscribe",
        "/api/shop/user/newsletter/unsubscribe",
        "POST",
      ),
    addresses: (signal?: AbortSignal) =>
      request(
        "addresses",
        "/api/shop/user/shipping-addresses",
        "GET",
        undefined,
        signal,
      ),
    createAddress: (body: AccountOperations["createAddress"]["body"]) =>
      request(
        "createAddress",
        "/api/shop/user/shipping-addresses",
        "POST",
        body,
      ),
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
    deleteAddress: (value: string) =>
      request(
        "deleteAddress",
        `/api/shop/user/shipping-addresses/${id(value)}`,
        "DELETE",
      ),
    updatePassword: (body: AccountOperations["updatePassword"]["body"]) =>
      request("updatePassword", "/api/shop/user/password-update", "POST", body),
    updateEmail: (body: AccountOperations["updateEmail"]["body"]) =>
      request("updateEmail", "/api/shop/user/update-email", "POST", body),
  };
}
export type DashboardClient = ReturnType<typeof createDashboardClient>;
export interface NewsletterAdapter {
  status: () => Promise<boolean | "pending">;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}
export function profileNewsletterAdapter(
  client: DashboardClient,
  profile: () => Promise<{
    newsletter_consent?: boolean | null;
    newsletter_requested_at?: string | null;
    newsletter_confirmed_at?: string | null;
  }>,
): NewsletterAdapter {
  return {
    status: async () => {
      const value = await profile();
      if (value.newsletter_requested_at && !value.newsletter_confirmed_at)
        return "pending";
      return Boolean(value.newsletter_consent);
    },
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
    unsubscribe: async () => {
      await client.newsletterUnsubscribe();
    },
  };
}
