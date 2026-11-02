import assert from "node:assert/strict";
import { getTableName } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema.ts";
import { cleanupNotificationMetadata } from "../server/notifications/repository.ts";

// Use real offline Drizzle query construction, then evaluate its generated WHERE
// expressions against synthetic records. No SQL server/client call is permitted.
const builder = drizzle({ client: { query() { throw new Error("No database calls allowed"); } }, schema });
const dialect = new PgDialect();
const now = new Date("2026-10-29T10:00:00Z"), old = new Date("2026-09-01T00:00:00Z"), recent = new Date("2026-10-28T00:00:00Z"), future = new Date("2027-10-29T00:00:00Z");
const tables = new Map(Object.values(schema).filter(value => { try { return Boolean(getTableName(value)); } catch { return false; } }).map(table => [getTableName(table), table]));
const events = [
  ...["accepted", "rejected", "rescheduled"].map((kind, index) => ({ id: `status-${index}`, kind, createdAt: old, scheduledDate: future })),
  { id: "future-reminder", kind: "reminder", createdAt: old, scheduledDate: future },
  { id: "past-reminder", kind: "reminder", createdAt: old, scheduledDate: old },
  { id: "recent-status", kind: "accepted", createdAt: recent, scheduledDate: future },
  { id: "active-job", kind: "accepted", createdAt: old, scheduledDate: old },
  { id: "recent-job", kind: "rejected", createdAt: old, scheduledDate: old },
  { id: "leased-job", kind: "accepted", createdAt: old, scheduledDate: old },
];
const data = { notification_events: events, notification_jobs: [
  { id: "queued", eventId: "active-job", state: "queued", updatedAt: old },
  { id: "recent", eventId: "recent-job", state: "delivered", updatedAt: recent },
  { id: "leased", eventId: "leased-job", state: "leased", updatedAt: old },
], notification_callbacks: [{ id: "old", receivedAt: old }, { id: "recent", receivedAt: recent }], phone_verification_challenges: [{ id: "old", expiresAt: old }, { id: "recent", expiresAt: recent }] };
function evaluate(sql, params, context) {
  let expression = sql;
  const guards = [];
  while (expression.includes("not exists (")) {
    const start = expression.indexOf("not exists ("), open = start + "not exists ".length;
    let end = open + 1, depth = 1;
    for (; depth; end++) { if (expression[end] === "(") depth++; if (expression[end] === ")") depth--; }
    const subquery = expression.slice(open + 1, end - 1);
    const table = subquery.match(/ from "([^"]+)"/)?.[1];
    assert.ok(table && data[table], "Known synthetic subquery table");
    const where = subquery.slice(subquery.indexOf(" where ") + 7);
    guards.push(!data[table].some(row => evaluate(where, params, { ...context, [table]: row })));
    expression = `${expression.slice(0, start)} GUARD${guards.length - 1} ${expression.slice(end)}`;
  }
  const tokens = expression.match(/GUARD\d+|"[^"]+"\."[^"]+"|\$\d+|<=|>=|<>|[=<>(),]|\b(?:and|or|is|not|null|in)\b/gi) ?? [];
  let index = 0;
  const peek = () => tokens[index]?.toLowerCase();
  const expect = value => { assert.equal(peek(), value); index++; };
  const value = () => {
    const token = tokens[index++];
    if (token.startsWith("$")) return params[Number(token.slice(1)) - 1];
    const [, tableName, column] = token.match(/^"([^"]+)"\."([^"]+)"$/) ?? [];
    assert.ok(context[tableName], `Bound synthetic relation ${tableName}`);
    const property = Object.entries(tables.get(tableName)).find(([, descriptor]) => descriptor?.name === column)?.[0];
    const result = context[tableName][property]; return result instanceof Date ? result.toISOString() : result;
  };
  const atom = () => {
    if (peek()?.startsWith("guard")) return guards[Number(tokens[index++].slice(5))];
    if (peek() === "(") { index++; const result = expressionValue(); expect(")"); return result; }
    const left = value(), op = tokens[index++].toLowerCase();
    if (op === "in") { expect("("); const candidates = [value()]; while (peek() === ",") { index++; candidates.push(value()); } expect(")"); return candidates.includes(left); }
    const right = value();
    if (op === "=") return left === right;
    if (op === "<>") return left !== right;
    if (op === "<") return left < right;
    if (op === ">") return left > right;
    throw new Error(`Unsupported synthetic predicate ${op}`);
  };
  const andValue = () => { let result = atom(); while (peek() === "and") { index++; const next = atom(); result = result && next; } return result; };
  const expressionValue = () => { let result = andValue(); while (peek() === "or") { index++; const next = andValue(); result = result || next; } return result; };
  const result = expressionValue(); assert.equal(index, tokens.length, "Complete generated predicate evaluated"); return result;
}
await cleanupNotificationMetadata({ select: builder.select.bind(builder), delete(table) { return { async where(condition) {
  const name = getTableName(table), query = dialect.sqlToQuery(condition);
  data[name] = data[name].filter(row => !evaluate(query.sql, query.params, { [name]: row }));
} }; } }, now);
assert.deepEqual(data.notification_events.map(row => row.id), ["future-reminder", "recent-status", "active-job", "recent-job", "leased-job"]);
assert.deepEqual(data.notification_callbacks.map(row => row.id), ["recent"]);
assert.deepEqual(data.phone_verification_challenges.map(row => row.id), ["recent"]);
console.log("Notification retention: 13 synthetic records verified against actual generated deletion predicates (no database).");
