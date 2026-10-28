import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createBillingRuntime, readBillingCapabilities, type BillingCapabilities } from "@/lib/billing-http";

// Safe default for logged-out, disabled, missing or invalid server capability responses.
export const dormantBillingRuntime = createBillingRuntime({ subscriptionsReady: false, administrationReady: false, hostedOrigins: [] });
export const BillingRuntimeContext = createContext(dormantBillingRuntime);
export const useBillingRuntime = () => useContext(BillingRuntimeContext);

export function BillingRuntimeProvider({ identityId, children, fetcher }: {
  identityId: string | null; children: ReactNode; fetcher?: typeof fetch;
}) {
  return <ScopedBillingRuntime key={identityId ?? "signed-out"} identityId={identityId} fetcher={fetcher}>{children}</ScopedBillingRuntime>;
}

function ScopedBillingRuntime({ identityId, children, fetcher }: {
  identityId: string | null; children: ReactNode; fetcher?: typeof fetch;
}) {
  const [capabilities, setCapabilities] = useState<BillingCapabilities | null>(null);
  const source = useRef(fetcher);
  useEffect(() => {
    source.current = fetcher;
    setCapabilities(null);
    if (!identityId) return;
    let controller: AbortController | undefined, disposed = false, sequence = 0;
    const refresh = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal, generation = ++sequence;
      try {
        const next = await readBillingCapabilities(signal, fetcher);
        if (disposed || signal.aborted || generation !== sequence) return;
        // Unchanged readiness preserves transport identity and unsaved admin drafts.
        setCapabilities(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      } catch {
        if (!disposed && !signal.aborted && generation === sequence) setCapabilities(null);
      }
    };
    void refresh();
    const focus = () => { void refresh(); };
    if (typeof window !== "undefined") window.addEventListener("focus", focus);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", focus);
    return () => {
      disposed = true; sequence++; controller?.abort();
      if (typeof window !== "undefined") window.removeEventListener("focus", focus);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", focus);
    };
  }, [identityId, fetcher]);
  const runtime = useMemo(() => capabilities && source.current === fetcher
    ? createBillingRuntime(capabilities, fetcher) : dormantBillingRuntime, [capabilities, fetcher]);
  return <BillingRuntimeContext.Provider value={runtime}>{children}</BillingRuntimeContext.Provider>;
}
