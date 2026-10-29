// Generated wire contracts. Run bun run generate:client with the final OpenAPI export.
export type ShopTasting = {
  tasting_id: number;
  tasting_name: string;
  price: number;
  variant_id?: string | null;
  variant_name?: string | null;
  full_name: string;
};
export type ShopFranchiseLocationResponse = {
  online_party_min?: number | null;
  online_party_max?: number | null;
  location_name: string;
  location_street?: string | null;
  location_postal_code?: string | null;
  location_city?: string | null;
  location_phone?: string | null;
  total_seats?: number;
  table_reservations_enabled?: boolean;
  id: number;
};
export type ShopTimewindowResponse = {
  id: string;
  timewindow_id: string;
  tasting_id: number;
  franchise_location_id?: number | null;
  date: string;
  start_time: string;
  end_time?: string | null;
  event_name: string;
  max_participants: number;
  free_spots?: number;
  timewindow_series_id?: string | null;
  availabilityStatus?: TimewindowAvailabilityStatus | null;
};
export type PublicShopSettings = {
  guest_shop_checkout_enabled?: boolean;
  shop_checkout_review_required?: boolean;
  shop_shipping_country?: string | null;
  shop_low_stock_threshold?: number;
  pickup_auto_cancel_enabled?: boolean;
  pickup_hold_days?: number | null;
  pickup_grace_days?: number | null;
  sealed_goods_exclusion_enabled?: boolean;
  countries: Array<CountryOption>;
  installation_country: string;
  min_customer_age?: number;
  guest_max_seats?: number;
  online_lead_hours?: number;
  direct_booking_enabled: boolean;
  guest_booking_enabled: boolean;
  turnstile_site_key?: string;
};
export type ShopBookingRequest = {
  withdrawal_acknowledged?: boolean;
  withdrawal_text_version?: string | null;
  timewindow_id: string;
  notes?: string | null;
  seats: Array<ShopBookingSeatLine>;
};
export type ShopGuestBookingRequest = {
  withdrawal_acknowledged?: boolean;
  withdrawal_text_version?: string | null;
  timewindow_id: string;
  notes?: string | null;
  seats: Array<ShopBookingSeatLine>;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  terms_privacy_accepted: boolean;
  turnstile_token: string;
};
export type ShopBookingResponse = {
  order_id: string;
  order_number: string;
  success: boolean;
  status: string;
  checkout_url?: string | null;
};
export type UserLoginRequest = { email: string; password: string };
export type ShopUserProfileCreateRequest = {
  country?: string | null;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  address1?: string | null;
  postal_code?: string | null;
  city?: string | null;
  newsletter_consent?: boolean | null;
  marketing_consent?: boolean | null;
  phone?: string | null;
  birth_date?: string | null;
  address2?: string | null;
};
export type ShopUserProfile = {
  id: number;
  email?: string | null;
  customer_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  companyname?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  address1?: string | null;
  address2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  newsletter_consent?: boolean;
  newsletter_requested_at?: string | null;
  newsletter_confirmed_at?: string | null;
  marketing_consent?: boolean;
  is_email_verified?: boolean;
  source?: string | null;
  has_password?: boolean;
};
export type PasswordResetRequest = { email: string };
export type PasswordResetConfirmRequest = {
  token: string;
  new_password: string;
};
export type EmailVerificationRequest = { token: string };
export type EmailChangeConfirmRequest = { token: string };
export type AuthResponse = {
  access_token: string;
  customer: ShopUserProfile;
  message: string;
};
export type ShopOrder = {
  order_source?: ShopOrderSource | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  withdrawal?: ShopOrderWithdrawal | null;
  voucher_only?: boolean;
  id: string;
  order_number: string;
  created_at: string;
  status: ShopOrderStatus;
  items: Array<ShopOrderItem>;
  fulfillments: Array<ShopOrderFulfillment>;
  payments: Array<ShopOrderPayment>;
  has_invoice?: boolean;
  credit_notes?: Array<ShopOrderCreditNote>;
  shipping_refunded_amount?: number;
};
export type ShopBookingOrderResponse = {
  order_number?: string | null;
  customer_status?: CustomerBookingStatus | null;
  customer_status_label?: string | null;
  tickets?: Array<ShopBookingTicket>;
  reschedulable_until?: string | null;
  reschedule_count?: number;
  has_been_moved?: boolean;
  payments?: Array<ShopOrderPayment>;
  has_invoice?: boolean;
  invoice_link?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  credit_notes?: Array<ShopOrderCreditNote>;
  order_id: string;
  tasting_id: number;
  franchise_location: ShopBookingLocation;
  date: string;
  start_time: string;
  end_time: string;
  event_name: string;
  participants?: number | null;
};
export type ShopBookingMoveRequest = { timewindow_id: string };
export type CustomerTableReservationResponse = {
  id: number;
  franchise_location_id: number;
  location_name: string | null;
  date: string;
  time: string;
  num_guests: number;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
export type CustomerTableReservationUpdate = {
  date?: string | null;
  time?: string | null;
  num_guests?: number | null;
  notes?: string | null;
};
export type ShopVoucherModel = {
  withdrawal_acknowledgement_required?: boolean;
  withdrawal_text_version?: string | null;
  withdrawal_acknowledgement_text?: string | null;
  id?: string | null;
  type?: ShopVoucherType | null;
  kind?: VoucherKind;
  vat_rate?: number | null;
  redeemable_for_text?: string | null;
  redeemable_tasting_ids?: Array<number> | null;
  redeemable_location_ids?: Array<number> | null;
  voucher_code: string;
  value: number;
  remaining_value: number;
  redeemed: boolean;
  created_at: string;
  article?: ShopVoucherArticle | null;
};
export type ShopVoucherHistoryEntry = {
  id: string;
  source: "LOG" | "STORE" | "ONLINE";
  action: string;
  created_at: string;
  amount_cents: number;
  remaining_before?: number | null;
  remaining_after?: number | null;
  order_id?: string | null;
  franchise_location_id?: number | null;
};
export type WithdrawalItemOption = {
  opened?: boolean;
  withdrawal_note?: string;
  withdrawal_lapses_when_unsealed?: boolean;
  return_window_days?: number | null;
  return_deadline?: string | null;
  request_kind?: "STATUTORY_WITHDRAWAL" | "VOLUNTARY_RETURN" | null;
  is_voucher?: boolean;
  order_item_id: string;
  title: string;
  quantity: number;
  reason?:
    | "VOUCHER_REDEEMED"
    | "WINDOW_EXPIRED"
    | "BOOKING_ORDER"
    | "PERISHABLE"
    | "UNSEALED"
    | null;
};
export type WithdrawalSelectionRequest = {
  items?: Array<WithdrawalItemSelection> | null;
};
export type CancellationRequestResult = {
  status: ShopOrderCancellationRequestStatus;
  reason?:
    | "BOOKING_ORDER"
    | "WINDOW_EXPIRED"
    | "VOUCHER_REDEEMED"
    | "PARTIAL"
    | "PERISHABLE"
    | "UNSEALED"
    | null;
  excluded_items?: Array<WithdrawalExcludedItem>;
};
export type ShopUserProfileUpdate = {
  country?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  companyname?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  address1?: string | null;
  address2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  newsletter_consent?: boolean | null;
  marketing_consent?: boolean | null;
};
export type ShopUserShippingAddress = {
  id: string;
  name: string;
  company_name?: string | null;
  address1: string;
  address2?: string | null;
  postal_code: string;
  city: string;
  country: string;
  phone?: string | null;
  email?: string | null;
};
export type ShopUserShippingAddressRequest = {
  country: string;
  name: string;
  company_name?: string | null;
  address1: string;
  address2?: string | null;
  postal_code: string;
  city: string;
  phone?: string | null;
  email?: string | null;
};
export type PasswordUpdateRequest = { old_password: string; password: string };
export type EmailChangeRequest = { new_email: string };
export type TimewindowAvailabilityStatus =
  | "available"
  | "limited"
  | "not_available";
export type CountryOption = { value: string; label: string };
export type ShopBookingSeatLine = {
  voucher_code?: string | null;
  variant_id?: string | null;
};
export type ShopOrderSource =
  | "SHOP_CHECKOUT"
  | "SHOP_BOOKING"
  | "BACKOFFICE_VOUCHER_REDEMPTION"
  | "B2B_PORTAL"
  | "LEGACY_PIXEND"
  | "LEGACY_WOOCOMMERCE";
export type ShopOrderWithdrawal = {
  state:
    | "AVAILABLE"
    | "REQUESTED"
    | "ACCEPTED"
    | "ACCEPTED_REFUNDED"
    | "DECLINED"
    | "DECIDED"
    | "EXPIRED"
    | "UNAVAILABLE";
  deadline_at?: string | null;
  request?: ShopWithdrawalRequest | null;
};
export type ShopOrderStatus =
  | "PENDING"
  | "PAID"
  | "CANCELLED"
  | "INCOMPLETE"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED"
  | "REFUNDED_EXTERNALLY"
  | "DISPUTED"
  | "DISPUTED_LOST"
  | "PARTIALLY_CANCELLED"
  | "RETURNED"
  | "PARTIALLY_RETURNED";
export type ShopOrderItem = {
  line_note?: string | null;
  withdrawal_excluded_reason?: string | null;
  withdrawal_lapses_when_unsealed?: boolean;
  cancelled_at?: string | null;
  returned_quantity?: number;
  id: string;
  title: string;
  quantity: number;
  gross_price_per_item: number;
  voucher_kind?: string;
  discount_amount?: number;
  supplier_franchise_id?: number | null;
  supply_location_id?: number | null;
  net_price_per_item: number;
  vat_rate_id?: number | null;
  vat_rate: number;
  article?: ShopOrdersShopArticle | null;
  variant?: ShopOrdersShopArticleVariant | null;
};
export type ShopOrderFulfillment = {
  scheduled_date?: string | null;
  shipping_age_check?: number | null;
  age_check?: number | null;
  age_check_required?: boolean;
  pickup_ready_at?: string | null;
  pickup_deadline_at?: string | null;
  id: string;
  type: ShopOrderFulfillmentType;
  code: string;
  name: string;
  title?: string | null;
  price: number;
  status: ShopOrderFulfillmentStatus;
  pickup_name?: string | null;
  pickup_address?: string | null;
  pickup_postal_code?: string | null;
  pickup_city?: string | null;
  pickup_country?: string | null;
  pickup_location_id?: number | null;
  shipping_name?: string | null;
  shipping_company_name?: string | null;
  shipping_address1?: string | null;
  shipping_address2?: string | null;
  shipping_postal_code?: string | null;
  shipping_city?: string | null;
  shipping_country?: string | null;
  shipping_phone?: string | null;
  shipping_email?: string | null;
  shipping_address_id?: string | null;
  shipping_carrier_name?: string | null;
  shipping_tracking_number?: string | null;
  shipping_tracking_link?: string | null;
  pickup_location?: BackofficeFranchiseLocation | null;
};
export type ShopOrderPayment = {
  type?: "VOUCHER" | "STRIPE" | "OTHER";
  voucher_code?: string | null;
  payment_status: ShopPaymentPaymentStatus;
  refunded_amount?: number;
  promo_discount?: number;
  id: string;
  amount: number;
  amount_subtotal: number;
  amount_discount: number;
};
export type ShopOrderCreditNote = {
  id: string;
  credit_note_number?: string | null;
  created_at: string;
};
export type CustomerBookingStatus =
  | "CONFIRMED"
  | "VISITED"
  | "PAST"
  | "CANCELLED"
  | "PAYMENT_PENDING"
  | "PAYMENT_FAILED";
export type ShopBookingTicket = {
  check_in_code?: string | null;
  seats: number;
};
export type ShopBookingLocation = {
  online_party_min?: number | null;
  online_party_max?: number | null;
  location_name: string;
  location_street?: string | null;
  location_postal_code?: string | null;
  location_city?: string | null;
  location_phone?: string | null;
  total_seats?: number;
  table_reservations_enabled?: boolean;
  id?: number | null;
};
export type ShopVoucherType = "VALUE" | "TASTING";
export type VoucherKind = "NONE" | "SINGLE_PURPOSE" | "MULTI_PURPOSE";
export type ShopVoucherArticle = {
  kind?: VoucherKind | null;
  redeemable_for_text?: string | null;
  id: string;
  title: string;
  price: number;
  previous_price?: number | null;
  tasting_id?: number | null;
  variant?: ShopVoucherArticleVariant | null;
};
export type WithdrawalItemSelection = {
  opened?: boolean;
  order_item_id: string;
  quantity: number;
};
export type ShopOrderCancellationRequestStatus =
  | "NOT_FOUND"
  | "PENDING_REVIEW"
  | "WAITING"
  | "ACCEPTED"
  | "DECLINED";
export type WithdrawalExcludedItem = {
  title: string;
  reason:
    | "VOUCHER_REDEEMED"
    | "WINDOW_EXPIRED"
    | "BOOKING_ORDER"
    | "PERISHABLE"
    | "UNSEALED";
};
export type ShopWithdrawalRequest = {
  id: string;
  status: ShopOrderCancellationRequestStatus;
  created_at: string;
  updated_at: string;
};
export type ShopOrdersShopArticle = {
  id: string;
  title: string;
  category: ShopOrdersShopArticleCategory;
  type: ShopArticleType;
};
export type ShopOrdersShopArticleVariant = {
  id: string;
  name: string;
};
export type ShopOrderFulfillmentType =
  | "DIGITAL"
  | "PICKUP"
  | "SHIPPING"
  | "DELIVERY";
export type ShopOrderFulfillmentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPING_IN_PROGRESS"
  | "SHIPPING_COMPLETED"
  | "PICKUP_READY"
  | "PICKUP_COMPLETED"
  | "DIGITAL_COMPLETED"
  | "FAILED"
  | "CANCELLED";
export type BackofficeFranchiseLocation = {
  id: number;
  location_name: string;
  location_street?: string | null;
  location_postal_code?: string | null;
  location_city?: string | null;
  location_phone?: string | null;
};
export type ShopPaymentPaymentStatus =
  | "PAID"
  | "UNPAID"
  | "NO_PAYMENT_REQUIRED"
  | "REFUND_PENDING"
  | "REFUND_SUCCEEDED"
  | "REFUND_FAILED"
  | "REFUND_CANCELED"
  | "REFUND_REQUIRES_ACTION";
export type ShopVoucherArticleVariant = {
  id: string;
  name: string;
  price: number;
  previous_price?: number | null;
};
export type ShopOrdersShopArticleCategory = {
  id: string;
  name: string;
};
export type ShopArticleType = "PHYSICAL" | "VOUCHER";
export type Tasting = ShopTasting;
export type Location = ShopFranchiseLocationResponse;
export type Timewindow = ShopTimewindowResponse;
export type ShopSettings = PublicShopSettings;
export type BookingRequest = ShopBookingRequest;
export type GuestBookingRequest = ShopGuestBookingRequest;
export type BookingResponse = ShopBookingResponse;
export type AccountLoginRequest = UserLoginRequest;
export type AccountRegisterRequest = ShopUserProfileCreateRequest;
export type AccountProfile = ShopUserProfile;
export type AccountPasswordResetRequest = PasswordResetRequest;
export type AccountPasswordSetRequest = PasswordResetConfirmRequest;
export type AccountEmailVerifyRequest = EmailVerificationRequest;
export type AccountEmailChangeConfirmRequest = EmailChangeConfirmRequest;
export type AccountAuthResponse = AuthResponse;
export type AccountOperations = {
  orders: {
    path: "/api/shop/orders/";
    method: "GET";
    body: undefined;
    response: Array<ShopOrder>;
  };
  bookings: {
    path: "/api/shop/tastings/bookings";
    method: "GET";
    body: undefined;
    response: Array<ShopBookingOrderResponse>;
  };
  booking: {
    path: "/api/shop/tastings/bookings/{booking_id}";
    method: "GET";
    body: undefined;
    response: ShopBookingOrderResponse;
  };
  moveBooking: {
    path: "/api/shop/tastings/bookings/{booking_id}/move";
    method: "POST";
    body: ShopBookingMoveRequest;
    response: unknown;
  };
  reservations: {
    path: "/api/shop/table-reservations";
    method: "GET";
    body: undefined;
    response: Array<CustomerTableReservationResponse>;
  };
  reservation: {
    path: "/api/shop/table-reservations/{reservation_id}";
    method: "GET";
    body: undefined;
    response: CustomerTableReservationResponse;
  };
  updateReservation: {
    path: "/api/shop/table-reservations/{reservation_id}";
    method: "PATCH";
    body: CustomerTableReservationUpdate;
    response: CustomerTableReservationResponse;
  };
  cancelReservation: {
    path: "/api/shop/table-reservations/{reservation_id}/cancel";
    method: "POST";
    body: undefined;
    response: CustomerTableReservationResponse;
  };
  vouchers: {
    path: "/api/shop/vouchers/customer";
    method: "GET";
    body: undefined;
    response: Array<ShopVoucherModel>;
  };
  voucher: {
    path: "/api/shop/vouchers/customer/{voucher_id}";
    method: "GET";
    body: undefined;
    response: ShopVoucherModel;
  };
  voucherHistory: {
    path: "/api/shop/vouchers/customer/{voucher_id}/history";
    method: "GET";
    body: undefined;
    response: Array<ShopVoucherHistoryEntry>;
  };
  withdrawalItems: {
    path: "/api/shop/orders/{order_id}/withdrawal-items";
    method: "GET";
    body: undefined;
    response: Array<WithdrawalItemOption>;
  };
  withdraw: {
    path: "/api/shop/orders/{order_id}/cancellation-request";
    method: "POST";
    body: WithdrawalSelectionRequest | null;
    response: CancellationRequestResult;
  };
  updateProfile: {
    path: "/api/shop/user/profile";
    method: "PUT";
    body: ShopUserProfileUpdate;
    response: ShopUserProfile;
  };
  newsletterUnsubscribe: {
    path: "/api/shop/user/newsletter/unsubscribe";
    method: "POST";
    body: undefined;
    response: Record<string, string>;
  };
  addresses: {
    path: "/api/shop/user/shipping-addresses";
    method: "GET";
    body: undefined;
    response: Array<ShopUserShippingAddress>;
  };
  createAddress: {
    path: "/api/shop/user/shipping-addresses";
    method: "POST";
    body: ShopUserShippingAddressRequest;
    response: ShopUserShippingAddress;
  };
  updateAddress: {
    path: "/api/shop/user/shipping-addresses/{shipping_address_id}";
    method: "PUT";
    body: ShopUserShippingAddressRequest;
    response: ShopUserShippingAddress;
  };
  deleteAddress: {
    path: "/api/shop/user/shipping-addresses/{shipping_address_id}";
    method: "DELETE";
    body: undefined;
    response: Record<string, string>;
  };
  updatePassword: {
    path: "/api/shop/user/password-update";
    method: "POST";
    body: PasswordUpdateRequest;
    response: Record<string, string>;
  };
  updateEmail: {
    path: "/api/shop/user/update-email";
    method: "POST";
    body: EmailChangeRequest;
    response: Record<string, string>;
  };
  login: {
    path: "/api/shop/user/login";
    method: "POST";
    body: UserLoginRequest;
    response: AuthResponse;
  };
  register: {
    path: "/api/shop/user/register";
    method: "POST";
    body: ShopUserProfileCreateRequest;
    response: Record<string, string>;
  };
  passwordReset: {
    path: "/api/shop/user/password-reset";
    method: "POST";
    body: PasswordResetRequest;
    response: Record<string, string>;
  };
  passwordSet: {
    path: "/api/shop/user/password-reset/confirm";
    method: "POST";
    body: PasswordResetConfirmRequest;
    response: Record<string, string>;
  };
  emailVerify: {
    path: "/api/shop/user/verify-email";
    method: "POST";
    body: EmailVerificationRequest;
    response: Record<string, string>;
  };
  emailChangeConfirm: {
    path: "/api/shop/user/confirm-email-change";
    method: "POST";
    body: EmailChangeConfirmRequest;
    response: Record<string, string>;
  };
  profile: {
    path: "/api/shop/user/profile";
    method: "GET";
    body: undefined;
    response: ShopUserProfile;
  };
  logout: {
    path: "/api/shop/user/logout";
    method: "POST";
    body: undefined;
    response: Record<string, string>;
  };
  settings: {
    path: "/api/shop/settings";
    method: "GET";
    body: undefined;
    response: PublicShopSettings;
  };
};
