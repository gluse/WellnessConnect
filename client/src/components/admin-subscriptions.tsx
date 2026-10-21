import { useCallback, useRef, useState } from "react";
import { useFormLocale } from "@/components/forms-locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hasPro, subscriptionUpdateSchema, type AdminSubscription, type SubscriptionOption, type SubscriptionTarget } from "@shared/storefront";
import SubscriptionTargetPicker from "@/components/subscription-target-picker";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function localDate(value: Date) { return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }

export default function AdminSubscriptions({ onAccessError }: { onAccessError: (error: Error) => void }) {
  const { t } = useFormLocale();
  const locked = useRef(false), expiryRef = useRef<HTMLInputElement>(null);
  const [expiryError, setExpiryError] = useState(false);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"user" | "company">("user");
  const [selection, setSelection] = useState<SubscriptionOption | null>(null);
  const [target, setTarget] = useState<SubscriptionTarget | null>(null);
  const [record, setRecord] = useState<AdminSubscription | null>(null);
  const [plan, setPlan] = useState<"free" | "pro">("pro");
  const [until, setUntil] = useState(() => localDate(new Date(Date.now() + 30 * 86400_000)));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fail = useCallback((err: Error) => {
    setMessage(""); setError(t(err.message.startsWith("404:") ? "storefront.targetMissing" : "storefront.saveError"));
    if (/^(401|403):/.test(err.message)) { setRecord(null); onAccessError(err); }
  }, [t, onAccessError]);
  const load = useMutation({ mutationFn: async (selected: SubscriptionTarget): Promise<AdminSubscription> =>
    (await apiRequest("GET", `/api/admin/subscriptions?${new URLSearchParams({ kind: selected.kind, id: String(selected.id) })}`)).json(),
    onSuccess: (data, selected) => { setTarget(selected); setRecord(data); setExpiryError(false); setPlan(data.subscription?.plan ?? "pro");
      setUntil(localDate(data.subscription?.proUntil ? new Date(data.subscription.proUntil) : new Date(Date.now() + 30 * 86400_000))); setError(""); }, onError: fail, onSettled: () => { locked.current = false; } });
  const update = useMutation({ mutationFn: async (): Promise<AdminSubscription> => (await apiRequest("PUT", "/api/admin/subscriptions", subscriptionUpdateSchema.parse({ target, plan,
    proUntil: plan === "pro" ? new Date(until).toISOString() : null }))).json(),
    onSuccess: async data => { setRecord(data); setError(""); setMessage(t("storefront.subscriptionSaved"));
      await queryClient.invalidateQueries({ predicate: query => /^\/api\/(provider\/storefront|services|storefronts|admin\/users)/.test(String(query.queryKey[0])) }); }, onError: fail, onSettled: () => { locked.current = false; } });
  const busy = load.isPending || update.isPending;
  const validExpiry = plan === "free" || (until && Number.isFinite(Date.parse(until)) && Date.parse(until) > Date.now());
  return <section className="phase3-form rounded-xl border bg-card text-card-foreground p-4 sm:p-6 space-y-5">
    <div><h2 className="text-lg font-semibold">{t("storefront.subscriptions")}</h2><p className="text-muted-foreground mt-1">{t("storefront.adminDescription")}</p></div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); if (locked.current || !selection) return; locked.current = true; setRecord(null); setMessage(""); setError(""); if (selection) load.mutate(selection.target); }}>
      <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
        <div><Label htmlFor="subscription-kind">{t("storefront.workspace")}</Label><select id="subscription-kind" className="min-h-11 border rounded-md px-3 block bg-background" value={kind} onChange={event => {
          setExpiryError(false); setKind(event.target.value as typeof kind); setSelection(null); setRecord(null); setTarget(null); setMessage(""); setError("");
        }}>
          <option value="user">{t("storefront.individual")}</option><option value="company">{t("storefront.company")}</option></select></div>
        <div className="w-full sm:w-80"><Label htmlFor="subscription-target">{t(kind === "company" ? "storefront.company" : "storefront.provider")}</Label>
          <SubscriptionTargetPicker key={kind} kind={kind} value={selection} disabled={busy} onAccessError={fail}
            onChange={option => { setSelection(option); setRecord(null); setTarget(null); setMessage(""); setError(""); }} />
          <p id="subscription-target-help" className="text-sm text-muted-foreground mt-1">{t(kind === "company" ? "storefront.companySearchHelp" : "storefront.providerSearchHelp")}</p>
        </div>
        <Button disabled={!selection || busy}>{t("storefront.loadSubscription")}</Button>
      </fieldset>
    </form>
    {load.isPending && <p role="status">{t("storefront.loading")}</p>}
    {record && <form noValidate className="space-y-4 border-t pt-4" onSubmit={event => { event.preventDefault(); if (locked.current) return; setMessage(""); setError(""); if (!validExpiry) { setExpiryError(true); expiryRef.current?.focus(); return; } setExpiryError(false); locked.current = true; update.mutate(); }}>
      <p className="font-medium break-words">{record.name}</p><p>{t(hasPro(record.subscription) ? "storefront.proActive" : "storefront.noPro")}</p>
      <fieldset disabled={busy} className="space-y-4">
        <div><Label htmlFor="subscription-plan">{t("storefront.plan")}</Label><select id="subscription-plan" className="h-10 border rounded-md px-3 block bg-white" value={plan} onChange={event => setPlan(event.target.value as typeof plan)}><option value="free">{t("storefront.free")}</option><option value="pro">Pro</option></select></div>
        {plan === "pro" && <div><Label htmlFor="subscription-until">{t("storefront.expires")}</Label><Input ref={expiryRef} aria-invalid={expiryError} aria-describedby="subscription-expiry-help" id="subscription-until" type="datetime-local" value={until} required onChange={event => setUntil(event.target.value)} /><p id="subscription-expiry-help" className="text-sm text-muted-foreground mt-1">{expiryError && <span className="text-destructive">{t("operationsForm.expiryError")} </span>}{t("storefront.timezone", { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p></div>}
        <Button disabled={busy}>{t(update.isPending ? "storefront.saving" : "storefront.saveSubscription")}</Button>
      </fieldset>
    </form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}
