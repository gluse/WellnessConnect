import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ServiceDraft } from "./service-draft";
import { addressError, currentLocation, normalizeAddress, validCoordinates } from "@shared/locations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ServiceLocationFields({ newService, setNewService }: { newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>> }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    const timer = setInterval(() => setNewService(prev => {
      const location = currentLocation(prev);
      return location === prev ? prev : { ...location, address: location.address ?? "" };
    }), 60_000);
    if (typeof timer === "object" && "unref" in timer) timer.unref();
    return () => clearInterval(timer);
  }, [setNewService]);
  const cancel = () => { pending.current?.abort(); pending.current = null; setBusy(false); };
  const verified = validCoordinates(newService.latitude, newService.longitude)
    && (newService.locationSource === "manual" || (newService.locationSource === "google"
      && !!newService.locationExpiresAt && Date.parse(newService.locationExpiresAt) > Date.now()));
  const verify = async () => {
    if (pending.current || verified) return;
    const error = addressError(newService.address);
    if (error) { toast({ title: "Check the address", description: error, variant: "destructive" }); return; }
    const controller = new AbortController();
    const address = newService.address;
    pending.current = controller; setBusy(true);
    try {
      const response = await apiRequest("POST", "/api/geocode", { address }, controller.signal);
      const data = await response.json();
      if (controller.signal.aborted || pending.current !== controller) return;
      setNewService(prev => normalizeAddress(prev.address) !== normalizeAddress(address) ? prev : ({
        ...prev, latitude: data.latitude, longitude: data.longitude,
        locationSource: data.locationSource, locationKey: data.locationKey, locationExpiresAt: data.locationExpiresAt, locationAddressSource: "user",
      }));
      toast({ title: data.reused ? "Saved location reused" : "Address verified", description: "Location coordinates set successfully." });
    } catch (error) {
      if (controller.signal.aborted) return;
      let description = "Try the full street address, town and country, or enter coordinates manually below.";
      if (error instanceof Error) {
        try { description = JSON.parse(error.message.replace(/^\d+:\s*/, "")).message || description; } catch { /* network error */ }
      }
      toast({ title: "Unable to verify address", description, variant: "destructive" });
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  };
  return <section className="space-y-4">
    <div>
      <Label htmlFor="address">Address *</Label>
      <div className="flex space-x-2">
        <Input id="address" value={newService.address} maxLength={500}
          onChange={e => {
            const address = e.target.value;
            if (normalizeAddress(address) === normalizeAddress(newService.address)) {
              setNewService(prev => ({ ...prev, address })); return;
            }
            cancel();
            setNewService(prev => ({ ...prev, address, latitude: null, longitude: null,
              locationSource: "legacy", locationKey: null, locationExpiresAt: null, locationAddressSource: "user" }));
          }} placeholder="Street or venue, town, country" data-testid="input-address" />
        <Button type="button" variant="outline" disabled={busy || verified} onClick={verify} data-testid="button-verify-address">
          {busy ? "Verifying…" : verified ? "Location set" : "Verify"}
        </Button>
      </div>
      <p className="text-xs text-neutral-500 mt-1">Verify to find the location, or enter your own coordinates below. Viewing a saved address does not trigger a lookup.</p>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {(["latitude", "longitude"] as const).map(field => <div key={field}>
        <Label htmlFor={field}>{field === "latitude" ? "Latitude" : "Longitude"} *</Label>
        <Input id={field} type="number" step="any" min={field === "latitude" ? -90 : -180} max={field === "latitude" ? 90 : 180}
          value={newService[field] ?? ""}
          onChange={e => {
            cancel();
            const value = e.target.value === "" ? null : Number(e.target.value);
            setNewService(prev => ({ ...prev,
              ...(prev.locationSource !== "manual" ? { latitude: null, longitude: null } : {}),
              [field]: value, locationSource: "manual", locationKey: null, locationExpiresAt: null, locationAddressSource: "user" }));
          }} placeholder={field === "latitude" ? "e.g. 57.5397" : "e.g. 25.4175"} data-testid={`input-${field}`} />
      </div>)}
    </div>
    {validCoordinates(newService.latitude, newService.longitude) && <p className="text-xs text-green-600">
      ✓ Coordinates set: {newService.latitude!.toFixed(4)}, {newService.longitude!.toFixed(4)}
    </p>}
    {newService.locationSource === "google" && newService.locationExpiresAt && <p className="text-xs text-neutral-500">
      <span translate="no" className="whitespace-nowrap">Google Maps</span> · Coordinates available until {new Date(newService.locationExpiresAt).toLocaleDateString()}. Verify again after expiry to restore the map location.
    </p>}
  </section>;
}
