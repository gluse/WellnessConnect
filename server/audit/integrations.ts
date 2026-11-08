import {randomUUID} from "node:crypto";
import {createAuditContext} from "./context";
import {createAuditEvent} from "./events";
import {capturePreparedAudit, completionAuditEnabled} from "./http";

/** Operational provider evidence only. Inputs, outputs and inferred human identities are excluded. */
export async function auditIntegration<T>(operation: "embedding" | "geocoding" | "notification_batch" | "activity_batch", effect: () => Promise<T>,
  succeeded: (value: T) => boolean = () => true): Promise<T> {
  if (!completionAuditEnabled()) return effect();
  const context = createAuditContext({ actor: {kind:"service",serviceId:"integration-runtime"}, scope:{kind:"unknown"},
    target:{type:"request"},requestId:randomUUID(),operationId:randomUUID(),
    source:{application:"fitsmytime",environment:process.env.AUDIT_ENVIRONMENT ?? "development",component:"integration"}});
  const changes=[{field:"operation",before:null,after:operation}] as const;
  const intent=createAuditEvent(context,{eventName:"integration.operation_requested.v1",outcome:"succeeded",changes});
  await capturePreparedAudit(intent);
  const reportContext=createAuditContext({...context,parentEventId:intent.envelope.eventId});
  let result:T;
  try {result=await effect();}
  catch(error){
    try {await capturePreparedAudit(createAuditEvent(reportContext,{eventName:"integration.operation_reported.v1",outcome:"unknown",reasonCode:"PROVIDER_TIMEOUT",changes}));}
    catch {/* durable intent retained; capture layer reports safe gap */}
    throw error;
  }
  const accepted=succeeded(result);
  await capturePreparedAudit(createAuditEvent(reportContext,{eventName:"integration.operation_reported.v1",
    outcome:accepted?"succeeded":"failed",...(!accepted?{reasonCode:"PROVIDER_UNAVAILABLE" as const}:{}),changes}));
  return result;
}
