// Generated wire contracts. Run bun run generate:client with the final OpenAPI export.

/** Public shop event wire contract. Values and optionality come from the backend export. */
export type ShopEvent = {
  /** Public event identifier. The backend wire spelling is unchanged. Required by this wire contract. */
  tasting_id: number;

  /** Backend tasting name value. Required by this wire contract. */
  tasting_name: string;

  /** Price in integer cents. Required by this wire contract. */
  price: number;

  /** UUID of the selected event variant. Optional; no client default is applied to this wire field. */
  variant_id?: string | null;

  /** Backend variant name value. Optional; no client default is applied to this wire field. */
  variant_name?: string | null;

  /** Backend full name value. Required by this wire contract. */
  full_name: string;
};

/** Public shop franchise location response wire contract. Values and optionality come from the backend export. */
export type ShopFranchiseLocationResponse = {
  /** Backend online party min value. Optional; no client default is applied to this wire field. */
  online_party_min?: number | null;

  /** Backend online party max value. Optional; no client default is applied to this wire field. */
  online_party_max?: number | null;

  /** Backend location name value. Required by this wire contract. */
  location_name: string;

  /** Backend location street value. Optional; no client default is applied to this wire field. */
  location_street?: string | null;

  /** Backend location postal code value. Optional; no client default is applied to this wire field. */
  location_postal_code?: string | null;

  /** Backend location city value. Optional; no client default is applied to this wire field. */
  location_city?: string | null;

  /** Backend location phone value. Optional; no client default is applied to this wire field. */
  location_phone?: string | null;

  /** Backend total seats value. Optional; no client default is applied to this wire field. */
  total_seats?: number;

  /** Backend table reservations enabled value. Optional; no client default is applied to this wire field. */
  table_reservations_enabled?: boolean;

  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: number;
};

/** Public shop timewindow response wire contract. Values and optionality come from the backend export. */
export type ShopTimewindowResponse = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend slot identifier required for booking submission. Required by this wire contract. */
  timewindow_id: string;

  /** Public event identifier. The backend wire spelling is unchanged. Required by this wire contract. */
  tasting_id: number;

  /** Backend franchise location id value. Optional; no client default is applied to this wire field. */
  franchise_location_id?: number | null;

  /** Calendar date supplied by the backend. Required by this wire contract. */
  date: string;

  /** Local event start time in Europe/Berlin. Required by this wire contract. */
  start_time: string;

  /** Local event end time in Europe/Berlin. Optional; no client default is applied to this wire field. */
  end_time?: string | null;

  /** Backend event name value. Required by this wire contract. */
  event_name: string;

  /** Backend max participants value. Required by this wire contract. */
  max_participants: number;

  /** Backend free spots value. Optional; no client default is applied to this wire field. */
  free_spots?: number;

  /** Backend timewindow series id value. Optional; no client default is applied to this wire field. */
  timewindow_series_id?: string | null;

  /** Backend availability status value. Optional; no client default is applied to this wire field. */
  availabilityStatus?: TimewindowAvailabilityStatus | null;
};

/** Public public shop settings wire contract. Values and optionality come from the backend export. */
export type PublicShopSettings = {
  /** Backend guest shop checkout enabled value. Optional; no client default is applied to this wire field. */
  guest_shop_checkout_enabled?: boolean;

  /** Backend shop checkout review required value. Optional; no client default is applied to this wire field. */
  shop_checkout_review_required?: boolean;

  /** Backend shop shipping country value. Optional; no client default is applied to this wire field. */
  shop_shipping_country?: string | null;

  /** Backend shop low stock threshold value. Optional; no client default is applied to this wire field. */
  shop_low_stock_threshold?: number;

  /** Backend pickup auto cancel enabled value. Optional; no client default is applied to this wire field. */
  pickup_auto_cancel_enabled?: boolean;

  /** Backend pickup hold days value. Optional; no client default is applied to this wire field. */
  pickup_hold_days?: number | null;

  /** Backend pickup grace days value. Optional; no client default is applied to this wire field. */
  pickup_grace_days?: number | null;

  /** Backend sealed goods exclusion enabled value. Optional; no client default is applied to this wire field. */
  sealed_goods_exclusion_enabled?: boolean;

  /** Backend countries value. Required by this wire contract. */
  countries: Array<CountryOption>;

  /** Backend installation country value. Required by this wire contract. */
  installation_country: string;

  /** Backend min customer age value. Optional; no client default is applied to this wire field. */
  min_customer_age?: number;

  /** Backend guest max seats value. Optional; no client default is applied to this wire field. */
  guest_max_seats?: number;

  /** Backend online lead hours value. Optional; no client default is applied to this wire field. */
  online_lead_hours?: number;

  /** Backend direct booking enabled value. Required by this wire contract. */
  direct_booking_enabled: boolean;

  /** Backend guest booking enabled value. Required by this wire contract. */
  guest_booking_enabled: boolean;

  /** Backend turnstile site key value. Optional; no client default is applied to this wire field. */
  turnstile_site_key?: string;
};

/** Public shop booking request wire contract. Values and optionality come from the backend export. */
export type ShopBookingRequest = {
  /** Backend withdrawal acknowledged value. Optional; no client default is applied to this wire field. */
  withdrawal_acknowledged?: boolean;

  /** Backend withdrawal text version value. Optional; no client default is applied to this wire field. */
  withdrawal_text_version?: string | null;

  /** Backend slot identifier required for booking submission. Required by this wire contract. */
  timewindow_id: string;

  /** Backend notes value. Optional; no client default is applied to this wire field. */
  notes?: string | null;

  /** Places included in this booking request or response. Required by this wire contract. */
  seats: Array<ShopBookingSeatLine>;
};

/** Public shop guest booking request wire contract. Values and optionality come from the backend export. */
export type ShopGuestBookingRequest = {
  /** Backend withdrawal acknowledged value. Optional; no client default is applied to this wire field. */
  withdrawal_acknowledged?: boolean;

  /** Backend withdrawal text version value. Optional; no client default is applied to this wire field. */
  withdrawal_text_version?: string | null;

  /** Backend slot identifier required for booking submission. Required by this wire contract. */
  timewindow_id: string;

  /** Backend notes value. Optional; no client default is applied to this wire field. */
  notes?: string | null;

  /** Places included in this booking request or response. Required by this wire contract. */
  seats: Array<ShopBookingSeatLine>;

  /** Backend first name value. Required by this wire contract. */
  first_name: string;

  /** Backend last name value. Required by this wire contract. */
  last_name: string;

  /** Backend email value. Required by this wire contract. */
  email: string;

  /** Backend phone value. Optional; no client default is applied to this wire field. */
  phone?: string | null;

  /** Current explicit terms/privacy consent. Never restore consent from a draft. Required by this wire contract. */
  terms_privacy_accepted: boolean;

  /** Live guest challenge token. Never persist it in a draft. Required by this wire contract. */
  turnstile_token: string;
};

