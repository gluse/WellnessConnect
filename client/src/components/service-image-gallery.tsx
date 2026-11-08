import { useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { serviceImages, type ServiceImageSource } from "@/lib/service-images";

export default function ServiceImageGallery({ service }: { service: ServiceImageSource & { name: string } }) {
  const images = serviceImages(service);
  return images.length ? <Gallery key={JSON.stringify(images)} images={images} name={service.name} /> : null;
}

function Gallery({ images, name }: { images: string[]; name: string }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const move = (offset: number) => setIndex(current => Math.max(0, Math.min(images.length - 1, current + offset)));
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0) || (event.target as Element).closest("button")) return;
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const first = start.current; start.current = null;
    if (!first || first.id !== event.pointerId) return;
    const dx = event.clientX - first.x, dy = event.clientY - first.y;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  };
  return <section aria-label={t("servicePictures.gallery", { name })} className="min-w-0 space-y-2" data-testid="service-image-gallery">
    <div tabIndex={images.length > 1 ? 0 : undefined} role="group" aria-label={t("servicePictures.position", { current: index + 1, total: images.length })}
      className="relative overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ touchAction: "pan-y pinch-zoom" }}
      onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }}
      onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={() => { start.current = null; }} onLostPointerCapture={() => { start.current = null; }} data-testid="service-image-swipe">
      {failed.includes(images[index]) ? <div className="h-56 sm:h-72 flex flex-col items-center justify-center gap-2 p-4 text-center" role="status"><ImageOff aria-hidden="true" /><p>{t("servicePictures.unavailable")}</p></div>
        : <img key={images[index]} src={images[index]} alt={t("servicePictures.alt", { name, current: index + 1, total: images.length })} draggable={false}
          className="w-full h-56 sm:h-72 object-contain" onError={() => setFailed(current => [...current, images[index]])} data-testid="service-gallery-image" />}
    </div>
    {images.length > 1 && <div className="flex items-center justify-between gap-2" dir="ltr">
      <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" disabled={index === 0} onClick={() => move(-1)} aria-label={t("servicePictures.previous")} data-testid="service-image-previous"><ChevronLeft aria-hidden="true" className="h-5 w-5" /></Button>
      <p aria-live="polite" aria-atomic="true" className="text-sm text-center" data-testid="service-image-position">{t("servicePictures.position", { current: index + 1, total: images.length })}</p>
      <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" disabled={index === images.length - 1} onClick={() => move(1)} aria-label={t("servicePictures.next")} data-testid="service-image-next"><ChevronRight aria-hidden="true" className="h-5 w-5" /></Button>
    </div>}
  </section>;
}
