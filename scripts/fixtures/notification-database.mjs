import assert from "node:assert/strict";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../../shared/schema.ts";

// In-memory database boundary for the real worker decision/dispatch function.
// It evaluates generated, parameterized Drizzle predicates; it does not mock
// entitlement, consent, expiry, stale-event or duplicate-send decisions.
const tableNames = ["bookings", "services", "users", "companies", "providerSubscriptions", "userCommunicationPreferences", "notificationEvents", "notificationJobs", "notificationDeliveryAttempts", "phoneVerificationChallenges", "notificationCallbacks", "bookingMessages", "bookingRescheduleRequests", "availability", "companyMemberships"];
const tables = new Map(tableNames.map(key => [getTableName(schema[key]), schema[key]]));
const dialect = new PgDialect();
function sqlTwelveMonthAnniversary(value) {
  const anchor = new Date(value), year = anchor.getUTCFullYear() + 1, month = anchor.getUTCMonth();
  return new Date(Date.UTC(year, month, Math.min(anchor.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate()), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds()));
}
function matches(table, row, condition, data = {}) {
  if (!condition) return true;
  const query = dialect.sqlToQuery(condition);
  // Interpret the appointment overlap interval at the persistence boundary.
  // The production predicate uses each old booking's own service duration when
  // its historical duration snapshot is null.
  query.sql = query.sql.replace(/"bookings"\."scheduled_date" \+ .*? interval '1 minute' > (\$\d+)::timestamp/g, (_expression, parameter) => {
    const target = query.params[Number(parameter.slice(1)) - 1];
    const duration = row.bookingDuration ?? data.services?.find(service => service.id === row.serviceId)?.duration ?? 60;
    const overlaps = new Date(row.scheduledDate).getTime() + (duration + (row.bookingCleanupTime ?? 0)) * 60000 > new Date(target).getTime();
    query.params.push(overlaps, true); return `$${query.params.length - 1} = $${query.params.length}`;
  });
  query.sql = query.sql.replace(/NOT EXISTS \(SELECT 1 FROM "booking_messages" WHERE "booking_messages"\."booking_id" = "bookings"\."id" AND "booking_messages"\."created_at" > (\$\d+)\)/gi, (_expression, parameter) => {
    const cutoff = new Date(query.params[Number(parameter.slice(1)) - 1]);
    const noRecent = !data.booking_messages?.some(message => message.bookingId === row.id && new Date(message.createdAt) > cutoff);
    query.params.push(noRecent, true); return `$${query.params.length - 1} = $${query.params.length}`;
  });
  query.sql = query.sql.replace(/NOT EXISTS \(SELECT 1 FROM "booking_messages" WHERE "booking_messages"\."booking_id" = "bookings"\."id" AND \(\("booking_messages"\."created_at" AT TIME ZONE 'UTC'\) \+ interval '12 months'\) AT TIME ZONE 'UTC' > (\$\d+)\)/gi, (_expression, parameter) => {
    const now = new Date(query.params[Number(parameter.slice(1)) - 1]);
    const noRecent = !data.booking_messages?.some(message => message.bookingId === row.id && sqlTwelveMonthAnniversary(message.createdAt) > now);
    query.params.push(noRecent, true); return `$${query.params.length - 1} = $${query.params.length}`;
  });
  query.sql = query.sql.replace(/\(\("bookings"\."closed_at" AT TIME ZONE 'UTC'\) \+ interval '12 months'\) AT TIME ZONE 'UTC' <= (\$\d+)/gi, (_expression, parameter) => {
    const now = new Date(query.params[Number(parameter.slice(1)) - 1]);
    query.params.push(row.closedAt != null && sqlTwelveMonthAnniversary(row.closedAt) <= now, true);
    return `$${query.params.length - 1} = $${query.params.length}`;
  });
  query.sql = query.sql.replace(/EXISTS \(SELECT 1 FROM "booking_messages" WHERE "booking_messages"\."booking_id" = "bookings"\."id"\)/gi, () => {
    query.params.push(data.booking_messages?.some(message => message.bookingId === row.id) ?? false, true);
    return `$${query.params.length - 1} = $${query.params.length}`;
  });
  const tokens = query.sql.match(/"[^"]+"\."[^"]+"|\$\d+|<=|>=|<>|[=<>(),]|\b(?:and|or|is|not|null|in|true|false)\b/gi) ?? [];
  let index = 0;
  const peek = () => tokens[index]?.toLowerCase();
  const consume = expected => { assert.equal(peek(), expected, `Supported mock SQL syntax: ${query.sql}`); index++; };
  const value = () => {
    const token = tokens[index++];
    if (token.startsWith("$")) return query.params[Number(token.slice(1)) - 1];
    const [, tableName, columnName] = token.match(/^"([^"]+)"\."([^"]+)"$/) ?? [];
    assert.equal(tableName, getTableName(table), "Queries remain scoped to the selected table");
    const property = Object.entries(tables.get(tableName)).find(([, column]) => column?.name === columnName)?.[0];
    assert.ok(property, `Known column ${columnName}`);
    return row[property] instanceof Date ? row[property].toISOString() : row[property];
  };
  const atom = () => {
    if (peek() === "(") { index++; const result = expression(); consume(")"); return result; }
    const left = value(), operator = tokens[index++].toLowerCase();
    if (operator === "is") { const invert = peek() === "not"; if (invert) index++; consume("null"); return invert ? left != null : left == null; }
    if (operator === "in") { consume("("); const values = [value()]; while (peek() === ",") { index++; values.push(value()); } consume(")"); return values.includes(left); }
    const right = value();
    if (operator === "=") return left === right;
    if (operator === "<>") return left !== right;
    if (operator === ">") return left > right;
    if (operator === "<") return left < right;
    if (operator === ">=") return left >= right;
    if (operator === "<=") return left <= right;
    throw new Error(`Unsupported mock operator ${operator}`);
  };
  const conjunction = () => { let result = atom(); while (peek() === "and") { index++; const next = atom(); result = result && next; } return result; };
  const expression = () => { let result = conjunction(); while (peek() === "or") { index++; const next = conjunction(); result = result || next; } return result; };
  const result = expression(); assert.equal(index, tokens.length, `Predicate fully evaluated: ${query.sql}`); return result;
}
export function memoryDatabase(seed) {
  const data = Object.fromEntries([...tables.keys()].map(name => [name, structuredClone(seed[name] ?? [])]));
  const operations = [];
  const database = {
    select(selection) {
      let table, condition, limit, grouping, ordering = [];
      const builder = { from(value) { table = value; return this; }, where(value) { condition = value; return this; }, for() { return this; }, groupBy(value) { grouping = value; return this; }, orderBy(...values) { ordering = values; return this; }, limit(value) { limit = value; return this; },
        then(resolve, reject) { return Promise.resolve().then(() => {
          let rows = data[getTableName(table)].filter(row => matches(table, row, condition, data));
          if (grouping) {
            const property = Object.entries(table).find(([, value]) => value === grouping)?.[0];
            const groups = Map.groupBy(rows, row => row[property]);
            return Array.from(groups.values(), group => Object.fromEntries(Object.entries(selection).map(([name, column]) => {
              if (column?.getSQL && /max\(/i.test(dialect.sqlToQuery(column.getSQL()).sql)) {
                const columnName = dialect.sqlToQuery(column.getSQL()).sql.match(/"[^\"]+"\."([^\"]+)"/)?.[1];
                const key = Object.entries(table).find(([, value]) => value?.name === columnName)?.[0];
                return [name, new Date(Math.max(...group.map(row => new Date(row[key]).getTime())))];
              }
              return [name, group[0][Object.entries(table).find(([, value]) => value === column)?.[0]]];
            })));
          }
          for (const orderingSql of ordering.toReversed()) {
            const text = dialect.sqlToQuery(orderingSql.getSQL()).sql;
            const column = text.match(/"[^\"]+"\."([^\"]+)"/)?.[1];
            const property = Object.entries(table).find(([, value]) => value?.name === column)?.[0];
            const direction = /\bdesc\b/i.test(text) ? -1 : 1;
            rows.sort((a, b) => (a[property] > b[property] ? 1 : a[property] < b[property] ? -1 : 0) * direction);
          }
          rows = rows.slice(0, limit);
          return rows.map(row => selection ? Object.fromEntries(Object.entries(selection).map(([name, column]) => [name, row[Object.entries(table).find(([, value]) => value === column)?.[0]]])) : { ...row });
        }).then(resolve, reject); } };
      return builder;
    },
    update(table) {
      let values, condition;
      const builder = { set(value) { values = value; return this; }, where(value) { condition = value; return this; }, returning() { return this; },
        then(resolve, reject) { return Promise.resolve().then(() => {
          const rows = data[getTableName(table)].filter(row => matches(table, row, condition, data));
          rows.forEach(row => Object.assign(row, values)); operations.push({ table: getTableName(table), values }); return rows.map(row => ({ ...row }));
        }).then(resolve, reject); } };
      return builder;
    },
    insert(table) {
      let values, conflictUpdate;
      const builder = { values(value) { values = value; return this; }, onConflictDoNothing() { return this; }, onConflictDoUpdate(value) { conflictUpdate = value; return this; }, returning() { return this; },
        then(resolve, reject) { return Promise.resolve().then(() => {
          const name = getTableName(table), rows = data[name];
          const existing = rows.find(row => values.jobId ? row.jobId === values.jobId : values.userId && name === "user_communication_preferences" ? row.userId === values.userId
            : name === "notification_callbacks" ? row.provider === values.provider && row.providerEventId === values.providerEventId : values.id && row.id === values.id);
          if (existing) {
            if (conflictUpdate && matches(table, existing, conflictUpdate.setWhere, data)) Object.assign(existing, conflictUpdate.set);
            return [];
          }
          const defaults = name === "user_communication_preferences" ? { phone: null, phoneVerifiedAt: null, preferredMethod: null, smsOptIn: false, whatsappOptIn: false, language: "en", emailSuppressed: false }
            : name === "phone_verification_challenges" ? { status: "pending", attemptCount: 0, providerRequestId: null } : {};
          const row = { ...defaults, ...values }; rows.push(row); operations.push({ table: name, values }); return [{ ...row }];
        }).then(resolve, reject); } };
      return builder;
    },
    delete(table) {
      let condition;
      const builder = { where(value) { condition = value; return this; }, returning() { return this; }, then(resolve, reject) {
        return Promise.resolve().then(() => {
          const name = getTableName(table), removed = data[name].filter(row => matches(table, row, condition, data));
          data[name] = data[name].filter(row => !removed.includes(row)); operations.push({ table: name, deleted: removed.length });
          return removed.map(row => ({ ...row }));
        }).then(resolve, reject);
      } }; return builder;
    },
    async execute(statement) {
      const query = dialect.sqlToQuery(statement);
      if (!query.sql.includes("AS workspace_attempts")) return { rows: [] }; // advisory lock boundary
      const [seekerId, cutoff, workspaceId] = query.params;
      const company = query.sql.includes("b.company_id =");
      const attempts = data.notification_delivery_attempts.filter(attempt => {
        if (!attempt.createdAt || attempt.createdAt < cutoff) return false;
        const job = data.notification_jobs.find(row => row.id === attempt.jobId), event = data.notification_events.find(row => row.id === job?.eventId), booking = data.bookings.find(row => row.id === event?.bookingId);
        return booking && (company ? booking.companyId === workspaceId : booking.companyId == null && booking.providerId === workspaceId);
      });
      const customerAttempts = attempts.filter(attempt => {
        const job = data.notification_jobs.find(row => row.id === attempt.jobId), event = data.notification_events.find(row => row.id === job?.eventId);
        return data.bookings.find(row => row.id === event?.bookingId)?.seekerId === seekerId;
      });
      return { rows: [{ workspace_attempts: attempts.length, customer_attempts: customerAttempts.length }] };
    },
    async transaction(action) {
      const snapshot = structuredClone(data);
      try { return await action(database); }
      catch (error) { Object.assign(data, snapshot); throw error; }
    },
  };
  return { database, data, operations };
}
