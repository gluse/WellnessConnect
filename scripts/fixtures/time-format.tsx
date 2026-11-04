import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import ScheduleEditModal from "../../client/src/components/schedule-edit-modal";
import { formatDateTime24 } from "../../client/src/lib/date-time";
import type { Availability } from "../../shared/schema";

const fixture = { ready: false, saves: [] as unknown[], unexpected: [] as string[] };
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async input => { fixture.unexpected.push(String(input)); throw Error("Unexpected request"); };
const schedule: Availability = {
  id: 1, providerId: "synthetic-provider", companyId: null, serviceId: null,
  createdAt: null, updatedAt: null, isActive: true, timezone: "UTC",
  scheduleType: "specific", specificDate: new Date("2030-01-18T00:00:00Z"),
  daysOfWeek: null, recurrenceEndType: null, recurrenceEndValue: null,
  startTime: "09:00", endTime: "17:00", slotDuration: 30,
  breaks: [{ startTime: "12:00", endTime: "13:00" }],
};
function Fixture() {
  const [language, setLanguage] = useState("en");
  useEffect(() => { fixture.ready = true; }, []);
  return <main>
    <label>Language<select id="fixture-language" value={language} onChange={event => setLanguage(event.target.value)}>{["en", "lv", "ru"].map(value => <option key={value}>{value}</option>)}</select></label>
    <div id="times">{["00:00", "12:00", "15:45", "23:59"].map(time => <p key={time}>{formatDateTime24(`2030-01-18T${time}:00Z`, language, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}</p>)}</div>
    <ScheduleEditModal schedule={schedule} clickedDate={new Date("2030-01-18T12:00:00Z")} isRecurring={false} services={[]} onClose={() => {}} onDelete={() => {}} onSave={data => fixture.saves.push(data)} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
