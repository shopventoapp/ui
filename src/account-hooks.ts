"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccountApiError,
  type AccountClient,
  type AccountProfile,
  accountErrorMessage,
} from "./account-client";
/** The profile is authoritative; readable hint cookies never establish a session. */
export function useAccountSession(client: AccountClient) {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const readController = useRef<AbortController | null>(null);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Revision triggers an explicit session refresh.
  useEffect(() => {
    const controller = new AbortController();
    readController.current = controller;
    setLoading(true);
    setError(null);
    setProfile(null);
    client
      .getProfile(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setProfile(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(accountErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [client, revision]);
  const logout = useCallback(async () => {
    // A profile read started before logout must never restore the session.
    readController.current?.abort();
    setLoading(false);
    try {
      await client.logout();
      setProfile(null);
      setError(null);
    } catch (cause) {
      if (cause instanceof AccountApiError && cause.status === 401)
        setProfile(null);
      setError(accountErrorMessage(cause));
      throw cause;
    }
  }, [client]);
  return {
    /** Authoritative customer profile, or null. */
    profile,
    /** Whether an authoritative profile is loaded. */
    authenticated: profile !== null,
    /** Whether the read is pending. */
    loading,
    /** Customer-visible error, or null. */
    error,
    /** Reload the resource from its authoritative API. */
    reload,
    /** Invalidate the current host session. */
    logout,
  };
}
