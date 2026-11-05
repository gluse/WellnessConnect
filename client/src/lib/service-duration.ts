export const durationUnits = ["minute", "hour", "day"] as const;
export type DurationUnit = typeof durationUnits[number];
export const minutesPerUnit: Record<DurationUnit, number> = { minute: 1, hour: 60, day: 1440 };

// Units are presentation only. The API and draft always contain minutes.
export function preferredDurationUnit(minutes: number): DurationUnit {
  if (minutes > 0 && minutes % 1440 === 0) return "day";
  if (minutes > 0 && minutes % 60 === 0) return "hour";
  return "minute";
}

export function durationInMinutes(value: string, unit: DurationUnit): number {
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value.trim())) return NaN;
  // Accept decimal comma as well as dot; keep the user's text stable across locales.
  const minutes = Number(value.replace(",", ".")) * minutesPerUnit[unit];
  // Remove only floating point multiplication noise; do not round partial minutes.
  const whole = Math.round(minutes);
  return Math.abs(minutes - whole) < 1e-9 ? whole : minutes;
}

export function formatServiceDuration(minutes: number, language: string): string {
  const parts: string[] = [];
  let remaining = minutes;
  for (const unit of ["day", "hour", "minute"] as const) {
    const count = unit === "minute" ? remaining : Math.floor(remaining / minutesPerUnit[unit]);
    if (count > 0 || (unit === "minute" && !parts.length)) {
      parts.push(new Intl.NumberFormat(language, { style: "unit", unit, unitDisplay: "long" }).format(count));
    }
    remaining %= minutesPerUnit[unit];
  }
  return new Intl.ListFormat(language, { style: "short", type: "unit" }).format(parts);
}
