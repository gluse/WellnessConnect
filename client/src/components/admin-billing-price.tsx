import { useEffect, useRef, useState } from "react";
import { useFormLocale } from "@/components/forms-locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BillingClientError } from "@/lib/monthly-billing";
import { adminBillingOfferSchema, normalizeMonthlyAmount, type AdminBillingOffer, type AdminPricingTransport } from "@/lib/billing-http";

type Props = { actorId: string; authorized: boolean; transport?: AdminPricingTransport; onAccessError?: (error: Error) => void };
export default function AdminBillingPrice(props: Props) {
  return <ScopedPriceEditor key={JSON.stringify([props.actorId, props.authorized])} {...props} />;
}
function ScopedPriceEditor({ authorized, transport, onAccessError }: Props) {
  const { t } = useFormLocale();
  const [offer, setOffer] = useState<AdminBillingOffer | null>(null), [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const [invalid, setInvalid] = useState(false), [needsRefresh, setNeedsRefresh] = useState(false);
  const generation = useRef(0), pending = useRef<AbortController>(), locked = useRef(false), currentTransport = useRef(transport);
  const input = useRef<HTMLInputElement>(null), alert = useRef<HTMLParagraphElement>(null);
  const fail = (cause: unknown) => {
    setSaved(false);
    const code = cause instanceof BillingClientError ? cause.code : "unavailable";
    setError(`monthlyBilling.price_${code}`);
    if (code === "unauthorized" || code === "denied") { setOffer(null); setDraft(""); onAccessError?.(new Error(`${code === "unauthorized" ? 401 : 403}: Billing access denied`)); }
    requestAnimationFrame(() => alert.current?.focus());
  };
  const parse = (value: unknown) => {
    const result = adminBillingOfferSchema.safeParse(value);
    if (!result.success) throw new BillingClientError("invalid");
    return result.data;
  };
  async function load() {
    if (!authorized || !transport || locked.current) return;
    const controller = new AbortController(), version = ++generation.current;
    pending.current?.abort(); pending.current = controller; locked.current = true;
    setBusy(true); setError(""); setSaved(false); setOffer(null); setDraft(""); setInvalid(false);
    try {
      const next = parse(await transport.read(controller.signal));
      if (controller.signal.aborted || generation.current !== version) return;
      setOffer(next); setDraft(next.amount); setNeedsRefresh(false);
    } catch (cause) { if (!controller.signal.aborted && generation.current === version) fail(cause); }
    finally { if (!controller.signal.aborted && generation.current === version) { locked.current = false; setBusy(false); } }
  }
  useEffect(() => {
    currentTransport.current = transport; setOffer(null); setDraft(""); setError(""); locked.current = false; setBusy(false);
    void load();
    return () => { generation.current++; pending.current?.abort(); };
  }, [transport, authorized]);
  async function save() {
    if (!authorized || !transport || !offer || locked.current || needsRefresh) return;
    const amount = normalizeMonthlyAmount(draft);
    if (!amount) { setInvalid(true); setError("monthlyBilling.price_invalid"); setSaved(false); input.current?.focus(); return; }
    const controller = new AbortController(), version = ++generation.current;
    pending.current?.abort(); pending.current = controller; locked.current = true;
    setBusy(true); setError(""); setSaved(false); setInvalid(false);
    try {
      const next = parse(await transport.save({ amount, expectedRevision: offer.revision }, controller.signal));
      if (controller.signal.aborted || generation.current !== version) return;
      if (next.amount !== amount || Number(next.revision) < Number(offer.revision) ||
        (amount !== offer.amount && next.revision === offer.revision)) throw new BillingClientError("invalid");
      setOffer(next); setDraft(next.amount); setSaved(true);
    } catch (cause) {
      if (!controller.signal.aborted && generation.current === version) { setNeedsRefresh(true); fail(cause); }
    } finally { if (!controller.signal.aborted && generation.current === version) { locked.current = false; setBusy(false); } }
  }
  const visible = currentTransport.current === transport ? offer : null;
  return <section aria-labelledby="billing-price-title" className="billing-price phase3-form rounded-xl border bg-card text-card-foreground p-4 sm:p-6 space-y-4 min-w-0">
    <h2 id="billing-price-title" className="text-lg font-semibold">{t("monthlyBilling.priceTitle")}</h2>
    <p>{t("monthlyBilling.priceScope")}</p>
    {!authorized ? <p role="alert">{t("monthlyBilling.price_denied")}</p> : !transport ? <p role="status">{t("monthlyBilling.priceUnavailable")}</p> : <>
      {busy && <p role="status">{t("monthlyBilling.priceWorking")}</p>}
      {visible && <form noValidate onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-4">
        <div><Label htmlFor="billing-monthly-amount">{t("monthlyBilling.priceAmount")}</Label>
          <Input ref={input} id="billing-monthly-amount" type="text" inputMode="decimal" autoComplete="off" maxLength={12} required
            value={draft} disabled={busy} aria-invalid={invalid} aria-describedby={`billing-price-help${error ? " billing-price-error" : ""}`} onChange={event => { setDraft(event.target.value); setInvalid(false); setSaved(false); }} />
          <p id="billing-price-help" className="mt-2 text-sm">{t("monthlyBilling.priceHelp")}</p></div>
        <Button type="submit" disabled={busy || needsRefresh} className="min-h-11 h-auto whitespace-normal">{t("monthlyBilling.priceSave")}</Button>
      </form>}
      {saved && <p role="status">{t("monthlyBilling.priceSaved")}</p>}
      {error && <p id="billing-price-error" ref={alert} tabIndex={-1} role="alert">{t(error)}</p>}
      <Button type="button" variant="outline" disabled={busy} onClick={() => void load()} className="min-h-11 h-auto whitespace-normal">{t("monthlyBilling.priceReload")}</Button>
    </>}
  </section>;
}
