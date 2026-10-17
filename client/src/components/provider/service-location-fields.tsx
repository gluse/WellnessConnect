import type { Dispatch, SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@shared/schema";
import type { ServiceDraft } from "./service-draft";
import { Label } from "@/components/ui/label";

export default function ServiceLocationFields({ newService, setNewService }: { newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>> }) {
  const addresses = useQuery<Address[]>({ queryKey: ["/api/addresses"], refetchOnWindowFocus: "always" });
  return <section className="space-y-3">
    <Label htmlFor="service-address">Saved address *</Label>
    <select id="service-address" className="w-full h-10 rounded-md border bg-white px-3 text-sm" value={newService.addressId ?? ""}
      disabled={addresses.isLoading || addresses.isError} data-testid="select-service-address"
      onChange={event => setNewService(prev => ({ ...prev, addressId: event.target.value ? Number(event.target.value) : null }))}>
      <option value="">{addresses.isLoading ? "Loading addresses…" : "Choose an address"}</option>
      {addresses.data?.map(address => <option key={address.id} value={address.id} disabled={!address.address}>{address.address || "Address needs updating"}</option>)}
    </select>
    {addresses.isError && <p role="alert" className="text-sm text-destructive">Unable to load addresses. <button type="button" className="underline" onClick={() => void addresses.refetch()}>Retry</button></p>}
    {addresses.data?.length === 0 && <p className="text-sm text-neutral-600">Add an address to your account before creating a service.</p>}
    <p className="text-sm text-neutral-600">Use the same saved address for multiple services. <a href="/account#addresses" target="_blank" rel="noopener noreferrer" className="underline text-primary">Manage account addresses (opens a new tab)</a></p>
  </section>;
}
