// Run: node --import tsx migrations/notifications/check.mjs
// Static offline evidence only; this does not connect to or execute PostgreSQL.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as schema from "../../shared/schema.ts";
import { notificationDDL, notificationRuntimeContract, notificationSnapshots, PRIVATE_TABLES } from "./contract.mjs";

const ddl = await readFile(new URL("./0014_notifications.sql", import.meta.url), "utf8");
const generated = ddl.split("-- BEGIN GENERATED NOTIFICATIONS DDL\n")[1]?.split("\n-- END GENERATED NOTIFICATIONS DDL")[0];
assert.ok(generated, "Explicit generated DDL markers exist");
assert.equal(generated.replaceAll("\r", ""), (await notificationDDL(schema)).replaceAll("\r", ""), "Prepared SQL must match ORM columns, constraints, indexes, and RLS exactly");
assert.ok(!/(?:^|;)\s*(?:DROP|TRUNCATE|INSERT|DELETE)\b|\bDROP\s+(?:COLUMN|CONSTRAINT)\b/im.test(generated), "Expansion must preserve existing rows and columns");
assert.ok(!/\b(?:CREATE TABLE|ALTER TABLE)\s+"(?!public")/i.test(generated), "DDL explicitly qualifies public schema");
const { current } = notificationSnapshots(schema);
for (const name of PRIVATE_TABLES) {
  assert.equal(current.tables[`public.${name}`].isRLSEnabled, true, name);
  assert.ok(ddl.includes(`REVOKE ALL ON TABLE public.${name} FROM PUBLIC, anon, authenticated, service_role`), `${name}: browser/private role access revoked`);
  assert.ok(!Object.keys(current.tables[`public.${name}`].columns).some(column => /body|payload|recipient|secret|credential|code_hash/.test(column)), `${name}: no message bodies/provider payloads/secrets`);
}
assert.equal(current.tables["public.services"].columns.reminder_enabled.default, false);
assert.equal(current.tables["public.services"].columns.reminder_hours.default, 24);
assert.equal(current.tables["public.bookings"].columns.notification_revision.default, 0);
assert.equal(current.tables["public.user_communication_preferences"].columns.email_suppressed.default, false);
assert.equal("notificationRevision" in schema.insertBookingSchema.shape, false, "Requesters cannot write server notification revision");
assert.equal(current.tables["public.notification_events"].indexes.notification_reminder_identity.isUnique, true);
assert.match(current.tables["public.notification_events"].indexes.notification_reminder_identity.where, /'reminder'/);
assert.equal(current.tables["public.notification_jobs"].indexes.notification_job_event_identity.isUnique, true);
assert.equal(current.tables["public.notification_delivery_attempts"].indexes.notification_attempt_job_identity.isUnique, true);
assert.deepEqual(current.tables["public.notification_delivery_attempts"].indexes.notification_attempt_recent_idx.columns.map(column => column.expression), ["created_at", "job_id"], "Hourly attempt quota has a time-leading access path into job joins");
assert.equal(current.tables["public.notification_callbacks"].indexes.notification_callback_identity.isUnique, true);
assert.ok(!Object.keys(current.tables["public.users"].columns).some(column => /phone|communication|opt_in/.test(column)), "Private preferences do not alter public users");
for (const hours of [0, 169, 1.1]) assert.equal(schema.insertServiceSchema.shape.reminderHours.safeParse(hours).success, false);
for (const hours of [1, 24, 168]) assert.equal(schema.insertServiceSchema.shape.reminderHours.safeParse(hours).success, true);
const runtime = await readFile(new URL("./0015_notifications_runtime.sql", import.meta.url), "utf8");
for (const name of PRIVATE_TABLES) {
  assert.ok(runtime.includes(`ON public.${name} TO fm_app_runtime`), `${name}: explicit server grant`);
  assert.ok(runtime.includes(`ON public.${name} FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true)`), `${name}: server-only RLS policy`);
}
assert.ok(!/TO\s+(?:PUBLIC|anon|authenticated|service_role)\b/i.test(runtime));
assert.deepEqual(JSON.parse(await readFile(new URL("./runtime-contract.json", import.meta.url), "utf8")), notificationRuntimeContract(schema), "Current app readiness manifest must match notification ORM");
console.log("Passed offline notifications ORM/SQL parity, additive migration, private-table RLS/ACL contract, uniqueness, defaults, and reminder input boundaries. No database or service accessed.");
