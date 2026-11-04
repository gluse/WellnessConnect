import { useEffect, useRef, useState } from "react";
import { useFormLocale } from "@/components/forms-locale";
import { formatDateTime24 } from "@/lib/date-time";
import { Button } from "@/components/ui/button";
import { BillingClientError, parseBillingStatus, parseHostedResult, type BillingScope, type MonthlyBillingStatus, type MonthlyBillingTransport } from "@/lib/monthly-billing";

type Props = BillingScope & { transport?: MonthlyBillingTransport; returned?: boolean; navigate?: (url: string) => void };
export default function MonthlyBillingPanel(props: Props) {
  // Remount immediately on identity/workspace changes, before any effect cleanup.
  return <ScopedBillingPanel key={JSON.stringify([props.actorId, props.target.kind, props.target.id])} {...props} />;
}

function ScopedBillingPanel({ actorId, target, transport, returned = false, navigate = url => window.location.assign(url) }: Props) {
  const { t, language } = useFormLocale();
  const [status, setStatus] = useState<MonthlyBillingStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(transport));
  const [busy, setBusy] = useState(false), [accepted, setAccepted] = useState(false);
  const [error, setError] = useState(""), [pending, setPending] = useState(returned);
  const sequence = useRef(0), request = useRef<AbortController>(), locked = useRef(false);
  const uncertain = useRef(false), checkoutKey = useRef<string>();
  const readsForPending = useRef(0), latestRead = useRef<() => Promise<void>>();
  const activeTransport = useRef(transport);
  const scope = { actorId, target };
  const date = (value: string) => formatDateTime24(value, language, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  function message(err: unknown) {
    return err instanceof BillingClientError ? `monthlyBilling.${err.code}` : "monthlyBilling.loadError";
  }
  async function read() {
    if (!transport || locked.current) return;
    request.current?.abort();
    const controller = new AbortController(), generation = ++sequence.current;
    request.current = controller;
    setLoading(true); setError(""); setStatus(null); setAccepted(false); setPending(false);
    try {
      const next = parseBillingStatus(await transport.read(scope, controller.signal), target);
      if (controller.signal.aborted || generation !== sequence.current) return;
      if (next.operation === "none" && next.capabilities.checkout && next.offer) {
        uncertain.current = false; checkoutKey.current = undefined;
      }
      setStatus(next); setPending(next.operation === "pending" || next.operation === "unknown" || next.state === "pending");
    } catch (err) {
      if (!controller.signal.aborted && generation === sequence.current) setError(message(err));
    } finally {
      if (!controller.signal.aborted && generation === sequence.current) setLoading(false);
    }
  }
  latestRead.current = read;
  useEffect(() => {
    activeTransport.current = transport;
    setStatus(null); setAccepted(false); setError(""); setBusy(false); locked.current = false;
    void read();
    return () => { sequence.current++; request.current?.abort(); };
  }, [transport]);
  useEffect(() => {
    if (!transport || typeof window === "undefined" || typeof document === "undefined") return;
    const refresh = () => { if (document.visibilityState !== "hidden") void latestRead.current?.(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [transport]);
  useEffect(() => {
    if (!transport || !status) return;
    const until = status.effectiveAccess.until;
    const expiry = status.effectiveAccess.hasPro && until ? Math.max(0, Date.parse(until) - Date.now() + 1) : Infinity;
    const shouldPoll = (pending || returned) && readsForPending.current < 8 && (status.operation === "pending" || status.operation === "unknown" || status.state === "pending");
    const delay = Math.min(expiry, shouldPoll ? 3000 : Infinity);
    if (!Number.isFinite(delay)) return;
    const timer = setTimeout(() => { if (shouldPoll) readsForPending.current++; void latestRead.current?.(); }, Math.min(delay, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [status, transport, pending, returned]);
  async function action(kind: "checkout" | "portal") {
    if (!transport || !status || locked.current || loading) return;
    if (kind === "checkout" && (!status.capabilities.checkout || !status.offer || !accepted || status.operation !== "none" || status.unavailableReason || uncertain.current)) return;
    if (kind === "portal" && !status.capabilities.manage && !status.capabilities.recover) return;
    locked.current = true; setBusy(true); setError("");
    request.current?.abort(); const controller = new AbortController(), generation = ++sequence.current;
    request.current = controller;
    if (kind === "checkout") { uncertain.current = true; checkoutKey.current ??= crypto.randomUUID(); }
    try {
      const result = kind === "checkout"
        ? await transport.checkout(scope, { termsVersion: status.offer!.termsVersion, offerRevision: status.offer!.offerRevision, idempotencyKey: checkoutKey.current! }, controller.signal)
        : await transport.portal(scope, controller.signal);
      if (controller.signal.aborted || generation !== sequence.current) return;
      const url = parseHostedResult(result, target, transport.hostedOrigins);
      setPending(true);
      if (url) navigate(url);
    } catch (err) {
      if (!controller.signal.aborted && generation === sequence.current) {
        // A timeout cannot prove checkout failed. Never retry a financial mutation automatically.
        if (err instanceof BillingClientError && ["denied", "unauthorized"].includes(err.code)) { setStatus(null); setPending(false); }
        if (err instanceof BillingClientError && err.code === "conflict") { setStatus(null); setAccepted(false); }
        setError(kind === "checkout" && !(err instanceof BillingClientError) ? "monthlyBilling.unknown" : message(err));
      }
    } finally {
      if (!controller.signal.aborted && generation === sequence.current) { locked.current = false; setBusy(false); }
    }
  }
  const visible = activeTransport.current === transport ? status : null;
  const unavailable = !transport;
  return <section aria-labelledby="monthly-billing-title" className="monthly-billing space-y-4 rounded-xl border bg-card text-card-foreground p-4 sm:p-6 min-w-0 break-words">
    <h2 id="monthly-billing-title" className="text-xl font-semibold">{t("monthlyBilling.title")}</h2>
    <p>{t("monthlyBilling.workspace")}</p>
    {unavailable ? <p role="status">{t("monthlyBilling.unavailable")}</p> : <>
      {returned && <p>{t("monthlyBilling.returned")}</p>}
      <div role="status" aria-live="polite" aria-busy={loading || busy}>
        {loading ? t("monthlyBilling.loading") : busy ? t("monthlyBilling.opening") : pending ? t("monthlyBilling.pending") : null}
      </div>
      {visible && <>
        <p className="font-semibold">{t(`monthlyBilling.state_${visible.state}`)}</p>
        <p>{t(visible.effectiveAccess.hasPro ? "monthlyBilling.accessActive" : "monthlyBilling.accessInactive")}</p>
        {visible.operation === "unknown" && <p>{t("monthlyBilling.unknown")}</p>}
        {visible.operation === "unavailable" && <p>{t("monthlyBilling.unavailable")}</p>}
        {visible.unavailableReason === "manual_grant" && <p>{t("monthlyBilling.manualWait")}</p>}
        {visible.unavailableReason === "not_ready" && <p>{t("monthlyBilling.unavailable")}</p>}
        <dl className="space-y-3">
          {(["manualUntil", "paidThrough"] as const).map(field => <div key={field}>
            <dt className="font-medium">{t(`monthlyBilling.${field}`)}</dt><dd>{visible[field] ? <time dateTime={visible[field]!}>{date(visible[field]!)} UTC</time> : t("monthlyBilling.noConfirmedDate")}</dd>
          </div>)}
          <div><dt className="font-medium">{t("monthlyBilling.effectiveUntil")}</dt><dd>{visible.effectiveAccess.until ? <time dateTime={visible.effectiveAccess.until}>{date(visible.effectiveAccess.until)} UTC</time> : t("monthlyBilling.noConfirmedDate")}</dd></div>
        </dl>
        {visible.cancelAtPeriodEnd && <p>{t("monthlyBilling.canceling")}</p>}
        {visible.offer && visible.capabilities.checkout && visible.operation === "none" && !visible.unavailableReason && !uncertain.current && <div className="space-y-3 border-t pt-4">
          <p className="text-lg font-semibold">{t("monthlyBilling.monthlyPrice", { price: new Intl.NumberFormat(language, { style: "currency", currency: visible.offer.currency }).format(Number(visible.offer.amount)) })}</p>
          <p>{visible.offer.taxDisclosure}</p><p>{visible.offer.termsText}</p>
          <label className="flex gap-3 min-h-11 items-start py-2"><input type="checkbox" className="mt-1 shrink-0" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy || loading} /><span>{t("monthlyBilling.acceptTerms")}</span></label>
          <Button className="min-h-11 h-auto whitespace-normal" type="button" disabled={!accepted || busy || loading} onClick={() => void action("checkout")}>{t("monthlyBilling.checkout")}</Button>
        </div>}
        {(visible.capabilities.manage || visible.capabilities.recover) && <Button className="min-h-11 h-auto whitespace-normal" type="button" disabled={busy || loading} onClick={() => void action("portal")}>{t(visible.capabilities.recover ? "monthlyBilling.recover" : "monthlyBilling.manage")}</Button>}
      </>}
      {error && <p role="alert">{t(error)}</p>}
      <Button className="min-h-11 h-auto whitespace-normal" type="button" variant="outline" disabled={busy || loading} onClick={() => void read()}>{t("monthlyBilling.refresh")}</Button>
    </>}
  </section>;
}
