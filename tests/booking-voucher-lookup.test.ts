import { expect, test } from "bun:test";
import { createVoucherLookup } from "../src/booking-voucher-lookup";
import { BookingApiError } from "../src/client";

function fixture(status?: number) {
  let now = 0;
  const starts: number[] = [];
  const lookup = createVoucherLookup(
    {
      checkVoucher: async (code: string) => {
        starts.push(now);
        if (status === 0) throw new TypeError("Network unavailable");
        if (status) throw new BookingApiError(status, "Unavailable");
        return { voucher_code: code, remaining_value: 100 };
      },
    },
    {
      now: () => now,
      wait: async (delay) => {
        now += delay;
      },
    },
  );
  return { lookup, starts };
}

test("thirteen concurrent voucher codes cannot exceed twelve starts per minute", async () => {
  const { lookup, starts } = fixture();
  await Promise.all(
    Array.from({ length: 13 }, (_, i) =>
      lookup(`CODE${i}`, new AbortController().signal),
    ),
  );
  expect(starts).toHaveLength(13);
  for (let i = 1; i < starts.length; i++)
    expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(5001);
  expect(starts[12] - starts[0]).toBeGreaterThan(60000);
});

test.each([0, 503])(
  "transient failure %s backs off on repeated manual retries",
  async (status) => {
    const { lookup, starts } = fixture(status);
    for (let i = 0; i < 4; i++)
      expect(
        (await lookup("CODE1", new AbortController().signal)).pending,
      ).toBe(true);
    expect(starts).toEqual([0, 5001, 15003, 35007]);
  },
);

test.each([400, 404, 408, 429])(
  "HTTP %s is cached and not retried",
  async (status) => {
    const { lookup, starts } = fixture(status);
    for (let i = 0; i < 3; i++)
      expect(
        (await lookup("CODE1", new AbortController().signal)).rejected,
      ).toBe(status);
    expect(starts).toHaveLength(1);
  },
);

test("an aborted queued lookup never reaches the endpoint", async () => {
  const { lookup, starts } = fixture();
  const controller = new AbortController();
  const result = lookup("CODE1", controller.signal);
  controller.abort();
  await expect(result).rejects.toThrow();
  expect(starts).toHaveLength(0);
});
