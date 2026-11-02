// Offline ORM/DDL contract. Imports no database, environment files, or providers.
import { createRequire } from "node:module";
import { canonicalNotificationExpression } from "./normalize-expression.mjs";
const { generateDrizzleJson, generateMigration } = createRequire(import.meta.url)("drizzle-kit/api");

export const PRIVATE_TABLES = Object.freeze([
  "user_communication_preferences", "phone_verification_challenges",
  "notification_events", "notification_jobs", "notification_delivery_attempts", "notification_callbacks",
]);

export function notificationSnapshots(schema) {
  const current = generateDrizzleJson(schema);
  // Migration search_path deliberately excludes public. Qualify emitted DDL,
  // including ALTERs on legacy tables, rather than trusting caller search_path.
  for (const table of Object.values(current.tables)) table.schema = "public";
  const previous = structuredClone(current);
  for (const name of PRIVATE_TABLES) delete previous.tables[`public.${name}`];
  for (const name of ["reminder_enabled", "reminder_method", "reminder_hours"]) {
    delete previous.tables["public.services"].columns[name];
  }
  delete previous.tables["public.services"].checkConstraints.services_reminder_settings_check;
  delete previous.tables["public.bookings"].columns.notification_revision;
  delete previous.tables["public.bookings"].checkConstraints.bookings_notification_revision_check;
  return { previous, current };
}

export async function notificationDDL(schema) {
  const { previous, current } = notificationSnapshots(schema);
  return (await generateMigration(previous, current)).join("\n");
}

export function notificationRuntimeContract(schema) {
  const { current } = notificationSnapshots(schema);
  const columns = [], constraints = [], indexes = [];
  for (const tableName of [...PRIVATE_TABLES, "services", "bookings"]) {
    const table = current.tables[`public.${tableName}`], privateTable = PRIVATE_TABLES.includes(tableName);
    for (const column of Object.values(table.columns)) {
      if (!privateTable && !(tableName === "services" ? ["reminder_enabled", "reminder_method", "reminder_hours"] : ["notification_revision"]).includes(column.name)) continue;
      columns.push({ table: tableName, name: column.name, type: column.type.replace(/^varchar/, "character varying"), notNull: column.notNull,
        default: column.default === undefined ? null : String(column.default) });
    }
    for (const constraint of Object.values(table.checkConstraints)) {
      if (!privateTable && !["services_reminder_settings_check", "bookings_notification_revision_check"].includes(constraint.name)) continue;
      constraints.push({ table: tableName, name: constraint.name, type: "c", expression: canonicalNotificationExpression(constraint.value) });
    }
    if (!privateTable) continue;
    const primaryColumns = Object.values(table.columns).filter(column => column.primaryKey).map(column => column.name);
    constraints.push({ table: tableName, name: `${tableName}_pkey`, type: "p", columns: primaryColumns });
    indexes.push({ table: tableName, name: `${tableName}_pkey`, unique: true, columns: primaryColumns, predicate: null });
    for (const fk of Object.values(table.foreignKeys)) constraints.push({ table: tableName, name: fk.name, type: "f", columns: fk.columnsFrom, referenceTable: fk.tableTo, referenceColumns: fk.columnsTo, onDelete: "c" });
    for (const index of Object.values(table.indexes)) indexes.push({ table: tableName, name: index.name, unique: index.isUnique, columns: index.columns.map(column => column.expression), predicate: canonicalNotificationExpression(index.where ?? null) });
  }
  return { version: "notifications-runtime-v1", tables: [...PRIVATE_TABLES], columns, constraints, indexes };
}
