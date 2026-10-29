# Vouchers

Booking accepts one voucher code per seat. Use `createBookingClient().checkVoucher` to inspect a public code before submission. A check is advisory: the booking endpoint validates and redeems codes atomically.

<!-- example:examples/vouchers.ts -->

A public check can omit the balance. In the multi-step flow, legacy codes that return 404 or rate-limited checks remain pending for backend validation. Depleted or inapplicable checked vouchers are rejected. Never promise a final payable amount from an unconfirmed code.

## Allocation and prefilling

`bookingVoucherAllocation` first applies checked event vouchers to their assigned seats, then distributes known value-voucher balances across the remaining seats in submission order. The backend and payment provider remain authoritative for the final total.

Read a host `gutschein` query parameter through `voucherCodeFromQuery` before passing it as `BookingFlow.initialVoucherCode`. The helper rejects markup, control characters and values over 100 characters. Prefilling does not validate or redeem a code.

Voucher codes carry monetary value. Drafts may contain them in plain tab-scoped sessionStorage; do not copy them into analytics, logs or return-page URLs. The local result snapshot excludes codes.

## Customer vouchers

`AccountVouchers` and `AccountVoucherDetail` use `createDashboardClient` through the [same-origin account proxy](/guides/customer-account/). Detail routes carry opaque voucher IDs. The existing public voucher PDF necessarily includes the code. No voucher claiming, gift transfer or expiry workflow is provided.

Hosts supply account voucher nouns through `AccountLabels`. Set `eventVoucherSingular` for singular wording; its fallback is the German word for voucher. See [labels and copy](/guides/labels/).
