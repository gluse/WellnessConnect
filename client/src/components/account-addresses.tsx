import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address, WorkspaceContext } from "@shared/schema";
import { addressError, validCoordinates } from "@shared/locations";
import { apiRequest } from "@/lib/queryClient";
import AddressLocationFields, { createLocationDraft } from "./address-location-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function errorMessage(error: Error) {
  try { return JSON.parse(error.message.replace(/^\d+:\s*/, "")).message || "Unable to save address."; }
  catch { return "Unable to save address. Please try again."; }
}

function AddressForm({ address, onClose }: { address?: Address; onClose: () => void }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState(() => createLocationDraft(address));
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: async () => (await apiRequest(address ? "PATCH" : "POST", address ? `/api/addresses/${address.id}` : "/api/addresses", draft)).json(),
    onSuccess: async () => { await client.invalidateQueries(); onClose(); },
    onError: error => setError(errorMessage(error)),
  });
  return <form className="space-y-4 border rounded-lg p-4" onSubmit={event => {
    event.preventDefault();
    if (save.isPending) return;
    const message = addressError(draft.address);
    if (message || !validCoordinates(draft.latitude, draft.longitude)) { setError(message || "Verify the address or enter valid coordinates."); return; }
    setError(""); save.mutate();
  }}>
    <p className="font-medium">{address ? "Edit saved address" : "Add an address"}</p>
    <fieldset disabled={save.isPending} className="min-w-0"><AddressLocationFields newService={draft} setNewService={setDraft} /></fieldset>
    {address && <p className="text-sm text-neutral-600">Changes apply to every service using this address.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save address"}</Button><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button></div>
  </form>;
}

export default function AccountAddresses() {
  const client = useQueryClient();
  const context = useQuery<WorkspaceContext>({ queryKey: ["/api/company/context"] });
  const allowed = Boolean(context.data?.permissions?.manageServices);
  const addresses = useQuery<Address[]>({ queryKey: ["/api/addresses"], enabled: allowed });
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/addresses/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ["/api/addresses"] }),
  });
  return <Card id="addresses" className="scroll-mt-6">
    <CardHeader><CardTitle>Saved addresses</CardTitle><CardDescription>{context.data?.company ? `Addresses for ${context.data.company.name}.` : "Addresses for your personal account."} Save a location once, then select it for any service.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {context.isLoading ? <p role="status">Loading workspace…</p> : context.isError ? <p role="alert">Unable to load workspace.</p> : !allowed ? <p>Only workspace managers can manage saved addresses.</p> : <>
        {addresses.isLoading && <p role="status">Loading addresses…</p>}
        {addresses.isError && <p role="alert">Unable to load saved addresses. <button type="button" className="underline" onClick={() => void addresses.refetch()}>Retry</button></p>}
        {addresses.data?.length === 0 && <p className="text-sm text-neutral-600">No addresses saved yet.</p>}
        <ul className="space-y-3">{addresses.data?.map(address => <li key={address.id} className="border rounded-lg p-3 space-y-2">
          <p className="break-words">{address.address || "Address needs updating"}</p>
          {address.locationSource === "google" && !validCoordinates(address.latitude, address.longitude) && <p className="text-sm text-neutral-600">Map coordinates expired. Edit and verify to restore the map location.</p>}
          <div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={editing !== null || remove.isPending} onClick={() => { remove.reset(); setEditing(address); }}>Edit</Button><Button type="button" variant="outline" size="sm" disabled={editing !== null || remove.isPending} onClick={() => { if (window.confirm("Remove this saved address?")) remove.mutate(address.id); }}>Remove</Button></div>
        </li>)}</ul>
        {remove.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(remove.error)}</p>}
        {editing ? <AddressForm key={editing === "new" ? "new" : editing.id} address={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} /> : <Button type="button" disabled={remove.isPending} onClick={() => { remove.reset(); setEditing("new"); }}>Add address</Button>}
      </>}
    </CardContent>
  </Card>;
}
