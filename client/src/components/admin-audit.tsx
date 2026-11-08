import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { auditFilterNames, auditQuery, defaultAuditFilters, type AuditFilters, type AuditPage, type AuditRecord } from "@/lib/audit-viewer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const inputClass = "w-full min-w-0 min-h-11 rounded-md border border-neutral-500 bg-white px-3 py-2 text-sm";
const outcomes = ["succeeded", "rejected", "denied", "failed", "unknown"];

export default function AdminAudit({ actorId, canExport, available, onAccessError }: { actorId: string; canExport: boolean; available: boolean; onAccessError: (error: Error) => void }) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState(defaultAuditFilters);
  const [applied, setApplied] = useState(draft);
  const [cursors, setCursors] = useState<string[]>([]);
  const [validation, setValidation] = useState(false);
  const [selected, setSelected] = useState<AuditRecord | null>(null);
  const [exportState, setExportState] = useState<"idle" | "pending" | "done" | "failed">("idle");
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => () => exportController.current?.abort(), []);
  const cursor = cursors.at(-1);
  const records = useQuery<AuditPage>({
    queryKey: ["/api/admin/audit/events", actorId, applied, cursor], enabled: Boolean(actorId) && available,
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/admin/audit/events?${auditQuery(applied, cursor)}`, undefined, signal)).json(),
    staleTime: 0, gcTime: 0, retry: false,
  });
  useEffect(() => {
    if (records.error instanceof Error && /^(401|403):/.test(records.error.message)) onAccessError(records.error);
  }, [records.error, onAccessError]);
  const date = (value: string) => Number.isNaN(Date.parse(value)) ? t("audit.unavailableValue") : new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC", hour12: false }).format(new Date(value));
  const action = (name: string) => t(`audit.actions.${name.replace(/\.v\d+$/, "").replaceAll(".", "_")}`, { defaultValue: name.replace(/\.v\d+$/, "").replaceAll(/[._]/g, " ") });
  const targetLabel = (event: AuditRecord) => {
    const [table, row] = event.target.type === "database_record" ? (event.target.id || "").split(":") : [event.target.type, event.target.id];
    const label = t(`audit.recordTypes.${table}`, { defaultValue: table.replaceAll("_", " ") });
    return row ? `${label} #${row}` : label;
  };
  const actorLabel = (event: AuditRecord) => event.actor.serviceId === "database-runtime" ? t("audit.databaseActor") : event.actor.userId || t(`audit.actorKinds.${event.actor.kind}`, { defaultValue: event.actor.kind });
  const recordTitle = (event: AuditRecord) => {
    const operation = event.changes.find(change => change.field === "operation")?.after;
    if (event.eventName.startsWith("data.record_")) return t(`audit.databaseTitles.${event.eventName.split("_").at(-1)?.split(".")[0]}`, { record: targetLabel(event) });
    if (event.eventName === "activity.records_read.v1") return t("audit.readTitle", { record: t(`audit.reads.${String(event.changes.find(change => change.field === "action")?.after).replaceAll(".", "_")}`) });
    if (event.eventName.includes(".operation_") && typeof operation === "string") return t(event.eventName.includes("_requested.") ? "audit.operationRequested" : "audit.operationReported", { operation: t(`audit.operations.${operation}`, { defaultValue: operation.replaceAll("_", " ") }) });
    return action(event.eventName);
  };
  const knownActions = Object.keys(t("audit.actions", { returnObjects: true }) as object).map(key => key.replace("_", ".") + ".v1");
  const renderFilter = (name: typeof auditFilterNames[number]) => <div key={name} className="min-w-0 space-y-1"><Label htmlFor={`audit-${name}`}>{t(`audit.filters.${name}`)}</Label>{name === "outcome" || name === "action" ? <select id={`audit-${name}`} className={inputClass} value={draft[name]} onChange={event => setDraft(previous => ({ ...previous, [name]: event.target.value }))}><option value="">{t(name === "action" ? "audit.allActivities" : "audit.allOutcomes")}</option>{name === "action" ? knownActions.map(event => <option key={event} value={event}>{action(event)}</option>) : outcomes.map(outcome => <option key={outcome} value={outcome}>{t(`audit.outcomes.${outcome}`)}</option>)}</select> : <input id={`audit-${name}`} className={inputClass} type={name === "from" || name === "to" ? "datetime-local" : "text"} step={name === "from" || name === "to" ? 60 : undefined} maxLength={name === "targetId" ? 250 : 128} list={name === "source" ? "audit-sources" : name === "targetType" ? "audit-target-types" : undefined} value={draft[name]} aria-invalid={validation && (name === "from" || name === "to") || undefined} aria-describedby={validation && (name === "from" || name === "to") ? "audit-validation" : undefined} onChange={event => setDraft(previous => ({ ...previous, [name]: event.target.value }))} />}</div>;
  function apply(next: AuditFilters) { setApplied({ ...next }); setDraft({ ...next }); setCursors([]); setSelected(null); setValidation(false); setExportState("idle"); }
  function submit(event: FormEvent) {
    event.preventDefault();
    const start = Date.parse(draft.from + "Z"), end = Date.parse(draft.to + "Z");
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end - start > 366 * 86400_000) { setValidation(true); return; }
    apply(draft);
  }
  async function download() {
    setExportState("pending");
    const controller = new AbortController(); exportController.current = controller;
    try {
      const response = await apiRequest("GET", `/api/admin/audit/export?${auditQuery(applied)}`, undefined, controller.signal);
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setExportState("done");
    } catch (error) {
      if (controller.signal.aborted) return;
      setExportState("failed"); if (error instanceof Error && /^(401|403):/.test(error.message)) onAccessError(error);
    }
  }
  const value = (input: unknown) => input === undefined ? "—" : input === null ? t("audit.noValue") : String(input);
  return <section aria-labelledby="audit-heading" className="min-w-0 space-y-5 rounded-xl border bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="audit-heading" className="text-xl font-semibold">{t("audit.title")}</h2><p className="mt-1 max-w-3xl text-sm text-neutral-600">{t("audit.description")}</p></div><Button variant="outline" disabled={!available || records.isFetching} onClick={() => { setSelected(null); void records.refetch(); }}>{t("audit.refresh")}</Button></div>
    <p className="text-sm text-neutral-600">{t("audit.privacy")}</p>
    <form onSubmit={submit} className="space-y-4" aria-label={t("audit.queryTitle")}>
      <fieldset className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"><legend className="mb-3 font-medium">{t("audit.queryTitle")}</legend>
        {(["from", "to", "action", "outcome"] as const).map(renderFilter)}
      </fieldset>
      <details className="rounded-lg border p-3"><summary className="cursor-pointer py-1 font-medium">{t("audit.moreFilters")}</summary><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{auditFilterNames.filter(name => !["from", "to", "action", "outcome"].includes(name)).map(renderFilter)}</div></details>
      <datalist id="audit-sources">{["auth", "account", "company-access", "service", "database", "audit", "billing", "location", "application", "integration"].map(name => <option key={name} value={name}>{t(`audit.sources.${name}`, { defaultValue: name })}</option>)}</datalist><datalist id="audit-target-types">{["database_record", "user", "company", "membership", "service", "request"].map(name => <option key={name} value={name}>{t(`audit.recordTypes.${name}`, { defaultValue: name })}</option>)}</datalist>
      <p className="text-sm text-neutral-600">{t("audit.queryHelp")}</p>
      {validation && <p id="audit-validation" role="alert" className="text-red-800">{t("audit.invalidRange")}</p>}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={records.isFetching}>{t("audit.search")}</Button><Button type="button" variant="outline" onClick={() => apply(defaultAuditFilters())}>{t("audit.reset")}</Button></div>
    </form>
    <details className="rounded-lg border p-3" open><summary className="cursor-pointer font-medium">{t("audit.appliedQuery")}</summary><p className="mt-2 text-sm text-neutral-600">{t("audit.appliedHelp")}</p><dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{auditFilterNames.filter(name => applied[name]).map(name => <div key={name} className="min-w-0"><dt className="font-medium">{t(`audit.filters.${name}`)}</dt><dd className="break-all"><bdi>{name === "from" || name === "to" ? date(applied[name] + "Z") : name === "outcome" ? t(`audit.outcomes.${applied[name]}`) : applied[name]}</bdi></dd></div>)}</dl></details>
    {!available ? <p role="alert">{t("audit.unavailable")}</p> : records.isFetching || records.isPending ? <p role="status">{t("audit.loading")}</p> : records.isError ? <div role="alert" className="space-y-3"><p>{t("audit.error")}</p><Button onClick={() => void records.refetch()}>{t("audit.retry")}</Button></div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-neutral-600">{t("audit.results", { count: records.data.events.length, page: cursors.length + 1 })}</p>{canExport && <Button variant="outline" disabled={exportState === "pending" || !records.data.events.length} onClick={() => void download()}>{t(exportState === "pending" ? "audit.exporting" : "audit.export")}</Button>}</div>
      {canExport && <p className="text-sm text-neutral-600">{t("audit.exportHelp")}</p>}
      {exportState === "done" && <p role="status">{t("audit.exportDone")}</p>}{exportState === "failed" && <p role="alert">{t("audit.exportFailed")}</p>}
      {!records.data.events.length ? <p className="py-6 text-neutral-600">{t("audit.empty")}</p> : <ul className="space-y-3">{records.data.events.map(event => <li key={event.eventId} data-audit-record className="min-w-0 rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><h3 className="font-medium break-words">{recordTitle(event)}</h3>{event.eventName.includes(".operation_requested.") && <p className="mt-1 text-sm text-neutral-600">{t("audit.intentHelp")}</p>}<p className="mt-1 text-sm text-neutral-600"><time dateTime={event.occurredAt}>{date(event.occurredAt)} UTC</time></p></div><span className="rounded-full border px-3 py-1 text-sm self-start">{t(`audit.outcomes.${event.outcome}`, { defaultValue: event.outcome })}</span></div><dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"><div className="min-w-0"><dt className="font-medium">{t("audit.actor")}</dt><dd className="break-all"><bdi>{actorLabel(event)}</bdi></dd></div><div className="min-w-0"><dt className="font-medium">{t("audit.target")}</dt><dd className="break-all"><bdi>{targetLabel(event)}</bdi></dd></div><div className="min-w-0"><dt className="font-medium">{t("audit.workspace")}</dt><dd className="break-all"><bdi>{event.scope.workspaceId || t(`audit.scopeKinds.${event.scope.kind}`, { defaultValue: event.scope.kind })}</bdi></dd></div></dl><Button className="mt-3" variant="outline" aria-expanded={selected?.eventId === event.eventId} aria-controls={`audit-detail-${event.eventId}`} onClick={() => setSelected(selected?.eventId === event.eventId ? null : event)}>{t(selected?.eventId === event.eventId ? "audit.hideDetails" : "audit.details")}</Button>
        {selected?.eventId === event.eventId && <div id={`audit-detail-${event.eventId}`} className="mt-4 space-y-4 border-t pt-4"><h4 className="font-medium">{t("audit.recordDetails")}</h4>{event.actor.serviceId === "database-runtime" && <p className="text-sm text-neutral-600">{t("audit.databaseActorHelp")}</p>}<dl className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">{[["eventId",event.eventId],["eventName",event.eventName],["requestId",event.requestId],["operationId",event.operationId],["source",`${event.source.application} / ${event.source.environment} / ${event.source.component}`],["receivedAt",`${date(event.receivedAt)} UTC`],["expiresAt",`${date(event.expiresAt)} UTC`],["reason",event.reasonCode ? `${t(`audit.reasons.${event.reasonCode}`, { defaultValue: event.reasonCode })} (${event.reasonCode})` : "—"]].map(([name, content]) => <div key={name} className="min-w-0"><dt className="font-medium">{t(`audit.detailsFields.${name}`)}</dt><dd className="break-all"><bdi>{content}</bdi></dd></div>)}</dl><div><h5 className="font-medium">{t("audit.changes")}</h5>{event.changes.length ? <ul className="mt-2 space-y-2">{event.changes.map(change => <li key={change.field} className="min-w-0 rounded border p-3 text-sm"><p className="font-medium break-all"><bdi>{t(`audit.fields.${change.field}`, { defaultValue: change.field.replaceAll("_", " ") })}</bdi></p>{change.redacted ? <p>{t("audit.redacted")}</p> : <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"><div><dt>{t("audit.before")}</dt><dd className="break-all"><bdi>{value(change.before)}</bdi></dd></div><div><dt>{t("audit.after")}</dt><dd className="break-all"><bdi>{value(change.after)}</bdi></dd></div></dl>}</li>)}</ul> : <p className="mt-2 text-sm text-neutral-600">{t("audit.noChanges")}</p>}</div><div className="flex flex-wrap gap-2">{event.target.id && <Button variant="outline" onClick={() => apply({ ...applied, action: "", outcome: "", targetType: event.target.type, targetId: event.target.id!, requestId: "", operationId: "" })}>{t("audit.objectHistory")}</Button>}{event.requestId && <Button variant="outline" onClick={() => apply({ ...applied, action: "", outcome: "", targetType: "", targetId: "", requestId: event.requestId, operationId: "" })}>{t("audit.requestHistory")}</Button>}</div></div>}
      </li>)}</ul>}
      <nav aria-label={t("audit.pages")} className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" disabled={!cursors.length} onClick={() => { setCursors(previous => previous.slice(0, -1)); setSelected(null); }}>{t("audit.previous")}</Button><span className="text-sm">{t("audit.page", { page: cursors.length + 1 })}</span><Button variant="outline" disabled={!records.data.hasMore || !records.data.nextCursor} onClick={() => { setCursors(previous => [...previous, records.data.nextCursor!]); setSelected(null); }}>{t("audit.next")}</Button></nav>
    </>}
  </section>;
}
