import {
  BookingApiError,
  type BookingClient,
  type VoucherCheck,
} from "./client";

type CheckedVoucher = VoucherCheck & { rejected?: number };
const interval = 5001;

function wait(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, delay);
    signal.addEventListener("abort", done, { once: true });
    if (signal.aborted) done();
  });
}

/** Serialize public voucher checks below twelve requests per minute, including retries. */
export function createVoucherLookup(
  client: Pick<BookingClient, "checkVoucher">,
  timing = { now: () => performance.now(), wait },
) {
  const cache = new Map<string, CheckedVoucher>();
  const failures = new Map<string, { count: number; after: number }>();
  let next = 0;
  let queue: Promise<unknown> = Promise.resolve();
  return (code: string, signal: AbortSignal): Promise<CheckedVoucher> => {
    const result = queue.then(async () => {
      signal.throwIfAborted();
      const cached = cache.get(code);
      if (cached) return cached;
      const failure = failures.get(code);
      const delay = Math.max(next, failure?.after ?? 0) - timing.now();
      if (delay > 0) await timing.wait(delay, signal);
      signal.throwIfAborted();
      next = timing.now() + interval;
      try {
        const check = await client.checkVoucher(code, signal);
        signal.throwIfAborted();
        if (!check.pending) cache.set(code, check);
        failures.delete(code);
        return check;
      } catch (error) {
        signal.throwIfAborted();
        if (
          error instanceof BookingApiError &&
          (error.status < 500 || error.status >= 600)
        ) {
          const check = {
            voucher_code: code,
            remaining_value: 0,
            rejected: error.status,
          };
          cache.set(code, check);
          return check;
        }
        const count = (failure?.count ?? 0) + 1;
        failures.set(code, {
          count,
          after: timing.now() + Math.min(60000, interval * 2 ** (count - 1)),
        });
        return { voucher_code: code, pending: true };
      }
    });
    queue = result.catch(() => {});
    return result;
  };
}

const lookups = new WeakMap<
  BookingClient,
  ReturnType<typeof createVoucherLookup>
>();

/** Reuse pacing and definitive results across compact forms sharing a client. */
export function voucherLookupFor(client: BookingClient) {
  let lookup = lookups.get(client);
  if (!lookup) {
    lookup = createVoucherLookup(client);
    lookups.set(client, lookup);
  }
  return lookup;
}
