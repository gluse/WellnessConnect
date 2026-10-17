import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { storefrontSchema, type StorefrontInput, type StorefrontSettings } from "@shared/storefront";
import type { ServiceWithProvider, WorkspaceContext } from "@shared/schema";
import { providerCatalogQuery } from "@shared/provider-catalog";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { StorefrontView } from "@/pages/storefront";
import { ImageUploader } from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function StorefrontEditor({ context }: { context: WorkspaceContext }) {
  const { t } = useTranslation();
  const settings = useQuery<StorefrontSettings>({ queryKey: ["/api/provider/storefront"], enabled: context.permissions.manageServices, staleTime: 0, retry: false, refetchOnWindowFocus: true, refetchInterval: 60_000 });
  if (!context.permissions.manageServices) return <p role="alert">{t("storefront.denied")}</p>;
  if (settings.isPending) return <p role="status">{t("storefront.loading")}</p>;
  if (settings.isError) return <div role="alert" className="space-y-3"><p>{t("storefront.loadError")}</p><Button onClick={() => void settings.refetch()}>{t("catalog.retry")}</Button></div>;
  return <StorefrontForm settings={settings.data} context={context} />;
}

function StorefrontForm({ settings, context }: { settings: StorefrontSettings; context: WorkspaceContext }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<StorefrontInput>(() => settings.storefront ? {
    slug: settings.storefront.slug, name: settings.storefront.name, description: settings.storefront.description,
    logoUrl: settings.storefront.logoUrl, coverUrl: settings.storefront.coverUrl, isPublished: settings.storefront.isPublished,
  } : { slug: "", name: context.company?.name ?? [user?.firstName, user?.lastName].filter(Boolean).join(" "), description: "", logoUrl: null, coverUrl: null, isPublished: false });
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pro = settings.hasPro && (settings.subscription?.proUntil != null && new Date(settings.subscription.proUntil).getTime() > Date.now());
  const source = { companyId: context.company?.id ?? null, providerId: user!.id };
  const services = useQuery<ServiceWithProvider[]>({ queryKey: ["/api/services/catalog", providerCatalogQuery(source)], enabled: preview && pro,
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/services/catalog?${providerCatalogQuery(source)}`, undefined, signal)).json(), staleTime: 0 });
  useEffect(() => {
    if (!settings.subscription?.proUntil) return;
    const remaining = new Date(settings.subscription.proUntil).getTime() - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["/api/provider/storefront"] }), Math.min(remaining + 50, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [settings.subscription?.proUntil, queryClient]);
  const save = useMutation({
    mutationFn: async () => (await apiRequest("PUT", "/api/provider/storefront", storefrontSchema.parse(draft))).json(),
    onSuccess: async saved => {
      setDraft({ slug: saved.slug, name: saved.name, description: saved.description, logoUrl: saved.logoUrl, coverUrl: saved.coverUrl, isPublished: saved.isPublished });
      setMessage(t("storefront.saved")); setError("");
      await queryClient.invalidateQueries({ queryKey: ["/api/provider/storefront"] });
      await queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/services") || query.queryKey[0] === "/api/storefronts" });
    },
    onError: (err: Error) => {
      setMessage("");
      setError(t(err.message.startsWith("403:") ? "storefront.proRequired" : err.message.startsWith("409:") ? "storefront.addressConflict" : "storefront.saveError"));
      void queryClient.invalidateQueries({ queryKey: ["/api/provider/storefront"] });
    },
  });
  const valid = storefrontSchema.safeParse(draft).success;
  return <section className="space-y-5 rounded-xl border bg-white p-4 sm:p-6">
    <div><h2 className="text-xl font-semibold">{t("storefront.title")}</h2><p className="text-neutral-600 mt-1">{t("storefront.editorDescription")}</p></div>
    <div className="rounded-xl bg-primary/5 p-4 space-y-2">
      <p className="font-medium">{t(pro ? "storefront.proActive" : "storefront.proRequired")}</p>
      {pro && <p className="text-sm">{t("storefront.validUntil", { date: new Date(settings.subscription!.proUntil!).toLocaleString() })}</p>}
      {!pro && <p className="text-sm">{t("storefront.contactSupport")}</p>}
      {settings.storefront && <p className="text-sm">{t(pro && settings.storefront.isPublished ? "storefront.published" : "storefront.hidden")}</p>}
    </div>
    {pro && <>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); setMessage(""); setError(""); if (valid) save.mutate(); }}>
        <fieldset disabled={save.isPending} className="space-y-4">
          <div><Label htmlFor="storefront-slug">{t("storefront.address")}</Label><Input id="storefront-slug" value={draft.slug} disabled={Boolean(settings.storefront)} required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={event => setDraft({ ...draft, slug: event.target.value })} />
            <p className="text-sm text-neutral-500 mt-1">{t("storefront.addressHelp")}</p><p className="text-sm break-all mt-1">/providers/{draft.slug || "…"}</p></div>
          <div><Label htmlFor="storefront-name">{t("storefront.name")}</Label><Input id="storefront-name" value={draft.name} required maxLength={150} onChange={event => setDraft({ ...draft, name: event.target.value })} /></div>
          <div><Label htmlFor="storefront-description">{t("storefront.description")}</Label><Textarea id="storefront-description" value={draft.description} maxLength={3000} rows={5} onChange={event => setDraft({ ...draft, description: event.target.value })} /></div>
          <div className="grid sm:grid-cols-2 gap-4">{(["logoUrl", "coverUrl"] as const).map(field => <div key={field} className="space-y-2 rounded-lg border p-3">
            <p className="font-medium">{t(`storefront.${field}`)}</p>
            {draft[field] && <img src={draft[field]!} alt={t(`storefront.${field}`)} className="h-24 max-w-full rounded-lg object-cover" />}
            <ImageUploader onComplete={path => setDraft(previous => ({ ...previous, [field]: path }))}>{t("storefront.upload")}</ImageUploader>
            {draft[field] && <Button type="button" variant="ghost" onClick={() => setDraft({ ...draft, [field]: null })}>{t("storefront.remove")}</Button>}
          </div>)}</div>
          <label className="flex gap-3 items-center"><input type="checkbox" checked={draft.isPublished} onChange={event => setDraft({ ...draft, isPublished: event.target.checked })} /><span>{t("storefront.publish")}</span></label>
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!valid || save.isPending}>{t(save.isPending ? "storefront.saving" : "storefront.save")}</Button>
            <Button type="button" variant="outline" disabled={!valid} onClick={() => setPreview(value => !value)}>{t(preview ? "storefront.closePreview" : "storefront.preview")}</Button>
            {settings.storefront?.isPublished && <Button asChild variant="outline"><Link href={`/providers/${settings.storefront.slug}`}>{t("storefront.open")}</Link></Button>}
          </div>
        </fieldset>
      </form>
      {settings.storefront?.isPublished && <div className="space-y-2"><Label htmlFor="storefront-share">{t("storefront.share")}</Label><Input id="storefront-share" readOnly value={`${window.location.origin}/providers/${settings.storefront.slug}`} onFocus={event => event.target.select()} />
        <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/providers/${settings.storefront!.slug}`); setError(""); setMessage(t("storefront.copied")); } catch { setError(t("storefront.copyError")); } }}>{t("storefront.copy")}</Button></div>}
    </>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
    {preview && pro && <div className="border-t pt-5 space-y-4"><p className="font-medium">{t("storefront.previewNote")}</p>{services.isPending ? <p role="status">{t("storefront.loading")}</p> : services.isError ? <p role="alert">{t("storefront.loadError")}</p> : <StorefrontView page={{ ...draft, services: services.data }} preview />}</div>}
  </section>;
}
