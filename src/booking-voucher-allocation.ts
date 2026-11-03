import type { VoucherCheck } from "./client";

/** Apply checked event vouchers to assigned seats, then value vouchers in submission order. Backend totals remain authoritative.
 * @param seatPrices - Per-seat prices in integer cents.
 * @param orderedCodes - Voucher codes in submission order.
 * @param checks - Public lookup results keyed by voucher code. */
export function bookingVoucherAllocation(
  seatPrices: readonly number[],
  orderedCodes: readonly string[],
  checks: Readonly<Record<string, VoucherCheck>>,
) {
  const remaining = [...seatPrices];
  const deductions = orderedCodes.map((code) => ({
    /** Voucher code used for this deduction. */
    code,
    /** Amount deducted in integer cents. */
    amount: 0,
  }));
  let pending = false;
  for (const [index, code] of orderedCodes.entries()) {
    const check = checks[code];
    if (!check || check.pending) {
      pending = true;
      continue;
    }
    if (check.kind === "SINGLE_PURPOSE") {
      const amount = Math.min(
        Math.max(0, check.remaining_value ?? 0),
        remaining[index] ?? 0,
      );
      deductions[index].amount = amount;
      if (index < remaining.length) remaining[index] -= amount;
    }
  }
  for (const [index, code] of orderedCodes.entries()) {
    const check = checks[code];
    if (!check || check.pending || check.kind === "SINGLE_PURPOSE") continue;
    let balance = Math.max(0, check.remaining_value ?? 0);
    for (let seat = 0; seat < remaining.length && balance > 0; seat++) {
      const amount = Math.min(balance, remaining[seat]);
      remaining[seat] -= amount;
      balance -= amount;
      deductions[index].amount += amount;
    }
  }
  let amountToPay = remaining.reduce((sum, amount) => sum + amount, 0);
  if (amountToPay > 0 && amountToPay < 50) {
    // Release value-voucher funding in reverse order for Stripe's minimum charge.
    for (
      let index = deductions.length - 1;
      index >= 0 && amountToPay < 50;
      index--
    ) {
      if (checks[deductions[index].code]?.kind === "SINGLE_PURPOSE") continue;
      const released = Math.min(deductions[index].amount, 50 - amountToPay);
      deductions[index].amount -= released;
      amountToPay += released;
    }
  }
  return {
    /** Deductions returned by bookingVoucherAllocation. */
    deductions,
    /** Whether booking submission is in progress. */
    pending,
    /** Amount to pay returned by bookingVoucherAllocation. */
    amountToPay,
  };
}
