import type { CommunicationMethod } from "@shared/notifications";

// Preview URLs are private server output, but still validate the browser boundary.
export function safeNotificationHref(method: CommunicationMethod, value: string | null): string | undefined {
  if (!value || /[\r\n\u0000]/.test(value)) return undefined;
  if (method === "sms") return /^sms:\+[1-9]\d{7,14}\?body=[^#]*$/.test(value) ? value : undefined;
  if (method === "email") {
    try {
      const url = new URL(value), email = decodeURIComponent(url.pathname);
      return url.protocol === "mailto:" && !url.hash && /^[^\s?<>@]+@[^\s?<>@]+$/.test(email) && url.searchParams.has("subject") && url.searchParams.has("body") ? value : undefined;
    } catch { return undefined; }
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "wa.me" && !url.port && !url.username && !url.password && /^\/[1-9]\d{7,14}$/.test(url.pathname) && !url.hash && url.searchParams.has("text") ? value : undefined;
  } catch { return undefined; }
}
