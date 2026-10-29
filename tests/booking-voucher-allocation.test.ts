import { expect, test } from "bun:test";
import { bookingVoucherAllocation } from "../src/booking-flow";
import type { VoucherCheck } from "../src/client";

function voucher(
  code: string,
  remaining_value: number,
  kind = "MULTI_PURPOSE",
): VoucherCheck {
  return { voucher_code: code, remaining_value, kind };
}

test("a value voucher funds all seats up to its balance", () => {
  expect(
    bookingVoucherAllocation([4900, 4900], ["VALUE"], {
      VALUE: voucher("VALUE", 8900),
    }),
  ).toEqual({
    deductions: [{ code: "VALUE", amount: 8900 }],
    pending: false,
    amountToPay: 900,
  });
});

test("a value voucher cannot deduct more than the seat total", () => {
  expect(
    bookingVoucherAllocation([4900, 4900], ["VALUE"], {
      VALUE: voucher("VALUE", 12000),
    }),
  ).toEqual({
    deductions: [{ code: "VALUE", amount: 9800 }],
    pending: false,
    amountToPay: 0,
  });
});

test("a value voucher leaves at least Stripe's minimum positive card charge", () => {
  expect(
    bookingVoucherAllocation([4900, 4900], ["VALUE"], {
      VALUE: voucher("VALUE", 9770),
    }),
  ).toEqual({
    deductions: [{ code: "VALUE", amount: 9750 }],
    pending: false,
    amountToPay: 50,
  });
});

test("the Stripe minimum releases the last value-voucher deduction first", () => {
  expect(
    bookingVoucherAllocation([4900, 4900], ["FIRST", "LAST"], {
      FIRST: voucher("FIRST", 9700),
      LAST: voucher("LAST", 70),
    }),
  ).toEqual({
    deductions: [
      { code: "FIRST", amount: 9700 },
      { code: "LAST", amount: 50 },
    ],
    pending: false,
    amountToPay: 50,
  });
});

test("the Stripe minimum never makes a small value-voucher deduction negative", () => {
  expect(
    bookingVoucherAllocation([4900, 4900], ["FIRST", "LAST"], {
      FIRST: voucher("FIRST", 9770),
      LAST: voucher("LAST", 10),
    }),
  ).toEqual({
    deductions: [
      { code: "FIRST", amount: 9750 },
      { code: "LAST", amount: 0 },
    ],
    pending: false,
    amountToPay: 50,
  });
});

test("a small card remainder without value-voucher funding is unchanged", () => {
  expect(
    bookingVoucherAllocation([4900], ["TASTING"], {
      TASTING: voucher("TASTING", 4870, "SINGLE_PURPOSE"),
    }),
  ).toEqual({
    deductions: [{ code: "TASTING", amount: 4870 }],
    pending: false,
    amountToPay: 30,
  });
  expect(bookingVoucherAllocation([30], [], {}).amountToPay).toBe(30);
});

test("tasting vouchers take their assigned seat before value vouchers", () => {
  expect(
    bookingVoucherAllocation([4900, 4900], ["TASTING", "VALUE"], {
      TASTING: voucher("TASTING", 8000, "SINGLE_PURPOSE"),
      VALUE: voucher("VALUE", 3000),
    }),
  ).toEqual({
    deductions: [
      { code: "TASTING", amount: 4900 },
      { code: "VALUE", amount: 3000 },
    ],
    pending: false,
    amountToPay: 1900,
  });
});

test("a tasting voucher never spills into another seat", () => {
  expect(
    bookingVoucherAllocation([6000, 4000], ["VALUE", "TASTING"], {
      VALUE: voucher("VALUE", 3000),
      TASTING: voucher("TASTING", 9000, "SINGLE_PURPOSE"),
    }),
  ).toEqual({
    deductions: [
      { code: "VALUE", amount: 3000 },
      { code: "TASTING", amount: 4000 },
    ],
    pending: false,
    amountToPay: 3000,
  });
});

test("value vouchers fill a partial tasting seat before the remaining seats", () => {
  expect(
    bookingVoucherAllocation([6000, 4000], ["TASTING", "VALUE"], {
      TASTING: voucher("TASTING", 2000, "SINGLE_PURPOSE"),
      VALUE: voucher("VALUE", 7000, "OTHER"),
    }),
  ).toEqual({
    deductions: [
      { code: "TASTING", amount: 2000 },
      { code: "VALUE", amount: 7000 },
    ],
    pending: false,
    amountToPay: 1000,
  });
});

test("value vouchers follow submit order and leave unneeded vouchers unused", () => {
  expect(
    bookingVoucherAllocation([4900, 4900], ["FIRST", "SECOND"], {
      FIRST: voucher("FIRST", 12000),
      SECOND: voucher("SECOND", 3000),
    }),
  ).toEqual({
    deductions: [
      { code: "FIRST", amount: 9800 },
      { code: "SECOND", amount: 0 },
    ],
    pending: false,
    amountToPay: 0,
  });
});

test("pending codes retain the upper bound with known deductions applied", () => {
  expect(
    bookingVoucherAllocation([4900, 4900], ["WAIT", "VALUE"], {
      WAIT: { voucher_code: "WAIT", pending: true },
      VALUE: voucher("VALUE", 8900),
    }),
  ).toEqual({
    deductions: [
      { code: "WAIT", amount: 0 },
      { code: "VALUE", amount: 8900 },
    ],
    pending: true,
    amountToPay: 900,
  });
});

test("unchecked codes stay pending while restored checks are in flight", () => {
  expect(bookingVoucherAllocation([4900], ["WAIT"], {})).toEqual({
    deductions: [{ code: "WAIT", amount: 0 }],
    pending: true,
    amountToPay: 4900,
  });
});

test("without vouchers the full seat total is payable", () => {
  expect(bookingVoucherAllocation([4900, 5400], [], {})).toEqual({
    deductions: [],
    pending: false,
    amountToPay: 10300,
  });
});