/** Public shop booking response wire contract. Values and optionality come from the backend export. */
export type ShopBookingResponse = {
  /** Opaque backend order identifier. Required by this wire contract. */
  order_id: string;

  /** Customer-visible backend order reference. Required by this wire contract. */
  order_number: string;

  /** Backend success value. Required by this wire contract. */
  success: boolean;

  /** Backend status value. The backend remains authoritative. Required by this wire contract. */
  status: string;

  /** Backend checkout url value. Optional; no client default is applied to this wire field. */
  checkout_url?: string | null;
};

/** Public user login request wire contract. Values and optionality come from the backend export. */
export type UserLoginRequest = {
  /** Backend email value. Required by this wire contract. */
  email: string;
  /** Backend password value. Required by this wire contract. */
  password: string;
};

/** Public shop user profile create request wire contract. Values and optionality come from the backend export. */
export type ShopUserProfileCreateRequest = {
  /** Backend country value. Optional; no client default is applied to this wire field. */
  country?: string | null;

  /** Backend email value. Required by this wire contract. */
  email: string;

  /** Backend password value. Required by this wire contract. */
  password: string;

  /** Backend first name value. Required by this wire contract. */
  first_name: string;

  /** Backend last name value. Required by this wire contract. */
  last_name: string;

  /** Backend address1 value. Optional; no client default is applied to this wire field. */
  address1?: string | null;

  /** Backend postal code value. Optional; no client default is applied to this wire field. */
  postal_code?: string | null;

  /** Backend city value. Optional; no client default is applied to this wire field. */
  city?: string | null;

  /** Newsletter choice; an opt-in requires the backend double-opt-in flow. Optional; no client default is applied to this wire field. */
  newsletter_consent?: boolean | null;

  /** Legacy registration field for required terms/privacy acceptance, separate from newsletter consent. Optional; no client default is applied to this wire field. */
  marketing_consent?: boolean | null;

  /** Backend phone value. Optional; no client default is applied to this wire field. */
  phone?: string | null;

  /** Backend birth date value. Optional; no client default is applied to this wire field. */
  birth_date?: string | null;

  /** Backend address2 value. Optional; no client default is applied to this wire field. */
  address2?: string | null;
};

/** Public shop user profile wire contract. Values and optionality come from the backend export. */
export type ShopUserProfile = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: number;

  /** Backend email value. Optional; no client default is applied to this wire field. */
  email?: string | null;

  /** Backend customer id value. Optional; no client default is applied to this wire field. */
  customer_id?: string | null;

  /** Backend first name value. Optional; no client default is applied to this wire field. */
  first_name?: string | null;

  /** Backend last name value. Optional; no client default is applied to this wire field. */
  last_name?: string | null;

  /** Backend full name value. Optional; no client default is applied to this wire field. */
  full_name?: string | null;

  /** Backend companyname value. Optional; no client default is applied to this wire field. */
  companyname?: string | null;

  /** Backend phone value. Optional; no client default is applied to this wire field. */
  phone?: string | null;

  /** Backend birth date value. Optional; no client default is applied to this wire field. */
  birth_date?: string | null;

  /** Backend address1 value. Optional; no client default is applied to this wire field. */
  address1?: string | null;

  /** Backend address2 value. Optional; no client default is applied to this wire field. */
  address2?: string | null;

  /** Backend postal code value. Optional; no client default is applied to this wire field. */
  postal_code?: string | null;

  /** Backend city value. Optional; no client default is applied to this wire field. */
  city?: string | null;

  /** Backend country value. Optional; no client default is applied to this wire field. */
  country?: string | null;

  /** Newsletter choice; an opt-in requires the backend double-opt-in flow. Optional; no client default is applied to this wire field. */
  newsletter_consent?: boolean;

  /** Backend newsletter requested at value. Optional; no client default is applied to this wire field. */
  newsletter_requested_at?: string | null;

  /** Backend newsletter confirmed at value. Optional; no client default is applied to this wire field. */
  newsletter_confirmed_at?: string | null;

  /** Legacy registration field for required terms/privacy acceptance, separate from newsletter consent. Optional; no client default is applied to this wire field. */
  marketing_consent?: boolean;

  /** Backend is email verified value. Optional; no client default is applied to this wire field. */
  is_email_verified?: boolean;

  /** Backend source value. Optional; no client default is applied to this wire field. */
  source?: string | null;

  /** Backend has password value. Optional; no client default is applied to this wire field. */
  has_password?: boolean;
};

/** Public password reset request wire contract. Values and optionality come from the backend export. */
export type PasswordResetRequest = {
  /** Backend email value. Required by this wire contract. */
  email: string;
};

/** Public password reset confirm request wire contract. Values and optionality come from the backend export. */
export type PasswordResetConfirmRequest = {
  /** Backend token value. Required by this wire contract. */
  token: string;

  /** Backend new password value. Required by this wire contract. */
  new_password: string;
};

/** Public email verification request wire contract. Values and optionality come from the backend export. */
export type EmailVerificationRequest = {
  /** Backend token value. Required by this wire contract. */
  token: string;
};

/** Public email change confirm request wire contract. Values and optionality come from the backend export. */
export type EmailChangeConfirmRequest = {
  /** Backend token value. Required by this wire contract. */
  token: string;
};

/** Public auth response wire contract. Values and optionality come from the backend export. */
export type AuthResponse = {
  /** Upstream credential. The host proxy must remove it from browser-facing login JSON. Required by this wire contract. */
  access_token: string;

  /** Backend customer value. Required by this wire contract. */
  customer: ShopUserProfile;

  /** Backend message value. Required by this wire contract. */
  message: string;
};

