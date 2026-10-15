import type { Dispatch, SetStateAction } from "react";
import type { ServiceDraft } from "./service-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";

export default function ServiceMediaFields({ newService, setNewService }: { newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>> }) {

  return <section className="space-y-4">
    <div>
      <Label>Service Image (Optional)</Label>
      <div className="mt-2">
        <ImageUploader
          onComplete={(objectPath) => setNewService(prev => ({ ...prev, imageUrl: objectPath }))}
          buttonClassName="w-full"
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          {newService.imageUrl ? "Change Image" : "Upload Image"}
        </ImageUploader>
        {newService.imageUrl && (
          <p className="text-xs text-green-600 mt-2">
            ✓ Image uploaded
          </p>
        )}
      </div>
    </div>

    <div>
      <Label htmlFor="externalUrl">External URL (Optional)</Label>
      <div className="flex items-center space-x-2 mt-2">
        <LinkIcon className="w-4 h-4 text-neutral-400" />
        <Input
          id="externalUrl"
          type="url"
          value={newService.externalUrl}
          onChange={(e) => setNewService(prev => ({ ...prev, externalUrl: e.target.value }))}
          placeholder="https://example.com/more-info"
          data-testid="input-external-url"
        />
      </div>
      <p className="text-xs text-neutral-500 mt-1">
        Add a link to your website or booking page
      </p>
    </div>
  </section>;
}
