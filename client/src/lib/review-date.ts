export function relativeReviewDate(date: string, locale: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  const format = new Intl.RelativeTimeFormat(locale || "en", { numeric: "auto" });
  if (seconds < 60) return format.format(0, "second");
  const units = [[31536000, "year"], [2592000, "month"], [86400, "day"], [3600, "hour"], [60, "minute"]] as const;
  const [size, unit] = units.find(([size]) => seconds >= size)!;
  return format.format(-Math.floor(seconds / size), unit);
}