/** Public shop order wire contract. Values and optionality come from the backend export. */
export type ShopOrder = {
  /** Backend order source value. Optional; no client default is applied to this wire field. */
  order_source?: ShopOrderSource | null;

  /** Backend invoice number value. Optional; no client default is applied to this wire field. */
  invoice_number?: string | null;

  /** Backend invoice date value. Optional; no client default is applied to this wire field. */
  invoice_date?: string | null;

  /** Backend withdrawal value. Optional; no client default is applied to this wire field. */
  withdrawal?: ShopOrderWithdrawal | null;

  /** Backend voucher only value. Optional; no client default is applied to this wire field. */
  voucher_only?: boolean;

  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Customer-visible backend order reference. Required by this wire contract. */
  order_number: string;

  /** Backend created at value. Required by this wire contract. */
  created_at: string;

  /** Backend status value. The backend remains authoritative. Required by this wire contract. */
  status: ShopOrderStatus;

  /** Backend items value. Required by this wire contract. */
  items: Array<ShopOrderItem>;

  /** Backend fulfillments value. Required by this wire contract. */
  fulfillments: Array<ShopOrderFulfillment>;

  /** Backend payments value. Required by this wire contract. */
  payments: Array<ShopOrderPayment>;

  /** Backend has invoice value. Optional; no client default is applied to this wire field. */
  has_invoice?: boolean;

  /** Backend credit notes value. Optional; no client default is applied to this wire field. */
  credit_notes?: Array<ShopOrderCreditNote>;

  /** Backend shipping refunded amount value. Optional; no client default is applied to this wire field. */
  shipping_refunded_amount?: number;
};

/** Public shop booking order response wire contract. Values and optionality come from the backend export. */
export type ShopBookingOrderResponse = {
  /** Customer-visible backend order reference. Optional; no client default is applied to this wire field. */
  order_number?: string | null;

  /** Backend customer status value. Optional; no client default is applied to this wire field. */
  customer_status?: CustomerBookingStatus | null;

  /** Backend customer status label value. Optional; no client default is applied to this wire field. */
  customer_status_label?: string | null;

  /** Backend tickets value. Optional; no client default is applied to this wire field. */
  tickets?: Array<ShopBookingTicket>;

  /** Backend reschedulable until value. Optional; no client default is applied to this wire field. */
  reschedulable_until?: string | null;

  /** Backend reschedule count value. Optional; no client default is applied to this wire field. */
  reschedule_count?: number;

  /** Backend has been moved value. Optional; no client default is applied to this wire field. */
  has_been_moved?: boolean;

  /** Backend payments value. Optional; no client default is applied to this wire field. */
  payments?: Array<ShopOrderPayment>;

  /** Backend has invoice value. Optional; no client default is applied to this wire field. */
  has_invoice?: boolean;

  /** Backend invoice link value. Optional; no client default is applied to this wire field. */
  invoice_link?: string | null;

  /** Backend invoice number value. Optional; no client default is applied to this wire field. */
  invoice_number?: string | null;

  /** Backend invoice date value. Optional; no client default is applied to this wire field. */
  invoice_date?: string | null;

  /** Backend credit notes value. Optional; no client default is applied to this wire field. */
  credit_notes?: Array<ShopOrderCreditNote>;

  /** Opaque backend order identifier. Required by this wire contract. */
  order_id: string;

  /** Public event identifier. The backend wire spelling is unchanged. Required by this wire contract. */
  tasting_id: number;

  /** Backend franchise location value. Required by this wire contract. */
  franchise_location: ShopBookingLocation;

  /** Calendar date supplied by the backend. Required by this wire contract. */
  date: string;

  /** Local event start time in Europe/Berlin. Required by this wire contract. */
  start_time: string;

  /** Local event end time in Europe/Berlin. Required by this wire contract. */
  end_time: string;

  /** Backend event name value. Required by this wire contract. */
  event_name: string;

  /** Backend participants value. Optional; no client default is applied to this wire field. */
  participants?: number | null;
};

/** Public shop booking move request wire contract. Values and optionality come from the backend export. */
export type ShopBookingMoveRequest = {
  /** Backend slot identifier required for booking submission. Required by this wire contract. */
  timewindow_id: string;
};

/** Public customer table reservation response wire contract. Values and optionality come from the backend export. */
export type CustomerTableReservationResponse = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: number;

  /** Backend franchise location id value. Required by this wire contract. */
  franchise_location_id: number;

  /** Backend location name value. Required by this wire contract. */
  location_name: string | null;

  /** Calendar date supplied by the backend. Required by this wire contract. */
  date: string;

  /** Backend time value. Required by this wire contract. */
  time: string;

  /** Backend num guests value. Required by this wire contract. */
  num_guests: number;

  /** Backend notes value. Required by this wire contract. */
  notes: string | null;

  /** Backend status value. The backend remains authoritative. Required by this wire contract. */
  status: string;

  /** Backend created at value. Required by this wire contract. */
  created_at: string;

  /** Backend updated at value. Required by this wire contract. */
  updated_at: string;
};

/** Public customer table reservation update wire contract. Values and optionality come from the backend export. */
export type CustomerTableReservationUpdate = {
  /** Calendar date supplied by the backend. Optional; no client default is applied to this wire field. */
  date?: string | null;

  /** Backend time value. Optional; no client default is applied to this wire field. */
  time?: string | null;

  /** Backend num guests value. Optional; no client default is applied to this wire field. */
  num_guests?: number | null;

  /** Backend notes value. Optional; no client default is applied to this wire field. */
  notes?: string | null;
};

/** Public shop voucher model wire contract. Values and optionality come from the backend export. */
export type ShopVoucherModel = {
  /** Backend withdrawal acknowledgement required value. Optional; no client default is applied to this wire field. */
  withdrawal_acknowledgement_required?: boolean;

  /** Backend withdrawal text version value. Optional; no client default is applied to this wire field. */
  withdrawal_text_version?: string | null;

  /** Backend withdrawal acknowledgement text value. Optional; no client default is applied to this wire field. */
  withdrawal_acknowledgement_text?: string | null;

  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Optional; no client default is applied to this wire field. */
  id?: string | null;

  /** Backend type value. Optional; no client default is applied to this wire field. */
  type?: ShopVoucherType | null;

  /** Backend kind value. Optional; no client default is applied to this wire field. */
  kind?: VoucherKind;

  /** Backend vat rate value. Optional; no client default is applied to this wire field. */
  vat_rate?: number | null;

  /** Backend redeemable for text value. Optional; no client default is applied to this wire field. */
  redeemable_for_text?: string | null;

  /** Backend redeemable tasting ids value. Optional; no client default is applied to this wire field. */
  redeemable_tasting_ids?: Array<number> | null;

  /** Backend redeemable location ids value. Optional; no client default is applied to this wire field. */
  redeemable_location_ids?: Array<number> | null;

  /** Voucher code carrying monetary value. Do not expose it to analytics or logs. Required by this wire contract. */
  voucher_code: string;

  /** Backend value value. Required by this wire contract. */
  value: number;

  /** Backend remaining value value. Required by this wire contract. */
  remaining_value: number;

  /** Backend redeemed value. Required by this wire contract. */
  redeemed: boolean;

  /** Backend created at value. Required by this wire contract. */
  created_at: string;

  /** Backend article value. Optional; no client default is applied to this wire field. */
  article?: ShopVoucherArticle | null;
};

