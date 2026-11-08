export type ServiceImageSource = { imageUrl?: string | null; imageUrls?: readonly string[] | null };

// Old application versions may still save only imageUrl after the migration.
// New clears set both imageUrls=[] and imageUrl=null/empty.
export function serviceImages(service: ServiceImageSource): string[] {
  const values = service.imageUrls?.length ? service.imageUrls : (service.imageUrl ? [service.imageUrl] : []);
  return Array.from(new Set(values.filter(value => typeof value === "string" && value.length > 0))).slice(0, 10);
}

export function imageDraft(imageUrls: string[]) {
  return { imageUrls, imageUrl: imageUrls[0] ?? "" };
}
