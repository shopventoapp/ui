import { createBookingClient, voucherCodeFromQuery } from "@shopvento/ui";

const client = createBookingClient({
  baseUrl: "https://your-installation.shopvento.app",
});

export async function inspectVoucher(search: string, signal?: AbortSignal) {
  const code = voucherCodeFromQuery(
    new URLSearchParams(search).get("gutschein"),
  );
  if (!code) return null;
  return client.checkVoucher(code, signal);
}
