import { useRef, useState, type ReactNode, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImageUploaderProps {
  onComplete: (objectPath: string) => void;
  buttonClassName?: string;
  children: ReactNode;
}

export function ImageUploader({ onComplete, buttonClassName, children }: ImageUploaderProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
      toast({ title: "Choose an image", description: "Use a JPEG, PNG, WebP, or GIF up to 10 MB.", variant: "destructive" });
      event.target.value = ""; return;
    }
    setBusy(true);
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
      onComplete(image.objectPath);
      toast({ title: "Image uploaded", description: "Your image is ready to use." });
    } catch {
      toast({ title: "Upload failed", description: "Unable to upload this image. Please try again.", variant: "destructive" });
    } finally {
      setBusy(false); if (input.current) input.current.value = "";
    }
  }
  return <>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={upload} aria-label="Choose a service image" />
    <Button type="button" className={buttonClassName} disabled={busy} onClick={() => input.current?.click()} data-testid="button-upload-image">{busy ? "Uploading…" : children}</Button>
  </>;
}
