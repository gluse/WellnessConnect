import { useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { ServiceDraft } from "./service-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { useNotificationCapabilities } from "@/hooks/use-notification-capabilities";
import { imageDraft, serviceImages } from "@/lib/service-images";
import { fieldFeedback, ServiceFieldError, type ServiceErrors } from "./service-field-feedback";

export default function ServiceMediaFields({ newService, setNewService, errors = {}, onBusyChange }: { newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>>; errors?: ServiceErrors; onBusyChange?: (busy: boolean) => void }) {
  const { t } = useTranslation();
  const capabilities = useNotificationCapabilities();
  const pro = capabilities.data?.hasPro === true && !capabilities.isError;
  const limit = pro ? 10 : 1;
  const images = serviceImages(newService);
  const [busy, setBusy] = useState(false);
  const changeImages = (update: (images: string[]) => string[]) => setNewService(previous => ({ ...previous, ...imageDraft(update(serviceImages(previous))) }));
  return <div className="space-y-4">
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("servicePictures.title")}</p>
      <p className="text-sm text-muted-foreground">{t("servicePictures.help", { max: limit })}</p>
      {capabilities.isPending ? <p role="status" className="text-sm">{t("notifications.loading")}</p> : capabilities.isError ? <p role="alert" className="text-sm">{t("notifications.capabilityError")} <button type="button" className="underline min-h-11" onClick={() => void capabilities.refetch()}>{t("publicSearch.retry")}</button></p> : !pro && <p className="text-sm">{t("servicePictures.proHelp")} <Link className="underline py-2 inline-block" href="/my-services/settings/billing">{t("notifications.subscription")}</Link></p>}
      {!pro && images.length > 1 && <p role="status" className="text-sm">{t("servicePictures.retained")}</p>}
      {images.length > 0 && <ol className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-label={t("servicePictures.title")} data-testid="service-picture-list">
        {images.map((path, index) => <li key={path} className="min-w-0 rounded-lg border p-2 space-y-2">
          <img src={path} alt={t("servicePictures.preview", { current: index + 1 })} className="w-full h-24 object-contain rounded-md bg-muted" />
          {index === 0 ? <p className="text-sm font-medium min-h-11 flex items-center">{t("servicePictures.cover")}</p> : <Button type="button" variant="outline" className="w-full min-h-11 h-auto whitespace-normal text-sm" disabled={busy} onClick={() => changeImages(current => [path, ...current.filter(item => item !== path)])} aria-label={t("servicePictures.makeCoverLabel", { current: index + 1 })} data-testid={`service-picture-cover-${index}`}>{t("servicePictures.makeCover")}</Button>}
          <Button type="button" variant="outline" className="w-full min-h-11 h-auto whitespace-normal text-sm" disabled={busy} onClick={() => changeImages(current => current.filter(item => item !== path))} aria-label={t("servicePictures.removeLabel", { current: index + 1 })} data-testid={`service-picture-remove-${index}`}>{t("servicePictures.remove")}</Button>
        </li>)}
      </ol>}
      <ImageUploader disabled={images.length >= limit} onBusyChange={value => { setBusy(value); onBusyChange?.(value); }}
        onComplete={objectPath => changeImages(current => current.length < limit && !current.includes(objectPath) ? [...current, objectPath] : current)} buttonClassName="w-full min-h-11 h-auto whitespace-normal">
        <ImageIcon className="w-4 h-4 shrink-0" aria-hidden="true" />{t("servicePictures.add")}
      </ImageUploader>
      <p role="status" className="text-sm text-muted-foreground">{t("servicePictures.selected", { current: images.length, max: limit })}</p>
    </div>
    <div className="space-y-2">
      <Label htmlFor="externalUrl">{t("serviceForm.externalUrl")}</Label>
      <div className="flex items-center gap-2">
        <LinkIcon className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Input id="externalUrl" className="min-h-11" type="url" dir="ltr" value={newService.externalUrl}
          onChange={event => setNewService(prev => ({ ...prev, externalUrl: event.target.value }))} {...fieldFeedback(errors, "externalUrl", "externalUrl-help")} data-testid="input-external-url" />
      </div>
      <ServiceFieldError errors={errors} field="externalUrl" />
      <p id="externalUrl-help" className="text-sm text-muted-foreground">{t("serviceForm.urlHelp")}</p>
    </div>
  </div>;
}
