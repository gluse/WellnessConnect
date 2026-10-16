import type { Dispatch, SetStateAction } from "react";
import type { ServiceDraft } from "./service-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

export default function ServiceBookingFields({ newService, setNewService }: { newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>> }) {
  const { t } = useTranslation();
  const handleAgeGroupToggle = (ageGroup: string) => setNewService(prev => ({ ...prev, ageGroups: prev.ageGroups.includes(ageGroup) ? prev.ageGroups.filter(group => group !== ageGroup) : [...prev.ageGroups, ageGroup] }));
  return <section className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor="price">Price ($) *</Label>
        <Input
          id="price"
          type="number"
          min="0"
          step="0.01"
          required
          value={newService.price}
          onChange={(e) => setNewService(prev => ({ ...prev, price: e.target.value }))}
          placeholder="0.00"
        />
      </div>

      <div>
        <Label htmlFor="duration">Duration (min)</Label>
        <Input
          id="duration"
          type="number"
          min="1"
          value={newService.duration}
          onChange={(e) => setNewService(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
        />
      </div>
    </div>

    <div>
      <Label htmlFor="cleanupTime">{t("serviceCleanup.label")}</Label>
      <Input id="cleanupTime" type="number" min="0" max="1440" step="1"
        value={Number.isNaN(newService.cleanupTime) ? "" : newService.cleanupTime}
        onChange={event => setNewService(prev => ({ ...prev, cleanupTime: event.target.value === "" ? NaN : Number(event.target.value) }))}
        aria-describedby="cleanupTime-help" data-testid="input-cleanup-time" />
      <p id="cleanupTime-help" className="mt-1 text-sm text-neutral-500">{t("serviceCleanup.help")}</p>
    </div>

    {newService.serviceType === "group" && (
      <div>
        <Label htmlFor="maxCapacity">Max Capacity</Label>
        <Input
          id="maxCapacity"
          type="number"
          min="1"
          value={newService.maxCapacity}
          onChange={(e) => setNewService(prev => ({ ...prev, maxCapacity: parseInt(e.target.value) || 1 }))}
        />
      </div>
    )}

    <div>
      <Label>Target Age Groups</Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {["children", "teens", "adults", "seniors"].map(ageGroup => (
          <Button
            type="button"
            key={ageGroup}
            variant={newService.ageGroups.includes(ageGroup) ? "default" : "outline"}
            size="sm"
            onClick={() => handleAgeGroupToggle(ageGroup)}
            data-testid={`button-age-${ageGroup}`}
          >
            {ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1)}
          </Button>
        ))}
      </div>
    </div>

    <div>
      <Label>Target Gender</Label>
      <div className="grid sm:grid-cols-3 gap-2 mt-2">
        <Button
          type="button"
          variant={newService.targetGender === "females" ? "default" : "outline"}
          size="sm"
          onClick={() => setNewService(prev => ({ ...prev, targetGender: "females" }))}
          data-testid="button-gender-females"
          className="flex-1"
        >
          Females
        </Button>
        <Button
          type="button"
          variant={newService.targetGender === "males" ? "default" : "outline"}
          size="sm"
          onClick={() => setNewService(prev => ({ ...prev, targetGender: "males" }))}
          data-testid="button-gender-males"
          className="flex-1"
        >
          Males
        </Button>
        <Button
          type="button"
          variant={newService.targetGender === "both" ? "default" : "outline"}
          size="sm"
          onClick={() => setNewService(prev => ({ ...prev, targetGender: "both" }))}
          data-testid="button-gender-both"
          className="flex-1"
        >
          Females and Males
        </Button>
      </div>
    </div>

    <div className="flex items-center space-x-2">
      <Switch
        checked={newService.instantBooking}
        onCheckedChange={(checked) => setNewService(prev => ({ ...prev, instantBooking: checked }))}
      />
      <Label>Enable Instant Booking</Label>
    </div>

    <div>
      <Label htmlFor="advancePayment">Advance Payment (%)</Label>
      <Input
        id="advancePayment"
        type="number"
        min="0"
        max="100"
        value={newService.advancePaymentPercent}
        onChange={(e) => {
          const value = parseInt(e.target.value);
          if (!isNaN(value)) {
            const clampedValue = Math.min(Math.max(value, 0), 100);
            setNewService(prev => ({ ...prev, advancePaymentPercent: clampedValue }));
          } else if (e.target.value === '') {
            setNewService(prev => ({ ...prev, advancePaymentPercent: 0 }));
          }
        }}
        data-testid="input-advance-payment"
      />
    </div>
  </section>;
}
