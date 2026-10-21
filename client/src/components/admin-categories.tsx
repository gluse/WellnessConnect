import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Category } from "@shared/schema";
import { createCategorySchema, categoryDetailsSchema, type CategoryInput } from "@shared/categories";
import { useCategories } from "@/hooks/use-categories";
import { apiRequest } from "@/lib/queryClient";
import { useFormLocale } from "@/components/forms-locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const blank: CategoryInput = { key: "", name: "", icon: "", searchKeywords: "" };

export default function AdminCategories({ onAccessError }: { onAccessError: (error: Error) => void }) {
  const { t } = useFormLocale();
  const errorRef = useRef<HTMLParagraphElement>(null), locked = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const categories = useCategories();
  const client = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [draft, setDraft] = useState({ ...blank });
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: async (action: { method: "POST" | "PATCH" | "DELETE"; key?: string; data?: unknown }) =>
      apiRequest(action.method, `/api/admin/categories${action.key ? `/${encodeURIComponent(action.key)}` : ""}`, action.data),
    onSuccess: async () => {
      setEditing(null); setDeleting(null); setDraft({ ...blank }); setError(""); setFieldErrors([]); setMessage(t("operationsForm.saved"));
      await client.invalidateQueries({ queryKey: ["/api/categories"] });
    },
    onError: (failure: Error) => {
      onAccessError(failure);
      setError(t(failure.message.startsWith("409:") ? "operationsForm.categoryConflict" : "operationsForm.saveError"));
      requestAnimationFrame(() => errorRef.current?.focus());
    },
    onSettled: () => { locked.current = false; },
  });
  function submit(event: FormEvent) {
    event.preventDefault(); if (locked.current) return; setError(""); setMessage("");
    const { key, ...details } = draft;
    const parsed = editing ? categoryDetailsSchema.safeParse(details) : createCategorySchema.safeParse(draft);
    if (!parsed.success) { setFieldErrors(parsed.error.issues.map(issue => String(issue.path[0]))); setError(t("operationsForm.categoryError")); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    setFieldErrors([]); locked.current = true;
    mutation.mutate({ method: editing ? "PATCH" : "POST", key: editing ?? undefined, data: parsed.data });
  }
  return <section aria-labelledby="categories-heading" className="phase3-form border rounded-xl bg-card text-card-foreground p-4 sm:p-6 space-y-5">
    <div className="flex flex-wrap justify-between gap-3">
      <div><h2 id="categories-heading" className="text-lg font-semibold">{t("operationsForm.categories")}</h2>
        <p className="text-sm text-muted-foreground">{t("operationsForm.categoriesHelp")}</p></div>
      <Button variant="outline" disabled={categories.isFetching || mutation.isPending} onClick={() => void categories.refetch()}>{t("operationsForm.refreshCategories")}</Button>
    </div>
    {message && <p role="status">{message}</p>}{error && <p id="category-error" ref={errorRef} tabIndex={-1} role="alert" className="text-destructive">{error}{fieldErrors.map(field => <a key={field} className="block" href={`#category-${field === "searchKeywords" ? "keywords" : field}`}>{t(`operationsForm.${field === "searchKeywords" ? "keywords" : field}`)}</a>)}</p>}
    {categories.isError ? <p role="alert">{t("operationsForm.loadCategoriesError")}</p>
      : categories.isPending ? <p role="status">{t("operationsForm.loadingCategories")}</p> : <>
        {categories.data.length === 0 ? <p>{t("operationsForm.noCategories")}</p> : <ul className="divide-y">
          {categories.data.map(category => <li key={category.key} className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0"><p className="font-medium break-words">{category.icon} {category.name}</p><p className="text-xs text-muted-foreground break-all">{category.key}</p></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={mutation.isPending} onClick={() => { setEditing(category.key); setDraft({ ...category }); setDeleting(null); setError(""); }}>{t("operationsForm.edit")}</Button>
              <Button variant="outline" disabled={mutation.isPending} onClick={() => { setDeleting(category); setError(""); }}>{t("operationsForm.delete")}</Button>
            </div>
          </li>)}
        </ul>}
        {deleting && <div role="alert" className="rounded-md border border-red-200 p-4 space-y-3">
          <p>{t("operationsForm.deleteCategoryConfirm", { name: deleting.name })}</p>
          <div className="flex gap-2"><Button variant="destructive" disabled={mutation.isPending} onClick={() => { if (locked.current) return; locked.current = true; setMessage(""); mutation.mutate({ method: "DELETE", key: deleting.key }); }}>{t("operationsForm.confirmDelete")}</Button>
            <Button variant="outline" disabled={mutation.isPending} onClick={() => setDeleting(null)}>{t("operationsForm.keepCategory")}</Button></div>
        </div>}
        <form noValidate onSubmit={submit} className="space-y-4 max-w-xl">
          <h3 className="font-medium">{t(editing ? "operationsForm.editCategory" : "operationsForm.addCategory")}</h3>
          <div><Label htmlFor="category-key">{t("operationsForm.key")}</Label><Input id="category-key" aria-invalid={fieldErrors.includes("key")} aria-describedby={fieldErrors.includes("key") ? "category-error" : undefined} required maxLength={64} value={draft.key} disabled={editing !== null || mutation.isPending} placeholder="sports" onChange={event => setDraft(previous => ({ ...previous, key: event.target.value }))} />
            <p className="text-xs text-muted-foreground mt-1">{t("operationsForm.keyHelp")}</p></div>
          <div><Label htmlFor="category-name">{t("operationsForm.name")}</Label><Input id="category-name" aria-invalid={fieldErrors.includes("name")} aria-describedby={fieldErrors.includes("name") ? "category-error" : undefined} required maxLength={100} disabled={mutation.isPending} value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></div>
          <div><Label htmlFor="category-icon">{t("operationsForm.icon")}</Label><Input id="category-icon" aria-invalid={fieldErrors.includes("icon")} aria-describedby={fieldErrors.includes("icon") ? "category-error" : undefined} maxLength={16} disabled={mutation.isPending} value={draft.icon} onChange={event => setDraft(previous => ({ ...previous, icon: event.target.value }))} /></div>
          <div><Label htmlFor="category-keywords">{t("operationsForm.keywords")}</Label><Input id="category-keywords" aria-invalid={fieldErrors.includes("searchKeywords")} aria-describedby={fieldErrors.includes("searchKeywords") ? "category-error" : undefined} maxLength={1000} disabled={mutation.isPending} value={draft.searchKeywords} onChange={event => setDraft(previous => ({ ...previous, searchKeywords: event.target.value }))} />
            <p className="text-xs text-muted-foreground mt-1">{t("operationsForm.keywordsHelp")}</p></div>
          <div className="flex gap-2"><Button type="submit" disabled={mutation.isPending}>{t(mutation.isPending ? "operationsForm.saving" : editing ? "operationsForm.saveCategory" : "operationsForm.addCategory")}</Button>
            {editing && <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => { setEditing(null); setDraft({ ...blank }); setError(""); }}>{t("operationsForm.cancelEditing")}</Button>}</div>
        </form>
      </>}
  </section>;
}