/** Public shop voucher history entry wire contract. Values and optionality come from the backend export. */
export type ShopVoucherHistoryEntry = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend source value. Required by this wire contract. */
  source: "LOG" | "STORE" | "ONLINE";

  /** Backend action value. Required by this wire contract. */
  action: string;

  /** Backend created at value. Required by this wire contract. */
  created_at: string;

  /** Backend amount cents value. Required by this wire contract. */
  amount_cents: number;

  /** Backend remaining before value. Optional; no client default is applied to this wire field. */
  remaining_before?: number | null;

  /** Backend remaining after value. Optional; no client default is applied to this wire field. */
  remaining_after?: number | null;

  /** Opaque backend order identifier. Optional; no client default is applied to this wire field. */
  order_id?: string | null;

  /** Backend franchise location id value. Optional; no client default is applied to this wire field. */
  franchise_location_id?: number | null;
};

/** Public withdrawal item option wire contract. Values and optionality come from the backend export. */
export type WithdrawalItemOption = {
  /** Backend opened value. Optional; no client default is applied to this wire field. */
  opened?: boolean;

  /** Backend withdrawal note value. Optional; no client default is applied to this wire field. */
  withdrawal_note?: string;

  /** Backend withdrawal lapses when unsealed value. Optional; no client default is applied to this wire field. */
  withdrawal_lapses_when_unsealed?: boolean;

  /** Backend return window days value. Optional; no client default is applied to this wire field. */
  return_window_days?: number | null;

  /** Backend return deadline value. Optional; no client default is applied to this wire field. */
  return_deadline?: string | null;

  /** Backend request kind value. Optional; no client default is applied to this wire field. */
  request_kind?: "STATUTORY_WITHDRAWAL" | "VOLUNTARY_RETURN" | null;

  /** Backend is voucher value. Optional; no client default is applied to this wire field. */
  is_voucher?: boolean;

  /** Backend order item id value. Required by this wire contract. */
  order_item_id: string;

  /** Backend title value. Required by this wire contract. */
  title: string;

  /** Backend quantity value. Required by this wire contract. */
  quantity: number;

  /** Backend reason value. Optional; no client default is applied to this wire field. */
  reason?:
    | "VOUCHER_REDEEMED"
    | "WINDOW_EXPIRED"
    | "BOOKING_ORDER"
    | "PERISHABLE"
    | "UNSEALED"
    | null;
};

/** Public withdrawal selection request wire contract. Values and optionality come from the backend export. */
export type WithdrawalSelectionRequest = {
  /** Backend items value. Optional; no client default is applied to this wire field. */
  items?: Array<WithdrawalItemSelection> | null;
};

/** Public cancellation request result wire contract. Values and optionality come from the backend export. */
export type CancellationRequestResult = {
  /** Backend status value. The backend remains authoritative. Required by this wire contract. */
  status: ShopOrderCancellationRequestStatus;

  /** Backend reason value. Optional; no client default is applied to this wire field. */
  reason?:
    | "BOOKING_ORDER"
    | "WINDOW_EXPIRED"
    | "VOUCHER_REDEEMED"
    | "PARTIAL"
    | "PERISHABLE"
    | "UNSEALED"
    | null;

  /** Backend excluded items value. Optional; no client default is applied to this wire field. */
  excluded_items?: Array<WithdrawalExcludedItem>;
};

/** Public shop user profile update wire contract. Values and optionality come from the backend export. */
export type ShopUserProfileUpdate = {
  /** Backend country value. Optional; no client default is applied to this wire field. */
  country?: string | null;

  /** Backend first name value. Optional; no client default is applied to this wire field. */
  first_name?: string | null;

  /** Backend last name value. Optional; no client default is applied to this wire field. */
  last_name?: string | null;

  /** Backend companyname value. Optional; no client default is applied to this wire field. */
  companyname?: string | null;

  /** Backend phone value. Optional; no client default is applied to this wire field. */
  phone?: string | null;

  /** Backend birth date value. Optional; no client default is applied to this wire field. */
  birth_date?: string | null;

  /** Backend address1 value. Optional; no client default is applied to this wire field. */
  address1?: string | null;

  /** Backend address2 value. Optional; no client default is applied to this wire field. */
  address2?: string | null;

  /** Backend postal code value. Optional; no client default is applied to this wire field. */
  postal_code?: string | null;

  /** Backend city value. Optional; no client default is applied to this wire field. */
  city?: string | null;

  /** Newsletter choice; an opt-in requires the backend double-opt-in flow. Optional; no client default is applied to this wire field. */
  newsletter_consent?: boolean | null;

  /** Legacy registration field for required terms/privacy acceptance, separate from newsletter consent. Optional; no client default is applied to this wire field. */
  marketing_consent?: boolean | null;
};

/** Public shop user shipping address wire contract. Values and optionality come from the backend export. */
export type ShopUserShippingAddress = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend name value. Required by this wire contract. */
  name: string;

  /** Backend company name value. Optional; no client default is applied to this wire field. */
  company_name?: string | null;

  /** Backend address1 value. Required by this wire contract. */
  address1: string;

  /** Backend address2 value. Optional; no client default is applied to this wire field. */
  address2?: string | null;

  /** Backend postal code value. Required by this wire contract. */
  postal_code: string;

  /** Backend city value. Required by this wire contract. */
  city: string;

  /** Backend country value. Required by this wire contract. */
  country: string;

  /** Backend phone value. Optional; no client default is applied to this wire field. */
  phone?: string | null;

  /** Backend email value. Optional; no client default is applied to this wire field. */
  email?: string | null;
};

