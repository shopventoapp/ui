import { instanceOrigin, readSmallJson } from "./proxy";

/** Public navigation or location link returned by the instance. */
export interface BrandLink {
  /** Public label supplied by the instance or host. */
  label: string;
  /** Public href supplied by the instance or host. */
  href: string;
  /** Public isExternal supplied by the instance or host. */
  isExternal?: boolean;
}
/** Public instance identity. Absent values leave host fallbacks in effect. */
export interface Branding {
  /** Public brand name supplied by the instance or host. */
  brand_name?: string;
  /** Public logo url supplied by the instance or host. */
  logo_url?: string;
  /** Public logo alt supplied by the instance or host. */
  logo_alt?: string;
  /** Public footer logo url supplied by the instance or host. */
  footer_logo_url?: string;
  /** Public privacy url supplied by the instance or host. */
  privacy_url?: string;
  /** Public imprint url supplied by the instance or host. */
  imprint_url?: string;
  /** Public terms url supplied by the instance or host. */
  terms_url?: string;
  /** Public withdrawal url supplied by the instance or host. */
  withdrawal_url?: string;
  /** Public contact url supplied by the instance or host. */
  contact_url?: string;
  /** Public navigation supplied by the instance or host. */
  navigation?: BrandLink[];
  /** Public location links supplied by the instance or host. */
  location_links?: BrandLink[];
  /** Public colors supplied by the instance or host. */
  colors?: Record<string, string>;
  /** Public fonts supplied by the instance or host. */
  fonts?: Record<string, string>;
  /** Public company supplied by the instance or host. */
  company?: {
    /** Public company phone. */
    phone?: string;
    /** Public company email. */
    email?: string;
  };
}
/** Branding transport options for static builds, Workers and browsers. */
export interface BrandingOptions {
  /** Instance origin on the server; omit in the browser to use the same-origin proxy. */
  apiUrl?: string;
  /** Public fetcher supplied by the instance or host. */
  fetcher?: typeof fetch;
  /** Public signal supplied by the instance or host. */
  signal?: AbortSignal;
}
/** Read bounded public branding JSON. Errors reject so the host can choose its fallback. */
export async function loadBranding(
  options: BrandingOptions = {},
): Promise<Branding> {
  const origin =
    options.apiUrl === undefined ? undefined : instanceOrigin(options.apiUrl);
  if (origin === null) throw new Error("Invalid instance origin");
  const response = await (options.fetcher ?? fetch)(
    origin ? new URL("/api/shop/branding", origin) : "/api/shop/branding",
    {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
      signal: options.signal,
    },
  );
  if (!response.ok)
    throw new Error(`Branding unavailable (${response.status})`);
  const value = await readSmallJson(response, 131072);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid branding response");
  const record = value as Record<string, unknown>;
  const result: Branding = {};
  for (const key of [
    "brand_name",
    "logo_url",
    "logo_alt",
    "footer_logo_url",
    "privacy_url",
    "imprint_url",
    "terms_url",
    "withdrawal_url",
    "contact_url",
  ] as const) {
    if (typeof record[key] === "string") result[key] = record[key].trim();
  }
  for (const key of ["navigation", "location_links"] as const) {
    const links = record[key];
    if (Array.isArray(links))
      result[key] = links.filter(
        (link): link is BrandLink =>
          !!link &&
          typeof link === "object" &&
          typeof link.label === "string" &&
          typeof link.href === "string" &&
          (link.isExternal === undefined ||
            typeof link.isExternal === "boolean"),
      );
  }
  for (const key of ["colors", "fonts", "company"] as const) {
    const values = record[key];
    if (values && typeof values === "object" && !Array.isArray(values))
      result[key] = Object.fromEntries(
        Object.entries(values).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
  }
  return result;
}
/** Backend CSS custom properties mapped onto the package theme contract. */
export const brandingTokenMap = {
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-background": "--brand-bg",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-surface": "--brand-surface",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-surface-2": "--brand-surface",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-text": "--brand-text",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-text-2": "--brand-muted",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-text-3": "--brand-muted",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-primary": "--brand-primary",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-primary-hover": "--brand-primary-hover",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-on-primary": "--brand-on-primary",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-accent": "--brand-link",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-accent-fill": "--brand-accent",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-accent-soft": "--brand-primary-soft",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-font": "--brand-font-body",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-font-display": "--brand-font-heading",
  /** Package token mapped to the corresponding backend theme property. */
  "--sv-font-label": "--brand-font-body",
} as const;
/** Create CSS variable values using backend branding tokens and optional host fallbacks. */
export function brandingTokens(
  fallbacks: Partial<Record<keyof typeof brandingTokenMap, string>> = {},
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(brandingTokenMap).map(([target, source]) => [
      target,
      `var(${source}${fallbacks[target as keyof typeof brandingTokenMap] ? `, ${fallbacks[target as keyof typeof brandingTokenMap]}` : ""})`,
    ]),
  );
}
/** Same-origin stylesheet served by the proxy allowlist. */
export const brandingStylesheet = "/branding/theme.css";
