import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { ServiceDraft } from "./service-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";
import { fieldFeedback, ServiceFieldError, type ServiceErrors } from "./service-field-feedback";

export default function ServiceMediaFields({ newService, setNewService, errors = {} }: { newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>>; errors?: ServiceErrors }) {
  const { t } = useTranslation();
  return <div className="space-y-4">
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("serviceForm.image")}</p>
      <ImageUploader onComplete={objectPath => setNewService(prev => ({ ...prev, imageUrl: objectPath }))} buttonClassName="w-full min-h-11 h-auto whitespace-normal">
        <ImageIcon className="w-4 h-4 shrink-0" aria-hidden="true" />{t(newService.imageUrl ? "serviceForm.changeImage" : "serviceForm.uploadImage")}
      </ImageUploader>
      {newService.imageUrl && <p role="status" className="text-sm text-muted-foreground">{t("storefront.imageUploaded")}</p>}
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