/** Public shop user shipping address request wire contract. Values and optionality come from the backend export. */
export type ShopUserShippingAddressRequest = {
  /** Backend country value. Required by this wire contract. */
  country: string;

  /** Backend name value. Required by this wire contract. */
  name: string;

  /** Backend company name value. Optional; no client default is applied to this wire field. */
  company_name?: string | null;

  /** Backend address1 value. Required by this wire contract. */
  address1: string;

  /** Backend address2 value. Optional; no client default is applied to this wire field. */
  address2?: string | null;

  /** Backend postal code value. Required by this wire contract. */
  postal_code: string;

  /** Backend city value. Required by this wire contract. */
  city: string;

  /** Backend phone value. Optional; no client default is applied to this wire field. */
  phone?: string | null;

  /** Backend email value. Optional; no client default is applied to this wire field. */
  email?: string | null;
};

/** Public password update request wire contract. Values and optionality come from the backend export. */
export type PasswordUpdateRequest = {
  /** Backend old password value. Required by this wire contract. */
  old_password: string;
  /** Backend password value. Required by this wire contract. */
  password: string;
};

/** Public email change request wire contract. Values and optionality come from the backend export. */
export type EmailChangeRequest = {
  /** Backend new email value. Required by this wire contract. */
  new_email: string;
};

/** Public timewindow availability status wire contract. Values and optionality come from the backend export. */
export type TimewindowAvailabilityStatus =
  | "available"
  | "limited"
  | "not_available";

/** Public country option wire contract. Values and optionality come from the backend export. */
export type CountryOption = {
  /** Backend value value. Required by this wire contract. */
  value: string;
  /** Backend label value. Required by this wire contract. */
  label: string;
};

/** Public shop booking seat line wire contract. Values and optionality come from the backend export. */
export type ShopBookingSeatLine = {
  /** Voucher code carrying monetary value. Do not expose it to analytics or logs. Optional; no client default is applied to this wire field. */
  voucher_code?: string | null;

  /** UUID of the selected event variant. Optional; no client default is applied to this wire field. */
  variant_id?: string | null;
};

/** Public shop order source wire contract. Values and optionality come from the backend export. */
export type ShopOrderSource =
  | "SHOP_CHECKOUT"
  | "SHOP_BOOKING"
  | "BACKOFFICE_VOUCHER_REDEMPTION"
  | "B2B_PORTAL"
  | "LEGACY_PIXEND"
  | "LEGACY_WOOCOMMERCE";

/** Public shop order withdrawal wire contract. Values and optionality come from the backend export. */
export type ShopOrderWithdrawal = {
  /** Backend state value. Required by this wire contract. */
  state:
    | "AVAILABLE"
    | "REQUESTED"
    | "ACCEPTED"
    | "ACCEPTED_REFUNDED"
    | "DECLINED"
    | "DECIDED"
    | "EXPIRED"
    | "UNAVAILABLE";

  /** Backend deadline at value. Optional; no client default is applied to this wire field. */
  deadline_at?: string | null;

  /** Backend request value. Optional; no client default is applied to this wire field. */
  request?: ShopWithdrawalRequest | null;
};

/** Public shop order status wire contract. Values and optionality come from the backend export. */
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

/** Public shop order item wire contract. Values and optionality come from the backend export. */
export type ShopOrderItem = {
  /** Backend line note value. Optional; no client default is applied to this wire field. */
  line_note?: string | null;

  /** Backend withdrawal excluded reason value. Optional; no client default is applied to this wire field. */
  withdrawal_excluded_reason?: string | null;

  /** Backend withdrawal lapses when unsealed value. Optional; no client default is applied to this wire field. */
  withdrawal_lapses_when_unsealed?: boolean;

  /** Backend cancelled at value. Optional; no client default is applied to this wire field. */
  cancelled_at?: string | null;

  /** Backend returned quantity value. Optional; no client default is applied to this wire field. */
  returned_quantity?: number;

  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend title value. Required by this wire contract. */
  title: string;

  /** Backend quantity value. Required by this wire contract. */
  quantity: number;

  /** Backend gross price per item value. Required by this wire contract. */
  gross_price_per_item: number;

  /** Backend voucher kind value. Optional; no client default is applied to this wire field. */
  voucher_kind?: string;

  /** Backend discount amount value. Optional; no client default is applied to this wire field. */
  discount_amount?: number;

  /** Backend supplier franchise id value. Optional; no client default is applied to this wire field. */
  supplier_franchise_id?: number | null;

  /** Backend supply location id value. Optional; no client default is applied to this wire field. */
  supply_location_id?: number | null;

  /** Backend net price per item value. Required by this wire contract. */
  net_price_per_item: number;

  /** Backend vat rate id value. Optional; no client default is applied to this wire field. */
  vat_rate_id?: number | null;

  /** Backend vat rate value. Required by this wire contract. */
  vat_rate: number;

  /** Backend article value. Optional; no client default is applied to this wire field. */
  article?: ShopOrdersShopArticle | null;

  /** Backend variant value. Optional; no client default is applied to this wire field. */
  variant?: ShopOrdersShopArticleVariant | null;
};

