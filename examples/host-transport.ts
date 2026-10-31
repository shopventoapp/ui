import { brandingTokens, loadBranding } from "@shopvento/ui/branding";
import { createWorkerShopProxy } from "@shopvento/ui/proxy";
import { createNodeShopProxy } from "@shopvento/ui/proxy/node";

export const worker = createWorkerShopProxy({
  apiUrl: "https://instance.example",
  trustVisitorIp: true,
});
export const nodeHandler = createNodeShopProxy({
  origin: "https://shop.example",
  apiUrl: "https://instance.example",
});
export const loadStaticBranding = () =>
  loadBranding({ apiUrl: "https://instance.example" });
export const loadBrowserBranding = (signal: AbortSignal) =>
  loadBranding({ signal });
export const theme = brandingTokens({ "--sv-primary": "#351c45" });
