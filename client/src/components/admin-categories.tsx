import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Category } from "@shared/schema";
import { createCategorySchema, categoryDetailsSchema, type CategoryInput } from "@shared/categories";
import { useCategories } from "@/hooks/use-categories";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const blank: CategoryInput = { key: "", name: "", icon: "", searchKeywords: "" };

export default function AdminCategories({ onAccessError }: { onAccessError: (error: Error) => void }) {
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
      setEditing(null); setDeleting(null); setDraft({ ...blank }); setError("");
      await client.invalidateQueries({ queryKey: ["/api/categories"] });
    },
    onError: (failure: Error) => {
      onAccessError(failure);
      try { setError(JSON.parse(failure.message.slice(failure.message.indexOf(":") + 1)).message); }
      catch { setError("Unable to save categories. Please try again."); }
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    const { key, ...details } = draft;
    const parsed = editing ? categoryDetailsSchema.safeParse(details) : createCategorySchema.safeParse(draft);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    mutation.mutate({ method: editing ? "PATCH" : "POST", key: editing ?? undefined, data: parsed.data });
  }
  return <section aria-labelledby="categories-heading" className="border rounded-xl bg-white p-4 sm:p-6 space-y-5">
    <div className="flex flex-wrap justify-between gap-3">
      <div><h2 id="categories-heading" className="text-lg font-semibold">Categories</h2>
        <p className="text-sm text-neutral-600">Manage categories shown in search and service listings. Keys stay fixed so existing services keep their category.</p></div>
      <Button variant="outline" disabled={categories.isFetching || mutation.isPending} onClick={() => void categories.refetch()}>Refresh categories</Button>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {categories.isError ? <p role="alert">Unable to load categories. Use Refresh categories to try again.</p>
      : categories.isPending ? <p role="status">Loading categories…</p> : <>
        {categories.data.length === 0 ? <p>No categories yet. Add the first category below.</p> : <ul className="divide-y">
          {categories.data.map(category => <li key={category.key} className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0"><p className="font-medium break-words">{category.icon} {category.name}</p><p className="text-xs text-neutral-500 break-all">{category.key}</p></div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={mutation.isPending} onClick={() => { setEditing(category.key); setDraft({ ...category }); setDeleting(null); setError(""); }}>Edit</Button>
              <Button variant="outline" disabled={mutation.isPending} onClick={() => { setDeleting(category); setError(""); }}>Delete</Button>
            </div>
          </li>)}
        </ul>}
        {deleting && <div role="alert" className="rounded-md border border-red-200 p-4 space-y-3">
          <p>Delete {deleting.name}? Categories used by services cannot be deleted.</p>
          <div className="flex gap-2"><Button variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate({ method: "DELETE", key: deleting.key })}>Confirm deletion</Button>
            <Button variant="outline" disabled={mutation.isPending} onClick={() => setDeleting(null)}>Keep category</Button></div>
        </div>}
        <form onSubmit={submit} className="space-y-4 max-w-xl">
          <h3 className="font-medium">{editing ? "Edit category" : "Add category"}</h3>
          <div><Label htmlFor="category-key">Key</Label><Input id="category-key" required maxLength={64} value={draft.key} disabled={editing !== null || mutation.isPending} placeholder="e.g. sports" onChange={event => setDraft(previous => ({ ...previous, key: event.target.value }))} />
            <p className="text-xs text-neutral-500 mt-1">Lowercase letters, numbers, and underscores. Start with a letter.</p></div>
          <div><Label htmlFor="category-name">Name</Label><Input id="category-name" required maxLength={100} disabled={mutation.isPending} value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></div>
          <div><Label htmlFor="category-icon">Icon (optional emoji)</Label><Input id="category-icon" maxLength={16} disabled={mutation.isPending} value={draft.icon} onChange={event => setDraft(previous => ({ ...previous, icon: event.target.value }))} /></div>
          <div><Label htmlFor="category-keywords">Search keywords (optional)</Label><Input id="category-keywords" maxLength={1000} disabled={mutation.isPending} value={draft.searchKeywords} onChange={event => setDraft(previous => ({ ...previous, searchKeywords: event.target.value }))} />
            <p className="text-xs text-neutral-500 mt-1">Included when generating service search embeddings.</p></div>
          <div className="flex gap-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : editing ? "Save category" : "Add category"}</Button>
            {editing && <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => { setEditing(null); setDraft({ ...blank }); setError(""); }}>Cancel editing</Button>}</div>
        </form>
      </>}
  </section>;
}
