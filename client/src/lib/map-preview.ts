export function previewDescription(description: string | null | undefined): string {
  const text = (description ?? "").replace(/\s+/g, " ").trim();
  const characters = Array.from(text);
  if (characters.length <= 160) return text;
  const excerpt = characters.slice(0, 159).join("");
  const boundary = excerpt.lastIndexOf(" ");
  return `${(boundary > excerpt.length / 2 ? excerpt.slice(0, boundary) : excerpt).trimEnd()}…`;
}

// Use DOM text nodes so service names and descriptions are never interpreted as HTML.
export function createMapPreview({ name, description, fallback, detailsLabel, closeLabel, onDetails, onClose }: {
  name: string; description: string | null | undefined; fallback: string; detailsLabel: string; closeLabel: string;
  onDetails?: () => void; onClose: () => void;
}): HTMLElement {
  const card = document.createElement("article");
  card.className = "w-64 max-w-full space-y-2 p-1 text-neutral-800";
  const header = document.createElement("div");
  header.className = "flex items-start justify-between gap-3";
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
  summary.className = "m-0 text-sm leading-relaxed text-neutral-600 break-words line-clamp-3";
  summary.textContent = previewDescription(description) || fallback;
  card.append(header, summary);
  if (onDetails) {
    const details = document.createElement("button");
    details.type = "button";
    details.className = "min-h-9 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
    details.textContent = detailsLabel;
    details.addEventListener("click", onDetails);
    card.append(details);
  }
  return card;
}
