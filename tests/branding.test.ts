import { expect, test } from "bun:test";
import {
  brandingStylesheet,
  brandingTokens,
  loadBranding,
} from "../src/branding";

test("branding works at build and Worker time with an explicit instance and in browsers with a relative URL", async () => {
  for (const apiUrl of [undefined, "https://instance.example"]) {
    const result = await loadBranding({
      apiUrl,
      fetcher: (async (url: RequestInfo | URL, init?: RequestInit) => {
        expect(String(url)).toBe(
          apiUrl ? `${apiUrl}/api/shop/branding` : "/api/shop/branding",
        );
        expect(init?.credentials).toBe("same-origin");
        expect(init?.redirect).toBe("manual");
        return Response.json({
          brand_name: " Studio ",
          logo_url: "/logo.svg",
          colors: { primary: "#123", invalid: 1 },
          fonts: { heading: "Studio" },
          navigation: [{ label: "Shop", href: "/shop" }, { href: 1 }],
          company: { phone: "123", email: "hello@example.com" },
          unexpected: "ignored",
        });
      }) as unknown as typeof fetch,
    });
    expect(result).toEqual({
      brand_name: "Studio",
      logo_url: "/logo.svg",
      colors: { primary: "#123" },
      fonts: { heading: "Studio" },
      navigation: [{ label: "Shop", href: "/shop" }],
      company: { phone: "123", email: "hello@example.com" },
    });
  }
});
test("branding rejects invalid origins, status codes, oversized and malformed responses", async () => {
  for (const apiUrl of [
    "https://user:secret@instance.example",
    "http://instance.example",
    "https://instance.example/path",
  ])
    await expect(loadBranding({ apiUrl })).rejects.toThrow("origin");
  for (const response of [
    Response.json({}, { status: 503 }),
    Response.json([]),
    new Response('"' + "a".repeat(131073) + '"'),
  ])
    await expect(
      loadBranding({
        fetcher: (async () => response) as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
});
test("branding maps backend tokens with host fallbacks without interpolating API values into CSS", () => {
  expect(brandingStylesheet).toBe("/branding/theme.css");
  expect(brandingTokens({ "--sv-primary": "#123" })["--sv-primary"]).toBe(
    "var(--brand-primary, #123)",
  );
  expect(brandingTokens()["--sv-font-display"]).toBe(
    "var(--brand-font-heading)",
  );
});
