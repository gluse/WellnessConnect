export function previewDescription(description: string | null | undefined): string {
  const text = (description ?? "").replace(/\s+/g, " ").trim();
  const characters = Array.from(text);
  if (characters.length <= 160) return text;
  const excerpt = characters.slice(0, 159).join("");
  const boundary = excerpt.lastIndexOf(" ");
  return `${(boundary > excerpt.length / 2 ? excerpt.slice(0, boundary) : excerpt).trimEnd()}…`;
}

// Use DOM text nodes so service names and descriptions are never interpreted as HTML.
export function createMapPreview({ name, description, fallback, detailsLabel, closeLabel, imageUrl, metadata = [], onDetails, onClose }: {
  name: string; description: string | null | undefined; fallback: string; detailsLabel: string; closeLabel: string;
  imageUrl?: string | null; metadata?: string[];
  onDetails?: () => void; onClose: () => void;
}): HTMLElement {
  const card = document.createElement("article");
  card.className = "search-map-preview";
  const header = document.createElement("div");
  header.className = "search-map-preview-heading";
  const title = document.createElement("h3");
  title.className = "m-0 text-base font-semibold break-words line-clamp-2";
  title.textContent = name;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "shrink-0 rounded px-2 py-1 text-lg leading-none hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  close.setAttribute("aria-label", closeLabel);
  close.textContent = "×";
  close.addEventListener("click", onClose);
  header.append(title, close);
  const summary = document.createElement("p");
  summary.className = "search-map-preview-description";
  summary.textContent = previewDescription(description) || fallback;
  card.append(header, summary);
  if (onDetails) {
    const details = document.createElement("button");
    details.type = "button";
    details.className = "search-map-preview-details";
    details.textContent = detailsLabel;
    details.addEventListener("click", onDetails);
    card.append(details);
  }
  const art = document.createElement("div");
  art.className = "search-service-art";
  art.setAttribute("aria-hidden", "true");
  const showPlaceholder = () => { art.textContent = "◇"; };
  if (imageUrl) {
    const image = document.createElement("img");
    image.setAttribute("src", imageUrl);
    image.setAttribute("alt", "");
    image.setAttribute("loading", "lazy");
    image.addEventListener("error", showPlaceholder, { once: true });
    art.append(image);
  } else showPlaceholder();
  const labels = document.createElement("div");
  labels.className = "search-map-preview-meta";
  for (const label of metadata) {
    const item = document.createElement("span");
    item.textContent = label;
    labels.append(item);
  }
  card.append(art, labels);
  return card;
}
