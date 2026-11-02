// Offline ORM/DDL contract; imports no database, configuration or services.
import { createRequire } from "node:module";
import { canonicalNotificationExpression } from "../notifications/normalize-expression.mjs";
const { generateDrizzleJson, generateMigration } = createRequire(import.meta.url)("drizzle-kit/api");
export const APPOINTMENT_PRIVATE_TABLES = Object.freeze(["booking_messages", "booking_reschedule_requests"]);
export function appointmentSnapshots(schema) {
  const current = generateDrizzleJson(schema);
  for (const table of Object.values(current.tables)) table.schema = "public";
  const previous = structuredClone(current);
  for (const name of APPOINTMENT_PRIVATE_TABLES) delete previous.tables[`public.${name}`];
  delete previous.tables['public.bookings'].columns.closed_at;
  delete previous.tables['public.bookings'].checkConstraints.bookings_closed_at_check;
  delete previous.tables['public.bookings'].indexes.bookings_message_retention_idx;
  return {previous,current};
}
export async function appointmentDDL(schema) {
  const {previous,current}=appointmentSnapshots(schema);
  return (await generateMigration(previous,current)).join("\n");
}
export function appointmentRuntimeContract(schema) {
  const {current}=appointmentSnapshots(schema), columns=[], constraints=[], indexes=[];
  const actions={"cascade":"c","no action":"a","restrict":"r","set null":"n","set default":"d"};
  for(const name of [...APPOINTMENT_PRIVATE_TABLES,'bookings']) {
    const table=current.tables[`public.${name}`];
    for(const column of Object.values(table.columns).filter(column=>name!=='bookings'||column.name==='closed_at')) columns.push({
      table:name,name:column.name,type:column.type.replace(/^varchar/,"character varying"),
      notNull:column.notNull,default:column.default===undefined?null:String(column.default)
    });
    for(const constraint of Object.values(table.checkConstraints).filter(constraint=>name!=='bookings'||constraint.name==='bookings_closed_at_check')) constraints.push({
      table:name,name:constraint.name,type:"c",expression:canonicalNotificationExpression(constraint.value)
    });
    if(name==='bookings') {
      const idx=table.indexes.bookings_message_retention_idx;
      indexes.push({table:name,name:idx.name,unique:idx.isUnique,columns:idx.columns.map(column=>column.expression),predicate:canonicalNotificationExpression(idx.where??null)});
      continue;
    }
    const primaryColumns=Object.values(table.columns).filter(column=>column.primaryKey).map(column=>column.name);
    constraints.push({table:name,name:`${name}_pkey`,type:"p",columns:primaryColumns});
    indexes.push({table:name,name:`${name}_pkey`,unique:true,columns:primaryColumns,predicate:null});
    for(const fk of Object.values(table.foreignKeys)) constraints.push({
      table:name,name:fk.name,type:"f",columns:fk.columnsFrom,referenceTable:fk.tableTo,
      referenceColumns:fk.columnsTo,onDelete:actions[fk.onDelete??"no action"]
    });
    for(const idx of Object.values(table.indexes)) indexes.push({
      table:name,name:idx.name,unique:idx.isUnique,columns:idx.columns.map(column=>column.expression),
      predicate:canonicalNotificationExpression(idx.where??null)
    });
  }
  return {version:"appointments-runtime-v1",tables:[...APPOINTMENT_PRIVATE_TABLES],columns,constraints,indexes};
}

