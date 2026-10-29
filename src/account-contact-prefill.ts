"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import type { AccountProfile } from "./account-client";

type Contact = { name: string; email: string; phone: string };
const emptyContact: Contact = { name: "", email: "", phone: "" };
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

/** Optional enhancement: the HttpOnly session authenticates this uncached request. */
export async function loadAccountContact({
  enabled = true,
  signal,
}: {
  enabled?: boolean;
  signal?: AbortSignal;
} = {}): Promise<Contact | null> {
  if (!enabled) return null;
  try {
    const response = await fetch("/api/shop/user/profile", {
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal,
    });
    if (!response.ok) return null;
    const profile: Partial<AccountProfile> | null = await response.json();
    if (
      !profile ||
      !Number.isInteger(profile.id) ||
      Number(profile.id) < 1 ||
      typeof profile.email !== "string"
    )
      return null;
    return {
      name:
        text(profile.full_name) ||
        [text(profile.first_name), text(profile.last_name)]
          .filter(Boolean)
          .join(" "),
      email: text(profile.email),
      phone: text(profile.phone),
    };
  } catch {
    return null;
  }
}

/** Each field stays editable, including when the customer types before the response. */
export function useAccountContactPrefill(active = true) {
  const [contact, setContact] = useState<Contact>(emptyContact);
  const edited = useRef(new Set<keyof Contact>());
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void loadAccountContact({
      enabled: active,
      signal: controller.signal,
    }).then((profile) => {
      if (!profile || controller.signal.aborted) return;
      setContact((current) => ({
        name: edited.current.has("name") ? current.name : profile.name,
        email: edited.current.has("email") ? current.email : profile.email,
        phone: edited.current.has("phone") ? current.phone : profile.phone,
      }));
    });
    return () => controller.abort();
  }, [active]);

  const field = (key: keyof Contact) => ({
    value: contact[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      edited.current.add(key);
      const value = event.currentTarget.value;
      setContact((current) => ({ ...current, [key]: value }));
    },
  });
  return { name: field("name"), email: field("email"), phone: field("phone") };
}
