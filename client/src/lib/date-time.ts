// The clock preference is app-wide; language and appointment timezone stay independent.
export function formatDateTime24(
  value: string | Date,
  language?: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  },
) {
  return new Intl.DateTimeFormat(language, { ...options, hour12: false, hourCycle: "h23" }).format(new Date(value));
}