/** Public shop order fulfillment wire contract. Values and optionality come from the backend export. */
export type ShopOrderFulfillment = {
  /** Backend scheduled date value. Optional; no client default is applied to this wire field. */
  scheduled_date?: string | null;

  /** Backend shipping age check value. Optional; no client default is applied to this wire field. */
  shipping_age_check?: number | null;

  /** Backend age check value. Optional; no client default is applied to this wire field. */
  age_check?: number | null;

  /** Backend age check required value. Optional; no client default is applied to this wire field. */
  age_check_required?: boolean;

  /** Backend pickup ready at value. Optional; no client default is applied to this wire field. */
  pickup_ready_at?: string | null;

  /** Backend pickup deadline at value. Optional; no client default is applied to this wire field. */
  pickup_deadline_at?: string | null;

  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend type value. Required by this wire contract. */
  type: ShopOrderFulfillmentType;

  /** Backend code value. Required by this wire contract. */
  code: string;

  /** Backend name value. Required by this wire contract. */
  name: string;

  /** Backend title value. Optional; no client default is applied to this wire field. */
  title?: string | null;

  /** Price in integer cents. Required by this wire contract. */
  price: number;

  /** Backend status value. The backend remains authoritative. Required by this wire contract. */
  status: ShopOrderFulfillmentStatus;

  /** Backend pickup name value. Optional; no client default is applied to this wire field. */
  pickup_name?: string | null;

  /** Backend pickup address value. Optional; no client default is applied to this wire field. */
  pickup_address?: string | null;

  /** Backend pickup postal code value. Optional; no client default is applied to this wire field. */
  pickup_postal_code?: string | null;

  /** Backend pickup city value. Optional; no client default is applied to this wire field. */
  pickup_city?: string | null;

  /** Backend pickup country value. Optional; no client default is applied to this wire field. */
  pickup_country?: string | null;

  /** Backend pickup location id value. Optional; no client default is applied to this wire field. */
  pickup_location_id?: number | null;

  /** Backend shipping name value. Optional; no client default is applied to this wire field. */
  shipping_name?: string | null;

  /** Backend shipping company name value. Optional; no client default is applied to this wire field. */
  shipping_company_name?: string | null;

  /** Backend shipping address1 value. Optional; no client default is applied to this wire field. */
  shipping_address1?: string | null;

  /** Backend shipping address2 value. Optional; no client default is applied to this wire field. */
  shipping_address2?: string | null;

  /** Backend shipping postal code value. Optional; no client default is applied to this wire field. */
  shipping_postal_code?: string | null;

  /** Backend shipping city value. Optional; no client default is applied to this wire field. */
  shipping_city?: string | null;

  /** Backend shipping country value. Optional; no client default is applied to this wire field. */
  shipping_country?: string | null;

  /** Backend shipping phone value. Optional; no client default is applied to this wire field. */
  shipping_phone?: string | null;

  /** Backend shipping email value. Optional; no client default is applied to this wire field. */
  shipping_email?: string | null;

  /** Backend shipping address id value. Optional; no client default is applied to this wire field. */
  shipping_address_id?: string | null;

  /** Backend shipping carrier name value. Optional; no client default is applied to this wire field. */
  shipping_carrier_name?: string | null;

  /** Backend shipping tracking number value. Optional; no client default is applied to this wire field. */
  shipping_tracking_number?: string | null;

  /** Backend shipping tracking link value. Optional; no client default is applied to this wire field. */
  shipping_tracking_link?: string | null;

  /** Backend pickup location value. Optional; no client default is applied to this wire field. */
  pickup_location?: BackofficeFranchiseLocation | null;
};

/** Public shop order payment wire contract. Values and optionality come from the backend export. */
export type ShopOrderPayment = {
  /** Backend type value. Optional; no client default is applied to this wire field. */
  type?: "VOUCHER" | "STRIPE" | "OTHER";

  /** Voucher code carrying monetary value. Do not expose it to analytics or logs. Optional; no client default is applied to this wire field. */
  voucher_code?: string | null;

  /** Backend payment status value. Required by this wire contract. */
  payment_status: ShopPaymentPaymentStatus;

  /** Backend refunded amount value. Optional; no client default is applied to this wire field. */
  refunded_amount?: number;

  /** Backend promo discount value. Optional; no client default is applied to this wire field. */
  promo_discount?: number;

  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Amount in integer cents. Required by this wire contract. */
  amount: number;

  /** Backend amount subtotal value. Required by this wire contract. */
  amount_subtotal: number;

  /** Backend amount discount value. Required by this wire contract. */
  amount_discount: number;
};

/** Public shop order credit note wire contract. Values and optionality come from the backend export. */
export type ShopOrderCreditNote = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend credit note number value. Optional; no client default is applied to this wire field. */
  credit_note_number?: string | null;

  /** Backend created at value. Required by this wire contract. */
  created_at: string;
};

/** Public customer booking status wire contract. Values and optionality come from the backend export. */
export type CustomerBookingStatus =
  | "CONFIRMED"
  | "VISITED"
  | "PAST"
  | "CANCELLED"
  | "PAYMENT_PENDING"
  | "PAYMENT_FAILED";

/** Public shop booking ticket wire contract. Values and optionality come from the backend export. */
export type ShopBookingTicket = {
  /** Backend check in code value. Optional; no client default is applied to this wire field. */
  check_in_code?: string | null;

  /** Places included in this booking request or response. Required by this wire contract. */
  seats: number;
};

/** Public shop booking location wire contract. Values and optionality come from the backend export. */
export type ShopBookingLocation = {
  /** Backend online party min value. Optional; no client default is applied to this wire field. */
  online_party_min?: number | null;

  /** Backend online party max value. Optional; no client default is applied to this wire field. */
  online_party_max?: number | null;

  /** Backend location name value. Required by this wire contract. */
  location_name: string;

  /** Backend location street value. Optional; no client default is applied to this wire field. */
  location_street?: string | null;

  /** Backend location postal code value. Optional; no client default is applied to this wire field. */
  location_postal_code?: string | null;

  /** Backend location city value. Optional; no client default is applied to this wire field. */
  location_city?: string | null;

  /** Backend location phone value. Optional; no client default is applied to this wire field. */
  location_phone?: string | null;

  /** Backend total seats value. Optional; no client default is applied to this wire field. */
  total_seats?: number;

  /** Backend table reservations enabled value. Optional; no client default is applied to this wire field. */
  table_reservations_enabled?: boolean;

  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Optional; no client default is applied to this wire field. */
  id?: number | null;
};

/** Public shop voucher type wire contract. Values and optionality come from the backend export. */
export type ShopVoucherType = "VALUE" | "TASTING";

/** Public voucher kind wire contract. Values and optionality come from the backend export. */
export type VoucherKind = "NONE" | "SINGLE_PURPOSE" | "MULTI_PURPOSE";

/** Public shop voucher article wire contract. Values and optionality come from the backend export. */
export type ShopVoucherArticle = {
  /** Backend kind value. Optional; no client default is applied to this wire field. */
  kind?: VoucherKind | null;

  /** Backend redeemable for text value. Optional; no client default is applied to this wire field. */
  redeemable_for_text?: string | null;

  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend title value. Required by this wire contract. */
  title: string;

  /** Price in integer cents. Required by this wire contract. */
  price: number;

  /** Backend previous price value. Optional; no client default is applied to this wire field. */
  previous_price?: number | null;

  /** Public event identifier. The backend wire spelling is unchanged. Optional; no client default is applied to this wire field. */
  tasting_id?: number | null;

  /** Backend variant value. Optional; no client default is applied to this wire field. */
  variant?: ShopVoucherArticleVariant | null;
};

