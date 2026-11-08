import { useEffect, useRef, useState, type ReactNode, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface ImageUploaderProps {
  onComplete: (objectPath: string) => void;
  buttonClassName?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  children: ReactNode;
}

export function ImageUploader({ onComplete, buttonClassName, disabled = false, onBusyChange, children }: ImageUploaderProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { toast } = useToast();
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || disabled || locked.current) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
      toast({ title: t("storefront.imageChoose"), description: t("storefront.imageHelp"), variant: "destructive" });
      event.target.value = ""; return;
    }
    locked.current = true; setBusy(true); onBusyChange?.(true);
    try {
      const signed = await apiRequest("POST", "/api/objects/upload", { contentType: file.type, size: file.size });
      const { signedUrl, objectPath } = await signed.json();
      // Supabase's signed upload endpoint accepts multipart PUT requests.
      // Send only the signed capability, never cookies or backend credentials.
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const result = await fetch(signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body, credentials: "omit" });
      if (!result.ok) throw new Error("Upload failed");
      const confirmed = await apiRequest("PUT", "/api/service-images", { objectPath });
      const image = await confirmed.json();
      if (!mounted.current) return;
      onComplete(image.objectPath);
      toast({ title: t("storefront.imageUploaded"), description: t("storefront.imageReady") });
    } catch {
      if (mounted.current) toast({ title: t("storefront.imageUploadError"), variant: "destructive" });
    } finally {
      locked.current = false;
      if (mounted.current) { setBusy(false); onBusyChange?.(false); if (input.current) input.current.value = ""; }
    }
  }
  return <>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={disabled || busy} onChange={upload} aria-label={t("storefront.imageChoose")} />
    <Button type="button" className={buttonClassName} disabled={disabled || busy} onClick={() => input.current?.click()} data-testid="button-upload-image">{busy ? t("storefront.imageUploading") : children}</Button>
  </>;
}
