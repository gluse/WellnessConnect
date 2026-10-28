import { useEffect, useRef, useState } from "react";
import { accountSearchLocation, forgetGuestLocation, readGuestLocation, resolveSearchLocation, saveGuestLocation, type ResolvedSearchLocation } from "@/lib/saved-search-location";
import type { SearchLocationPreference } from "@shared/search-location";

// The search page is keyed by account identity. Late callbacks cannot apply to
// another user, and cleanup aborts account preference reads/writes.
export function useSearchLocation(userId: string | null) {
  const [location, setLocation] = useState<ResolvedSearchLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const requests = useRef(new Set<AbortController>());
  const persisted = useRef<SearchLocationPreference | null>();
  useEffect(() => () => { generation.current++; requests.current.forEach(request => request.abort()); }, []);
  useEffect(() => {
    const controller = new AbortController(); requests.current.add(controller);
    const current = ++generation.current;
    const active = () => !controller.signal.aborted && current === generation.current;
    setLoading(true); setError(undefined);
    void (async () => {
      try {
        let preference = userId ? await accountSearchLocation("GET", controller.signal) : readGuestLocation();
        if (!active()) return;
        if (userId) {
          if (!preference) {
            const guest = readGuestLocation();
            if (guest) {
              preference = await accountSearchLocation("POST", controller.signal, guest);
              if (!active()) return;
            }
          }
          forgetGuestLocation();
        }
        if (active()) persisted.current = preference;
        const resolved = preference ? await resolveSearchLocation(preference) : null;
        if (active()) { setLocation(resolved); setRemember(!!preference); }
      } catch { if (active()) setError("searchLocation.restoreFailed"); }
      finally { requests.current.delete(controller); if (active()) setLoading(false); }
    })();
    return () => { controller.abort(); requests.current.delete(controller); };
  }, [userId, revision]);

  async function choose(target: ResolvedSearchLocation) {
    const current = ++generation.current;
    setSaving(true);
    setLocation(target); setError(undefined); setLoading(false);
    const controller = new AbortController(); requests.current.add(controller);
    try {
      const desired = remember ? target.preference : null;
      if (JSON.stringify(desired) === JSON.stringify(persisted.current)) return;
      if (userId) {
        await accountSearchLocation(remember ? "PUT" : "DELETE", controller.signal, remember ? target.preference : undefined);
        if (!controller.signal.aborted) forgetGuestLocation();
      } else if (remember) saveGuestLocation(target.preference);
      else forgetGuestLocation();
      if (!controller.signal.aborted && current === generation.current) persisted.current = desired;
    } catch { if (!controller.signal.aborted && current === generation.current) setError("searchLocation.saveFailed"); }
    finally { requests.current.delete(controller); if (!controller.signal.aborted && current === generation.current) setSaving(false); }
  }
  async function forget() {
    const current = ++generation.current;
    setSaving(true);
    setLocation(null); setRemember(false); setError(undefined); setLoading(false);
    forgetGuestLocation();
    const controller = new AbortController(); requests.current.add(controller);
    try {
      if (userId) await accountSearchLocation("DELETE", controller.signal);
      if (!controller.signal.aborted && current === generation.current) persisted.current = null;
    }
    catch { if (!controller.signal.aborted && current === generation.current) setError("searchLocation.forgetFailed"); }
    finally { requests.current.delete(controller); if (!controller.signal.aborted && current === generation.current) setSaving(false); }
  }
  return { location, loading, saving, remember, setRemember, error, choose, forget, retry: () => {
    if (error === "searchLocation.saveFailed" && location) return choose(location);
    if (error === "searchLocation.forgetFailed") return forget();
    setRevision(value => value + 1);
  } };
}