/** Public withdrawal item selection wire contract. Values and optionality come from the backend export. */
export type WithdrawalItemSelection = {
  /** Backend opened value. Optional; no client default is applied to this wire field. */
  opened?: boolean;

  /** Backend order item id value. Required by this wire contract. */
  order_item_id: string;

  /** Backend quantity value. Required by this wire contract. */
  quantity: number;
};

/** Public shop order cancellation request status wire contract. Values and optionality come from the backend export. */
export type ShopOrderCancellationRequestStatus =
  | "NOT_FOUND"
  | "PENDING_REVIEW"
  | "WAITING"
  | "ACCEPTED"
  | "DECLINED";

/** Public withdrawal excluded item wire contract. Values and optionality come from the backend export. */
export type WithdrawalExcludedItem = {
  /** Backend title value. Required by this wire contract. */
  title: string;

  /** Backend reason value. Required by this wire contract. */
  reason:
    | "VOUCHER_REDEEMED"
    | "WINDOW_EXPIRED"
    | "BOOKING_ORDER"
    | "PERISHABLE"
    | "UNSEALED";
};

/** Public shop withdrawal request wire contract. Values and optionality come from the backend export. */
export type ShopWithdrawalRequest = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend status value. The backend remains authoritative. Required by this wire contract. */
  status: ShopOrderCancellationRequestStatus;

  /** Backend created at value. Required by this wire contract. */
  created_at: string;

  /** Backend updated at value. Required by this wire contract. */
  updated_at: string;
};

/** Public shop orders shop article wire contract. Values and optionality come from the backend export. */
export type ShopOrdersShopArticle = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend title value. Required by this wire contract. */
  title: string;

  /** Backend category value. Required by this wire contract. */
  category: ShopOrdersShopArticleCategory;

  /** Backend type value. Required by this wire contract. */
  type: ShopArticleType;
};

/** Public shop orders shop article variant wire contract. Values and optionality come from the backend export. */
export type ShopOrdersShopArticleVariant = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend name value. Required by this wire contract. */
  name: string;
};

/** Public shop order fulfillment type wire contract. Values and optionality come from the backend export. */
export type ShopOrderFulfillmentType =
  | "DIGITAL"
  | "PICKUP"
  | "SHIPPING"
  | "DELIVERY";

/** Public shop order fulfillment status wire contract. Values and optionality come from the backend export. */
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

/** Public backoffice franchise location wire contract. Values and optionality come from the backend export. */
export type BackofficeFranchiseLocation = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: number;

  /** Backend location name value. Required by this wire contract. */
  location_name: string;

  /** Backend location street value. Optional; no client default is applied to this wire field. */
  location_street?: string | null;

  /** Backend location postal code value. Optional; no client default is applied to this wire field. */
  location_postal_code?: string | null;

  /** Backend location city value. Optional; no client default is applied to this wire field. */
  location_city?: string | null;

  /** Backend location phone value. Optional; no client default is applied to this wire field. */
  location_phone?: string | null;
};

/** Public shop payment payment status wire contract. Values and optionality come from the backend export. */
export type ShopPaymentPaymentStatus =
  | "PAID"
  | "UNPAID"
  | "NO_PAYMENT_REQUIRED"
  | "REFUND_PENDING"
  | "REFUND_SUCCEEDED"
  | "REFUND_FAILED"
  | "REFUND_CANCELED"
  | "REFUND_REQUIRES_ACTION";

/** Public shop voucher article variant wire contract. Values and optionality come from the backend export. */
export type ShopVoucherArticleVariant = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend name value. Required by this wire contract. */
  name: string;

  /** Price in integer cents. Required by this wire contract. */
  price: number;

  /** Backend previous price value. Optional; no client default is applied to this wire field. */
  previous_price?: number | null;
};

/** Public shop orders shop article category wire contract. Values and optionality come from the backend export. */
export type ShopOrdersShopArticleCategory = {
  /** Backend record identifier. Do not substitute a materialized row ID for timewindow_id. Required by this wire contract. */
  id: string;

  /** Backend name value. Required by this wire contract. */
  name: string;
};

/** Public shop article type wire contract. Values and optionality come from the backend export. */
export type ShopArticleType = "PHYSICAL" | "VOUCHER";

/** Public location wire contract. Values and optionality come from the backend export. */
export type Location = ShopFranchiseLocationResponse;

/** Public timewindow wire contract. Values and optionality come from the backend export. */
export type Timewindow = ShopTimewindowResponse;

/** Public shop settings wire contract. Values and optionality come from the backend export. */
export type ShopSettings = PublicShopSettings;

/** Public booking request wire contract. Values and optionality come from the backend export. */
export type BookingRequest = ShopBookingRequest;

/** Public guest booking request wire contract. Values and optionality come from the backend export. */
export type GuestBookingRequest = ShopGuestBookingRequest;

/** Public booking response wire contract. Values and optionality come from the backend export. */
export type BookingResponse = ShopBookingResponse;

/** Public account login request wire contract. Values and optionality come from the backend export. */
export type AccountLoginRequest = UserLoginRequest;

/** Public account register request wire contract. Values and optionality come from the backend export. */
export type AccountRegisterRequest = ShopUserProfileCreateRequest;

/** Public account profile wire contract. Values and optionality come from the backend export. */
export type AccountProfile = ShopUserProfile;

/** Public account password reset request wire contract. Values and optionality come from the backend export. */
export type AccountPasswordResetRequest = PasswordResetRequest;

/** Public account password set request wire contract. Values and optionality come from the backend export. */
export type AccountPasswordSetRequest = PasswordResetConfirmRequest;

/** Public account email verify request wire contract. Values and optionality come from the backend export. */
export type AccountEmailVerifyRequest = EmailVerificationRequest;

/** Public account email change confirm request wire contract. Values and optionality come from the backend export. */
export type AccountEmailChangeConfirmRequest = EmailChangeConfirmRequest;

/** Public account auth response wire contract. Values and optionality come from the backend export. */
export type AccountAuthResponse = AuthResponse;

