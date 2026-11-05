// Offline ORM metadata only. No configuration, database or external services.
import {createRequire} from 'node:module';
import {canonicalNotificationExpression} from '../notifications/normalize-expression.mjs';
const {generateDrizzleJson,generateMigration}=createRequire(import.meta.url)('drizzle-kit/api');
export const WISHLIST_PRIVATE_TABLES=Object.freeze(['wishlist_services','product_activity_events','service_activity_groups','service_activity_reads','booking_message_reads']);
export function wishlistSnapshots(schema){
 const current=generateDrizzleJson(schema);
 for(const table of Object.values(current.tables))table.schema='public';
 const previous=structuredClone(current);
 for(const name of WISHLIST_PRIVATE_TABLES)delete previous.tables[`public.${name}`];
 return {previous,current};
}
export async function wishlistDDL(schema){const {previous,current}=wishlistSnapshots(schema);return (await generateMigration(previous,current)).join('\n');}
export function wishlistRuntimeContract(schema){
 const {current}=wishlistSnapshots(schema),columns=[],constraints=[],indexes=[];
 for(const name of WISHLIST_PRIVATE_TABLES){
  const table=current.tables[`public.${name}`];
  for(const column of Object.values(table.columns))columns.push({table:name,name:column.name,type:column.type.replace(/^varchar/,'character varying'),notNull:column.notNull,default:column.default===undefined?null:String(column.default)});
  for(const constraint of Object.values(table.checkConstraints))constraints.push({table:name,name:constraint.name,type:'c',expression:canonicalNotificationExpression(constraint.value)});
  const primary=Object.values(table.compositePrimaryKeys)[0]??{name:`${name}_pkey`,columns:Object.values(table.columns).filter(column=>column.primaryKey).map(column=>column.name)};
  constraints.push({table:name,name:primary.name,type:'p',columns:primary.columns});
  indexes.push({table:name,name:primary.name,unique:true,columns:primary.columns,descending:primary.columns.map(()=>false),predicate:null});
  for(const fk of Object.values(table.foreignKeys))constraints.push({table:name,name:fk.name,type:'f',columns:fk.columnsFrom,referenceTable:fk.tableTo,referenceColumns:fk.columnsTo,onDelete:({'cascade':'c','no action':'a','restrict':'r','set null':'n','set default':'d'})[fk.onDelete??'no action']});
  for(const idx of Object.values(table.indexes))indexes.push({table:name,name:idx.name,unique:idx.isUnique,columns:idx.columns.map(column=>column.expression),descending:idx.columns.map(column=>!column.asc),predicate:canonicalNotificationExpression(idx.where??null)});
 }
 return {version:'wishlist-runtime-v1',tables:[...WISHLIST_PRIVATE_TABLES],columns,constraints,indexes};
}
