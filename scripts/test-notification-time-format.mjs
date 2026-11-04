import assert from "node:assert/strict";
import { defaultPreferences, manualPreview, renderMessage } from "../server/notifications/policy.ts";

// Pure notification policy only: no environment, HTTP, database or app startup.
const preferences = { ...defaultPreferences, phone: "+37120000001", phoneVerifiedAt: new Date("2030-01-01T00:00:00Z"), smsOptIn: true, whatsappOptIn: true };
let cases = 0;
for (const language of ["en", "lv", "ru"]) {
  for (const kind of ["accepted", "rejected", "rescheduled", "reminder"]) {
    for (const clock of ["00:00", "09:05", "12:00", "15:45", "23:59"]) {
      const rendered = renderMessage({ kind, service: "Synthetic appointment", date: new Date(`2030-01-18T${clock}:00Z`), oldDate: new Date("2030-01-17T00:00:00Z"), language, timeZone: "UTC" });
      assert.ok(rendered.date.includes(clock), `${language}/${kind}: ${clock}`);
      assert.ok(rendered.message.includes(rendered.date), "Message embeds the same 24-hour appointment label as transport parameters");
      assert.match(rendered.oldDate, /00:00 \(UTC\)$/);
      assert.doesNotMatch(rendered.message, /\b(?:AM|PM)\b/);
      if (kind === "rescheduled") assert.ok(rendered.message.includes(rendered.oldDate), "Previous appointment also uses 24-hour time");
      const preview = manualPreview({ customerName: "Synthetic customer", ...rendered, preferences, email: "synthetic@example.test" });
      for (const channel of ["email", "sms", "whatsapp"]) {
        const link = new URL(preview.channels[channel].href);
        assert.equal(link.searchParams.get(channel === "whatsapp" ? "text" : "body"), rendered.message, "Manual channel keeps the complete localized message");
      }
      cases++;
    }
  }
  const localized = renderMessage({ kind: "reminder", service: "Synthetic", date: new Date("2030-01-18T13:45:00Z"), language, timeZone: "Europe/Riga" });
  assert.match(localized.date, /15:45 \(Europe\/Riga\)$/);
  assert.ok(localized.date.includes({ en: "Jan 18, 2030", lv: "2030.", ru: "18 янв. 2030" }[language]), "Locale date order and names are retained");
  const before = renderMessage({ kind: "reminder", service: "Synthetic", date: new Date("2030-03-31T00:30:00Z"), language, timeZone: "Europe/Riga" });
  const after = renderMessage({ kind: "reminder", service: "Synthetic", date: new Date("2030-03-31T01:30:00Z"), language, timeZone: "Europe/Riga" });
  assert.match(before.date, /02:30 \(Europe\/Riga\)$/);
  assert.match(after.date, /04:30 \(Europe\/Riga\)$/);
}
console.log(`Passed ${cases} en/lv/ru notification kind/clock cases, manual links, locale dates, timezone conversion and DST transition.`);
