"use client";
import { type ComponentType, useEffect } from "react";
import type { LocaleOptions } from "./locale";
/** Runtime routing for public forms. Legacy transports are an optional host compatibility bridge. */
export interface PublicFormApiConfig {
  /** Use the Shopvento public endpoints when true. */
  shopvento: boolean;
  /** Location identifier for table reservations. */
  locationId: number | null;
}
/** Common copy, privacy and script integration for public forms. */
export interface PublicFormOptions extends LocaleOptions {
  /** Runtime public configuration. Defaults to Shopvento; provide a location ID for reservations. */
  publicApi?: () => Promise<PublicFormApiConfig>;
  /** Optional host script loader, e.g. a framework-managed script component. */
  ScriptComponent?: ComponentType<{
    /** URL of the public challenge script. */
    src: string;
    /** Hint for host script managers to defer loading until hydration. */
    strategy?: "afterInteractive";
  }>;
  /** Partial German message overrides keyed by default text. Placeholders use {0}, {1}, etc. */
  labels?: Partial<Record<string, string>>;
  /** Privacy policy route. */
  privacyUrl?: string;
}
export const defaultPublicFormApi = async (): Promise<PublicFormApiConfig> => ({
  shopvento: true,
  locationId: null,
});
export function PublicFormScript({
  src,
}: {
  src: string;
  strategy?: "afterInteractive";
}) {
  useEffect(() => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.head.append(script);
  }, [src]);
  return null;
}
