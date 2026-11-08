/** Gallery rules are pure so callers can validate without initializing Storage or DB. */
export type ServiceImages = { imageUrl?: string | null; imageUrls?: string[] };

export class ServiceImageError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function serviceImageList(service: ServiceImages): string[] {
  return service.imageUrls?.length ? [...service.imageUrls] : service.imageUrl ? [service.imageUrl] : [];
}

export function serviceImageChanges(input: ServiceImages, previous?: ServiceImages): ServiceImages {
  // An unrelated PATCH must not erase the gallery. Explicit legacy cover changes
  // replace the gallery; current clients send the complete ordered array.
  if (previous && input.imageUrls === undefined && input.imageUrl === undefined) return {};
  const imageUrls = input.imageUrls === undefined ? input.imageUrl ? [input.imageUrl] : [] : [...input.imageUrls];
  if (imageUrls.length > 10 || new Set(imageUrls).size !== imageUrls.length) {
    throw new ServiceImageError(400, "Choose up to 10 different service pictures.");
  }
  return { imageUrls, imageUrl: imageUrls[0] ?? null };
}

export function assertServiceImageEntitlement(images: ServiceImages, pro: boolean, previous?: ServiceImages) {
  const next = serviceImageList(images);
  // Expiry never deletes existing pictures. A downgraded owner can keep, reorder
  // or remove them, but adding a new picture above the free limit requires Pro.
  if (!pro && next.length > 1 && (!previous || next.some(path => !serviceImageList(previous).includes(path)))) {
    throw new ServiceImageError(403, "An active Pro subscription is required to add more than one service picture.");
  }
}
