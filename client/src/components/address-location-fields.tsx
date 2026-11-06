import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "@shared/schema";
import { addressError, currentLocation, normalizeAddress, validCoordinates } from "@shared/locations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES } from "@shared/currencies";

export function createLocationDraft(address?: Address) {
  const location = address ? currentLocation(address) : undefined;
  return {
    address: location?.address ?? "", countryCode: location?.countryCode ?? null, pricingCurrency: location?.pricingCurrency ?? null, latitude: location?.latitude ?? null, longitude: location?.longitude ?? null,
    locationSource: location?.locationSource ?? "legacy", locationKey: location?.locationKey ?? null,
    locationExpiresAt: location?.locationExpiresAt ? new Date(location.locationExpiresAt).toISOString() : null,
    locationAddressSource: location?.locationAddressSource ?? "user",
  };
}
export type LocationDraft = ReturnType<typeof createLocationDraft>;
export default function AddressLocationFields({ newService, setNewService, addressIssue, coordinateIssue, onBusyChange }: {
  newService: LocationDraft; setNewService: Dispatch<SetStateAction<LocationDraft>>; addressIssue?: string; coordinateIssue?: string; onBusyChange?: (busy: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const countryNames = new Intl.DisplayNames([language], { type: "region" });
  const currencyNames = new Intl.DisplayNames([language], { type: "currency" });
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [manualOpen, setManualOpen] = useState(newService.locationSource === "manual");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { if (coordinateIssue) setManualOpen(true); }, [coordinateIssue]);
  useEffect(() => {
    const timer = setInterval(() => setNewService(prev => {
      const location = currentLocation(prev);
      return location === prev ? prev : { ...location, address: location.address ?? "" };
    }), 60_000);
    if (typeof timer === "object" && "unref" in timer) timer.unref();
    return () => clearInterval(timer);
  }, [setNewService]);
  const updateBusy = (next: boolean) => { setBusy(next); onBusyChange?.(next); };
  const cancel = () => { pending.current?.abort(); pending.current = null; updateBusy(false); };
  const verified = validCoordinates(newService.latitude, newService.longitude)
    && (newService.locationSource === "manual" || (newService.locationSource === "google"
      && !!newService.locationExpiresAt && Date.parse(newService.locationExpiresAt) > Date.now()));
  const verify = async () => {
    if (pending.current || verified) return;
    if (addressError(newService.address)) { setFeedback("addressForm.addressInvalid"); return; }
    const controller = new AbortController(), address = newService.address;
    pending.current = controller; updateBusy(true); setFeedback("");
    try {
      const response = await apiRequest("POST", "/api/geocode", { address }, controller.signal);
      const data = await response.json();
      if (controller.signal.aborted || pending.current !== controller) return;
      setNewService(prev => normalizeAddress(prev.address) !== normalizeAddress(address) ? prev : ({
        ...prev, latitude: data.latitude, longitude: data.longitude,
        locationSource: data.locationSource, locationKey: data.locationKey, locationExpiresAt: data.locationExpiresAt, locationAddressSource: "user",
      }));
      setFeedback("");
      toast({ title: t("addressForm.locationSet") });
    } catch {
      if (controller.signal.aborted) return;
      setFeedback("addressForm.verifyError"); setManualOpen(true);
      toast({ title: t("addressForm.verifyError"), variant: "destructive" });
    } finally {
      if (pending.current === controller) { pending.current = null; updateBusy(false); }
    }
  };
  const addressErrorText = addressIssue || (feedback === "addressForm.addressInvalid" ? t(feedback) : "");
  return <section className="space-y-4">
    <div className="space-y-2"><Label htmlFor="address-country">{t("currency.country")}</Label>
      <select id="address-country" autoComplete="country" className="w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base" value={newService.countryCode ?? ""}
        aria-describedby="address-country-help" onChange={event => setNewService(prev => ({ ...prev, countryCode: event.target.value || null }))}>
        <option value="">{t("currency.countryUnknown")}</option>
        {SUPPORTED_COUNTRIES.map(code => <option key={code} value={code}>{countryNames.of(code) || code}</option>)}
      </select>
      <p id="address-country-help" className="text-sm text-muted-foreground">{t("currency.countryHelp")}</p>
    </div>
    <div className="space-y-2"><Label htmlFor="address-pricing-currency">{t("currency.locationOverride")}</Label>
      <select id="address-pricing-currency" className="w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base" value={newService.pricingCurrency ?? ""}
        aria-describedby="address-pricing-currency-help" onChange={event => setNewService(prev => ({ ...prev, pricingCurrency: event.target.value || null }))}>
        <option value="">{t("currency.useWorkspaceDefault")}</option>
        {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{code} — {currencyNames.of(code) || code}</option>)}
      </select>
      <p id="address-pricing-currency-help" className="text-sm text-muted-foreground">{t("currency.locationOverrideHelp")}</p>
    </div>
    <div className="space-y-2">
      <Label htmlFor="address">{t("addressForm.address")} *</Label>
      <div className="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
        <Input id="address" dir="auto" autoComplete="street-address" value={newService.address} maxLength={500}
          aria-invalid={Boolean(addressErrorText) || undefined} aria-describedby={"address-help address-status" + (addressErrorText ? " address-error" : "")}
          onChange={event => {
            const address = event.target.value; setFeedback("");
            if (normalizeAddress(address) === normalizeAddress(newService.address)) { setNewService(prev => ({ ...prev, address })); return; }
            cancel();
            setNewService(prev => ({ ...prev, address, latitude: null, longitude: null,
              locationSource: "legacy", locationKey: null, locationExpiresAt: null, locationAddressSource: "user" }));
          }} data-testid="input-address" />
        <Button type="button" variant="outline" disabled={busy || verified} onClick={verify} data-testid="button-verify-address">{t(busy ? "addressForm.verifying" : verified ? "addressForm.locationSet" : "addressForm.verify")}</Button>
      </div>
      <p id="address-help" className="text-sm text-muted-foreground">{t("addressForm.verifyHelp")}</p>
      <p id="address-status" role="status" aria-live="polite" className="text-sm font-medium">{t(busy ? "addressForm.verifying" : verified ? "addressForm.locationSet" : "addressForm.needsVerification")}</p>
      {addressErrorText && <p id="address-error" role="alert" className="text-sm text-red-700 dark:text-red-300">{addressErrorText}</p>}
      {feedback === "addressForm.verifyError" && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t(feedback)}</p>}
    </div>
    <details open={manualOpen} onToggle={event => setManualOpen(event.currentTarget.open)} className="border rounded-lg p-3">
      <summary className="cursor-pointer min-h-11 py-2 font-medium">{t("addressForm.useCoordinates")}</summary>
      <p id="address-coordinate-help" className="text-sm text-muted-foreground my-3">{t("addressForm.coordinateHelp")}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {(["latitude", "longitude"] as const).map(field => <div key={field} className="space-y-2">
          <Label htmlFor={field}>{t(field === "latitude" ? "addressForm.latitude" : "addressForm.longitude")}</Label>
          <Input id={field} type="number" step="any" min={field === "latitude" ? -90 : -180} max={field === "latitude" ? 90 : 180}
            value={newService[field] ?? ""} aria-invalid={Boolean(coordinateIssue) || undefined}
            aria-describedby={"address-coordinate-help" + (coordinateIssue ? " address-coordinates-error" : "")}
            onChange={event => {
              cancel(); setFeedback("");
              const value = event.target.value === "" ? null : Number(event.target.value);
              setNewService(prev => ({ ...prev, ...(prev.locationSource !== "manual" ? { latitude: null, longitude: null } : {}),
                [field]: value, locationSource: "manual", locationKey: null, locationExpiresAt: null, locationAddressSource: "user" }));
            }} data-testid={`input-${field}`} />
        </div>)}
      </div>
      {coordinateIssue && <p id="address-coordinates-error" role="alert" className="text-sm text-red-700 dark:text-red-300 mt-3">{coordinateIssue}</p>}
    </details>
    {validCoordinates(newService.latitude, newService.longitude) && <p className="text-sm text-muted-foreground">{t("addressForm.coordinatesSet", { latitude: new Intl.NumberFormat(language, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(newService.latitude!), longitude: new Intl.NumberFormat(language, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(newService.longitude!) })}</p>}
    {newService.locationSource === "google" && newService.locationExpiresAt && <p className="text-sm text-muted-foreground"><bdi translate="no">Google Maps</bdi> · {t("addressForm.expires", { date: new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" }).format(new Date(newService.locationExpiresAt)) })}</p>}
  </section>;
}
