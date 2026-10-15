import type { Dispatch, SetStateAction } from "react";
import type { ServiceDraft } from "./service-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ServiceLocationFields({ newService, setNewService }: { newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>> }) {
  const { toast } = useToast();
  return <section className="space-y-4">
    <div>
      <Label htmlFor="address">Address *</Label>
      <div className="flex space-x-2">
        <Input
          id="address"
          value={newService.address}
          onChange={(e) => setNewService(prev => ({ ...prev, address: e.target.value }))}
          placeholder="Enter service address"
          data-testid="input-address"
        />
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            if (!newService.address.trim()) {
              toast({
                title: "Address Required",
                description: "Please enter an address to verify",
                variant: "destructive",
              });
              return;
            }

            try {
              const response = await apiRequest("POST", "/api/geocode", {
                address: newService.address,
              });
              const data = await response.json();

              setNewService(prev => ({
                ...prev,
                latitude: data.latitude,
                longitude: data.longitude,
                address: data.formattedAddress,
              }));

              toast({
                title: "Address Verified",
                description: "Location coordinates set successfully",
              });
            } catch (error) {
              const unavailable = error instanceof Error && /^(500|502|503|429):/.test(error.message);
              toast({
                title: unavailable ? "Address lookup unavailable" : "Verification Failed",
                description: unavailable
                  ? "Address lookup is temporarily unavailable. Please try again later or enter coordinates manually below."
                  : "Try the street address, town, and country, or enter coordinates manually below.",
                variant: "destructive",
              });
            }
          }}
          data-testid="button-verify-address"
        >
          Verify
        </Button>
      </div>
      <p className="text-xs text-neutral-500 mt-1">
        Use the Verify button to auto-fill coordinates, or enter them manually below
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor="latitude">Latitude *</Label>
        <Input
          id="latitude"
          type="number"
          step="any"
          value={newService.latitude ?? ''}
          onChange={(e) => {
            const value = e.target.value === '' ? null : parseFloat(e.target.value);
            setNewService(prev => ({ ...prev, latitude: value }));
          }}
          placeholder="e.g. 57.5397"
          data-testid="input-latitude"
        />
      </div>
      <div>
        <Label htmlFor="longitude">Longitude *</Label>
        <Input
          id="longitude"
          type="number"
          step="any"
          value={newService.longitude ?? ''}
          onChange={(e) => {
            const value = e.target.value === '' ? null : parseFloat(e.target.value);
            setNewService(prev => ({ ...prev, longitude: value }));
          }}
          placeholder="e.g. 25.4175"
          data-testid="input-longitude"
        />
      </div>
    </div>
    {newService.latitude && newService.longitude && (
      <p className="text-xs text-green-600">
        ✓ Coordinates set: {newService.latitude.toFixed(4)}, {newService.longitude.toFixed(4)}
      </p>
    )}

  </section>;
}
