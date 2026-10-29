"use client";
import { type ComponentType, useEffect } from "react";
/** Runtime routing for public forms. Legacy transports are an optional host compatibility bridge. */
export interface PublicFormApiConfig {
  /** Use the Shopvento public endpoints when true. */
  shopvento: boolean;
  /** Location identifier for table reservations. */
  locationId: number | null;
}
/** Common copy, privacy and script integration for public forms. */
export interface PublicFormOptions {
  /** Runtime public configuration. Defaults to Shopvento; provide a location ID for reservations. */
  publicApi?: () => Promise<PublicFormApiConfig>;
  /** Optional host script loader, e.g. a framework-managed script component. */
  ScriptComponent?: ComponentType<{
    /** Src for this public form or flow. */
    src: string;
    /** Strategy for this public form or flow. */
    strategy?: "afterInteractive";
  }>;
  /** Partial German message overrides keyed by default text. Placeholders use {0}, {1}, etc. */
  labels?: Partial<Record<string, string>>;
  /** Privacy policy route. */
  privacyUrl?: string;
}
/** Default Public Form Api for this public form or flow. */
export const defaultPublicFormApi = async (): Promise<PublicFormApiConfig> => ({
  shopvento: true,
  locationId: null,
});
/** Public Form Script for this public form or flow. */
export function PublicFormScript({
  src,
}: {
  /** Src for this public form or flow. */
  src: string;
  /** Strategy for this public form or flow. */
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
