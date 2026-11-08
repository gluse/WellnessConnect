import assert from "node:assert/strict";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { createServiceReport, presetPeriod, validPeriod } from "../client/src/lib/service-report.ts";
import { reportCsv, reportXlsx } from "../client/src/lib/report-downloads.ts";
const row = (id, status, amount, currency = "EUR", scheduledDate = "2026-11-07T12:00:00") => ({ id, status, totalAmount: amount, currency, scheduledDate, service: { name: "Ārstēšana — Услуга" } });
const period = { from: "2026-11-01", to: "2026-11-30" };
const report = createServiceReport([row(1, "completed", "0.10"), row(2, "completed", "0.20"), row(3, "pending", "10.00"), row(4, "confirmed", "20.00"), row(5, "cancelled", "5.00"), row(6, "completed", "200", "JPY"), row(7, "completed", "1.001", "KWD"), row(8, "completed", "100.00", "EUR", "2026-12-01T00:00:00"), row(9, "completed", "2.00", "EUR", "2026-11-30T23:59:59.999")], period);
assert.equal(report.rows.length, 8);
assert.deepEqual(report.totals, [{ currency: "EUR", earned: "2.30", planned: "20.00", pending: "10.00", lost: "5.00" }, { currency: "JPY", earned: "200", planned: "0", pending: "0", lost: "0" }, { currency: "KWD", earned: "1.001", planned: "0.000", pending: "0.000", lost: "0.000" }]);
const pending = createServiceReport([
  row(1, "pending", "0.10", "EUR", "2026-11-01T00:00:00"), row(2, null, "0.20"),
  row(3, "pending", "0.30", "EUR", "2026-11-30T23:59:59.999"),
  row(4, "pending", "999", "EUR", "2026-10-31T23:59:59.999"), row(5, "pending", "999", "EUR", "2026-12-01T00:00:00"),
  row(6, "pending", "25", "JPY"), row(7, "pending", "0.001", "KWD"), row(8, "pending", "0.002", "KWD"),
], period);
assert.deepEqual(pending.totals, [{ currency: "EUR", earned: "0.00", planned: "0.00", pending: "0.60", lost: "0.00" }, { currency: "JPY", earned: "0", planned: "0", pending: "25", lost: "0" }, { currency: "KWD", earned: "0.000", planned: "0.000", pending: "0.003", lost: "0.000" }]);
assert.equal(pending.rows.find(row => row.id === 2).status, "pending", "Legacy null status stays pending");
assert.deepEqual(createServiceReport([row(1, "confirmed", "0.00")], period).totals, [{ currency: "EUR", earned: "0.00", planned: "0.00", pending: "0.00", lost: "0.00" }]);
assert.deepEqual(createServiceReport([], period), { rows: [], totals: [] });
assert.equal(validPeriod({ from: "2026-02-30", to: "2026-03-01" }), false);
assert.equal(validPeriod({ from: "2026-11-08", to: "2026-11-07" }), false);
assert.deepEqual(presetPeriod("week", new Date(2026, 10, 8)), { from: "2026-11-02", to: "2026-11-08" });
assert.deepEqual(presetPeriod("month", new Date(2028, 1, 9)), { from: "2028-02-01", to: "2028-02-29" });
const doc = { title: "Services report", subtitle: "November", note: "Booking values", summary: [["Currency", "Earned", "Planned", "Pending", "Lost"], ...report.totals.map(total => [total.currency, Number(total.earned), Number(total.planned), Number(total.pending), Number(total.lost)])], columns: ["Service", "Date", "Status", "Amount", "Currency"], rows: [["=HYPERLINK(\"bad\")", "2026-11-07", "Completed", .3, "EUR"], ["Ārstēšana — Услуга < & >", "2026-11-07", "Completed", 1, "EUR"]] };
const csv = await reportCsv(doc).text();
assert.match(csv, /"'=HYPERLINK/); assert.match(csv, /Ārstēšana — Услуга/);
assert.match(csv, /"Currency","Earned","Planned","Pending","Lost"/);
assert.match(csv, /"EUR","2.3","20","10","5"/);
const xlsx = new Uint8Array(await reportXlsx(doc).arrayBuffer());
assert.match(new TextDecoder().decode(xlsx), /<c r="D6"><v>10<\/v><\/c>/, "Pending summary cell is numeric and summable");
await mkdir("output/reports-pending-check", { recursive: true });
await writeFile("output/reports-pending-check/report.xlsx", xlsx);
for (const language of ["en", "lv", "ru"]) {
  const resource = JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8"));
  for (const [key, value] of Object.entries(resource.reports)) assert.equal(typeof value, "string", `${language}/${key}`);
  assert.match(resource.reports.timezone, /{{timezone}}/);
  assert.ok(resource.reports.pendingHelp.trim());
}
console.log("Passed report date boundaries, presets, exact currency totals, status buckets, empty state, CSV injection protection, XLSX generation and en/lv/ru resources.");