/** Public account operations wire contract. Values and optionality come from the backend export. */
export type AccountOperations = {
  /** Backend orders value. Required by this wire contract. */
  orders: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/orders/";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: Array<ShopOrder>;
  };

  /** Backend bookings value. Required by this wire contract. */
  bookings: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/tastings/bookings";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: Array<ShopBookingOrderResponse>;
  };

  /** Backend booking value. Required by this wire contract. */
  booking: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/tastings/bookings/{booking_id}";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: ShopBookingOrderResponse;
  };

  /** Backend move booking value. Required by this wire contract. */
  moveBooking: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/tastings/bookings/{booking_id}/move";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: ShopBookingMoveRequest;

    /** Backend response value. Required by this wire contract. */
    response: unknown;
  };

  /** Backend reservations value. Required by this wire contract. */
  reservations: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/table-reservations";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: Array<CustomerTableReservationResponse>;
  };

  /** Backend reservation value. Required by this wire contract. */
  reservation: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/table-reservations/{reservation_id}";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: CustomerTableReservationResponse;
  };

  /** Backend update reservation value. Required by this wire contract. */
  updateReservation: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/table-reservations/{reservation_id}";

    /** Backend method value. Required by this wire contract. */
    method: "PATCH";

    /** Backend body value. Required by this wire contract. */
    body: CustomerTableReservationUpdate;

    /** Backend response value. Required by this wire contract. */
    response: CustomerTableReservationResponse;
  };

  /** Backend cancel reservation value. Required by this wire contract. */
  cancelReservation: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/table-reservations/{reservation_id}/cancel";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: CustomerTableReservationResponse;
  };

  /** Backend vouchers value. Required by this wire contract. */
  vouchers: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/vouchers/customer";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: Array<ShopVoucherModel>;
  };

  /** Backend voucher value. Required by this wire contract. */
  voucher: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/vouchers/customer/{voucher_id}";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: ShopVoucherModel;
  };

  /** Backend voucher history value. Required by this wire contract. */
  voucherHistory: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/vouchers/customer/{voucher_id}/history";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: Array<ShopVoucherHistoryEntry>;
  };

  /** Backend withdrawal items value. Required by this wire contract. */
  withdrawalItems: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/orders/{order_id}/withdrawal-items";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: Array<WithdrawalItemOption>;
  };

  /** Backend withdraw value. Required by this wire contract. */
  withdraw: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/orders/{order_id}/cancellation-request";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: WithdrawalSelectionRequest | null;

    /** Backend response value. Required by this wire contract. */
    response: CancellationRequestResult;
  };

  /** Backend update profile value. Required by this wire contract. */
  updateProfile: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/profile";

    /** Backend method value. Required by this wire contract. */
    method: "PUT";

    /** Backend body value. Required by this wire contract. */
    body: ShopUserProfileUpdate;

    /** Backend response value. Required by this wire contract. */
    response: ShopUserProfile;
  };

  /** Backend newsletter unsubscribe value. Required by this wire contract. */
  newsletterUnsubscribe: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/newsletter/unsubscribe";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: Record<string, string>;
  };

  /** Backend addresses value. Required by this wire contract. */
  addresses: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/shipping-addresses";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: Array<ShopUserShippingAddress>;
  };

  /** Backend create address value. Required by this wire contract. */
  createAddress: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/shipping-addresses";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: ShopUserShippingAddressRequest;

    /** Backend response value. Required by this wire contract. */
    response: ShopUserShippingAddress;
  };

  /** Backend update address value. Required by this wire contract. */
  updateAddress: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/shipping-addresses/{shipping_address_id}";

    /** Backend method value. Required by this wire contract. */
    method: "PUT";

    /** Backend body value. Required by this wire contract. */
    body: ShopUserShippingAddressRequest;

    /** Backend response value. Required by this wire contract. */
    response: ShopUserShippingAddress;
  };

  /** Backend delete address value. Required by this wire contract. */
  deleteAddress: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/shipping-addresses/{shipping_address_id}";

    /** Backend method value. Required by this wire contract. */
    method: "DELETE";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: Record<string, string>;
  };

  /** Backend update password value. Required by this wire contract. */
  updatePassword: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/password-update";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: PasswordUpdateRequest;

    /** Backend response value. Required by this wire contract. */
    response: Record<string, string>;
  };

  /** Backend update email value. Required by this wire contract. */
  updateEmail: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/update-email";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: EmailChangeRequest;

    /** Backend response value. Required by this wire contract. */
    response: Record<string, string>;
  };

  /** Backend login value. Required by this wire contract. */
  login: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/login";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: UserLoginRequest;

    /** Backend response value. Required by this wire contract. */
    response: AuthResponse;
  };

  /** Backend register value. Required by this wire contract. */
  register: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/register";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: ShopUserProfileCreateRequest;

    /** Backend response value. Required by this wire contract. */
    response: Record<string, string>;
  };

  /** Backend password reset value. Required by this wire contract. */
  passwordReset: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/password-reset";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: PasswordResetRequest;

    /** Backend response value. Required by this wire contract. */
    response: Record<string, string>;
  };

  /** Backend password set value. Required by this wire contract. */
  passwordSet: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/password-reset/confirm";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: PasswordResetConfirmRequest;

    /** Backend response value. Required by this wire contract. */
    response: Record<string, string>;
  };

  /** Backend email verify value. Required by this wire contract. */
  emailVerify: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/verify-email";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: EmailVerificationRequest;

    /** Backend response value. Required by this wire contract. */
    response: Record<string, string>;
  };

  /** Backend email change confirm value. Required by this wire contract. */
  emailChangeConfirm: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/confirm-email-change";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: EmailChangeConfirmRequest;

    /** Backend response value. Required by this wire contract. */
    response: Record<string, string>;
  };

  /** Backend profile value. Required by this wire contract. */
  profile: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/profile";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: ShopUserProfile;
  };

  /** Backend logout value. Required by this wire contract. */
  logout: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/user/logout";

    /** Backend method value. Required by this wire contract. */
    method: "POST";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: Record<string, string>;
  };

  /** Backend settings value. Required by this wire contract. */
  settings: {
    /** Backend path value. Required by this wire contract. */
    path: "/api/shop/settings";

    /** Backend method value. Required by this wire contract. */
    method: "GET";

    /** Backend body value. Required by this wire contract. */
    body: undefined;

    /** Backend response value. Required by this wire contract. */
    response: PublicShopSettings;
  };
};
