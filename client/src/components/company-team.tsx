import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Info, LockKeyhole, Plus, Search, Users } from "lucide-react";
import type { CompanyRole, Employee, WorkspaceContext } from "@shared/schema";
import { useFormLocale } from "@/components/forms-locale";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Member = { userId: string; email: string; firstName: string | null; lastName: string | null; role: CompanyRole; employeeId: number | null };
type Invitation = { id: string; email: string; role: CompanyRole; employeeId: number | null; expiresAt: string };
type Team = { members: Member[]; invitations: Invitation[] };
type Feedback = { error?: string; message?: string };
type Panel = { kind: "member" | "invitation"; id: string } | { kind: "invite" };
type Filter = "all" | "members" | "invitations";
const selectClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const rowClass = "grid gap-3 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_7rem] lg:items-center lg:gap-4";
const memberName = (member: Member) => [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;
const entryPath = (panel: Panel) => panel.kind === "invite" ? "/api/company/invitations" : `/api/company/${panel.kind === "member" ? "members" : "invitations"}/${panel.id}`;

export function invalidateWorkspace(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ predicate: query => /\/api\/(company|provider|services|bookings|availability|auth\/user)/.test(String(query.queryKey[0])) });
}

function Receipt({ feedback, pending }: { feedback?: Feedback; pending?: boolean }) {
  const { t } = useFormLocale();
  return <div aria-live="polite" className="space-y-1 text-sm">
    {pending && <p role="status">{t("operationsForm.saving")}</p>}
    {feedback?.error && <p role="alert" className="text-destructive">{feedback.error}</p>}
    {feedback?.message && <p role="status">{feedback.message}</p>}
  </div>;
}

function EmployeeOptions({ employees, selected }: { employees: Employee[]; selected: number | null }) {
  const { t } = useFormLocale();
  return <>
    <option value="none">{t("operationsForm.noEmployee")}</option>
    {selected != null && !employees.some(employee => employee.id === selected) && <option value={selected} disabled>{t("operationsForm.employeeUnavailable")}</option>}
    {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
  </>;
}

function AccessEditor({ entry, kind, employees, busy, refreshFailed, feedback, onDirty, onCancel, onSave, onRemove, onReload }: {
  entry: Member | Invitation; kind: "member" | "invitation"; employees: Employee[]; busy: boolean; feedback?: Feedback;
  refreshFailed: boolean; onReload: () => void;
  onDirty: (dirty: boolean) => void; onCancel: () => void;
  onSave: (role: CompanyRole, employeeId: number | null) => void; onRemove: () => void;
}) {
  const { t } = useFormLocale();
  const [role, setRole] = useState(entry.role);
  const [employeeId, setEmployeeId] = useState(entry.employeeId);
  const id = kind === "member" ? (entry as Member).userId : (entry as Invitation).id;
  const reassigned = kind === "member" && employeeId !== entry.employeeId;
  const invalid = (role !== "admin" && employeeId == null) || (employeeId != null && !employees.some(employee => employee.id === employeeId));
  useEffect(() => { setRole(entry.role); setEmployeeId(entry.employeeId); }, [entry.role, entry.employeeId]);
  useEffect(() => { onDirty(role !== entry.role || employeeId !== entry.employeeId); }, [role, employeeId, entry.role, entry.employeeId, onDirty]);
  const prefix = `${kind}-${id}`;
  return <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); if (!busy && !invalid && !refreshFailed && entry.role !== "owner") onSave(role, employeeId); }}>
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      <div className="space-y-2">
        <Label htmlFor={`${kind}-role-${id}`}>{t("operationsForm.accessLevel")}</Label>
        <select id={`${kind}-role-${id}`} disabled={busy} aria-label={t("operationsForm.memberAccess", { email: entry.email })} className={selectClass} value={role} onChange={event => setRole(event.target.value as CompanyRole)}>
          {(["admin", "provider", "viewer"] as const).map(value => <option key={value} value={value}>{t(`operationsForm.role_${value}`)}</option>)}
        </select>
        <p className="text-sm text-muted-foreground">{t("operationsForm.rolesHelp")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${kind}-employee-${id}`}>{t("teamManagement.assignedEmployee")}</Label>
        <select id={`${kind}-employee-${id}`} disabled={busy} aria-label={t("operationsForm.memberEmployee", { email: entry.email })} aria-describedby={`${prefix}-help${reassigned ? ` reassignment-${id}` : ""}`} className={selectClass} value={employeeId ?? "none"} onChange={event => setEmployeeId(event.target.value === "none" ? null : Number(event.target.value))}>
          <EmployeeOptions employees={employees} selected={employeeId} />
        </select>
      </div>
      <div id={`${prefix}-help`} className="flex gap-3 rounded-lg bg-muted p-4 text-sm text-foreground">
        <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <p>{t(kind === "member" ? "teamManagement.memberHelp" : "operationsForm.invitationEditHelp")}</p>
      </div>
      {reassigned && <p id={`reassignment-${id}`} role="status" className="rounded-md border border-amber-500/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">{t("operationsForm.reassignmentWarning", { email: entry.email })}</p>}
      <Receipt feedback={feedback} pending={busy} />
      {refreshFailed && <Button type="button" variant="outline" disabled={busy} onClick={onReload}>{t("teamManagement.retry")}</Button>}
      <div className="space-y-2 border-t pt-5">
        <h4 className="font-medium text-destructive">{t(kind === "member" ? "operationsForm.removeAccess" : "operationsForm.revoke")}</h4>
        {kind === "member" && <p className="text-sm text-muted-foreground">{t("teamManagement.removeHelp")}</p>}
        <Button type="button" variant="outline" className="border-red-300 text-destructive dark:border-red-800" disabled={busy || refreshFailed} aria-label={kind === "invitation" ? t("operationsForm.revokeInvitation", { email: entry.email }) : t("operationsForm.removeMember", { email: entry.email })} onClick={() => {
          if (kind === "invitation" || window.confirm(t("operationsForm.removeMember", { email: entry.email }))) onRemove();
        }}>{t(kind === "member" ? "operationsForm.removeAccess" : "operationsForm.revoke")}</Button>
      </div>
    </div>
    <div className="flex flex-wrap justify-end gap-3 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{t("teamManagement.cancel")}</Button>
      <Button id={kind === "invitation" ? `save-invitation-${id}` : `save-member-${id}`} disabled={busy || invalid || refreshFailed} aria-label={kind === "invitation" ? t("operationsForm.saveInvitationFor", { email: entry.email }) : undefined}>{t(reassigned ? "operationsForm.saveReassignment" : "operationsForm.saveAccess")}</Button>
    </div>
  </form>;
}

export default function CompanyTeam(props: { context: WorkspaceContext; employees: Employee[] }) {
  // A new workspace/permission context must never inherit another editor's drafts or receipts.
  const { context } = props;
  return <TeamWorkspace key={`${context.company?.id}:${context.membership?.userId}:${context.membership?.role}:${context.permissions.manageTeam}`} {...props} />;
}

function TeamWorkspace({ context, employees }: { context: WorkspaceContext; employees: Employee[] }) {
  const { t, i18n } = useFormLocale();
  const queryClient = useQueryClient();
  const locked = useRef(false);
  const mounted = useRef(true);
  const dirty = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const setDirty = useRef((value: boolean) => { dirty.current = value; }).current;
  const [panel, setPanel] = useState<Panel | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CompanyRole>("provider");
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [invitationCreated, setInvitationCreated] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const canViewTeam = Boolean(context.company && (context.permissions.manageTeam || context.permissions.isOwner));
  const teamKey = ["/api/company/team", context.company?.id];
  const team = useQuery<Team>({ queryKey: teamKey, enabled: canViewTeam, retry: false });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const change = useMutation({
    mutationFn: async (action: { method: string; path: string; body?: unknown }) => {
      const response = await apiRequest(action.method, action.path, action.body); return response.json();
    },
    onSuccess: async (data, action) => {
      await invalidateWorkspace(queryClient);
      if (!mounted.current) return;
      const message = t(data.invitationUrl ? data.emailSent ? "operationsForm.invitationSent" : "operationsForm.shareInvitation" : "operationsForm.saved");
      const refreshFailed = queryClient.getQueryState(teamKey)?.status === "error";
      setFeedback(previous => ({ ...previous, [action.path]: refreshFailed ? { error: t("teamManagement.refreshError") } : { message } }));
      if (data.invitationUrl) {
        setInvitationUrl(data.invitationUrl); setEmail(""); setEmployeeId(null); setInvitationCreated(true);
        setFilter("all"); setSearch("");
      } else if (!refreshFailed && (action.path.startsWith("/api/company/members/") || action.path.startsWith("/api/company/invitations/"))) {
        dirty.current = false; setPanel(null);
      }
      if (action.path === "/api/company/transfer") setTransferTo("");
      setNotice(refreshFailed ? "" : message);
    },
    onError: (_, action) => { if (mounted.current) setFeedback(previous => ({ ...previous, [action.path]: { error: t("operationsForm.saveError") } })); },
    onSettled: () => { locked.current = false; },
  });
  const run = (method: string, path: string, body?: unknown) => {
    if (locked.current || !canViewTeam) return;
    locked.current = true; setNotice(""); setFeedback(previous => ({ ...previous, [path]: {} })); change.mutate({ method, path, body });
  };
  const receipt = (path: string) => <Receipt feedback={feedback[path]} pending={change.isPending && change.variables?.path === path} />;
  const reloadTeam = async () => {
    const path = panel && entryPath(panel);
    const result = await team.refetch();
    if (mounted.current && result.isSuccess && path) setFeedback(previous => ({ ...previous, [path]: {} }));
  };
  const closePanel = (discard = false) => {
    if (locked.current) return;
    const hasDraft = panel?.kind === "invite" ? !invitationCreated && Boolean(email || employeeId != null || role !== "provider" || !sendEmail) : dirty.current;
    if (!discard && hasDraft && !window.confirm(t("teamManagement.discardConfirm"))) return;
    dirty.current = false; setPanel(null);
  };
  const openPanel = (next: Panel, target: HTMLElement) => {
    trigger.current = target; dirty.current = false;
    if (next.kind === "invite") { setEmail(""); setRole("provider"); setEmployeeId(null); setSendEmail(true); setInvitationCreated(false); }
    setFeedback(previous => ({ ...previous, [entryPath(next)]: {} })); setPanel(next);
  };
  const availableFor = (selected?: Panel) => employees.filter(employee =>
    !team.data?.members.some(member => !(selected?.kind === "member" && member.userId === selected.id) && member.employeeId === employee.id) &&
    !team.data?.invitations.some(invitation => !(selected?.kind === "invitation" && invitation.id === selected.id) && invitation.employeeId === employee.id));
  const availableEmployees = availableFor();
  const invitationDisabled = !team.isSuccess || (role !== "admin" && employeeId == null) || (employeeId != null && !availableEmployees.some(employee => employee.id === employeeId));
  const selected = panel?.kind === "member" ? team.data?.members.find(member => member.userId === panel.id) : panel?.kind === "invitation" ? team.data?.invitations.find(invitation => invitation.id === panel.id) : undefined;
  const panelAvailable = panel?.kind === "invite" || (selected && selected.role !== "owner");
  const employeeName = (id: number | null) => id == null ? t("operationsForm.noEmployee") : employees.find(employee => employee.id === id)?.name || t("operationsForm.employeeUnavailable");
  const entries = [
    ...(team.data?.members ?? []).map(member => ({ key: `member-${member.userId}`, panel: { kind: "member", id: member.userId } as Panel, name: memberName(member), entry: member, pending: false })),
    ...(team.data?.invitations ?? []).map(invitation => ({ key: `invitation-${invitation.id}`, panel: { kind: "invitation", id: invitation.id } as Panel, name: invitation.email, entry: invitation, pending: true })),
  ];
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visible = entries.filter(row => (filter === "all" || (filter === "invitations") === row.pending) && `${row.name} ${row.entry.email} ${employeeName(row.entry.employeeId)}`.toLocaleLowerCase().includes(normalizedSearch));
  const copyLink = () => {
    void Promise.resolve().then(() => navigator.clipboard.writeText(invitationUrl)).then(() => {
      if (mounted.current) setFeedback(previous => ({ ...previous, copy: { message: t("operationsForm.copied") } }));
    }).catch(() => { if (mounted.current) setFeedback(previous => ({ ...previous, copy: { error: t("operationsForm.copyHelp") } })); });
  };
  const linkReceipt = (id: string) => <div className="space-y-3 rounded-lg border bg-muted p-4">
    <Label htmlFor={id}>{t("operationsForm.invitationLink")}</Label>
    <Input id={id} readOnly value={invitationUrl} onFocus={event => event.target.select()} />
    <Button type="button" variant="outline" onClick={copyLink}>{t("operationsForm.copyLink")}</Button>{receipt("copy")}
  </div>;

  return <section className="phase3-form team-management space-y-6" aria-labelledby="team-access-heading">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h2 ref={heading} tabIndex={-1} id="team-access-heading" className="text-2xl font-semibold tracking-tight">{t("teamManagement.title")}</h2>
        {context.company && <p className="text-sm text-muted-foreground"><bdi>{context.company.name}</bdi> · {t(`operationsForm.role_${context.membership?.role ?? "viewer"}`)}{!context.company.isActive ? t("operationsForm.closed") : ""}</p>}
      </div>
      {canViewTeam && context.permissions.manageTeam && <Button id="team-invite" type="button" disabled={change.isPending || !team.isSuccess} onClick={event => openPanel({ kind: "invite" }, event.currentTarget)}><Plus className="me-2 h-4 w-4 shrink-0" aria-hidden="true" />{t("teamManagement.invite")}</Button>}
    </div>
    {!canViewTeam ? <p role="alert">{t("teamManagement.denied")}</p> : <>
      {notice && <p role="status" className="flex gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"><Check aria-hidden="true" className="h-5 w-5 shrink-0" />{notice}</p>}
      {team.isLoading ? <p role="status">{t("operationsForm.loadingTeam")}</p> : team.isError ? <div role="alert" className="space-y-3 rounded-lg border p-4"><p>{t("operationsForm.loadTeamError")}</p><Button type="button" variant="outline" disabled={team.isFetching} onClick={() => void reloadTeam()}>{t("teamManagement.retry")}</Button></div> : <>
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-0 flex-[1_1_16rem]">
            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-3 h-5 w-5 text-muted-foreground" />
            <Label htmlFor="team-search" className="sr-only">{t("teamManagement.search")}</Label>
            <Input id="team-search" type="search" className="ps-10" placeholder={t("teamManagement.search")} value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("teamManagement.status")}>
            {(["all", "members", "invitations"] as const).map(value => <Button key={value} id={`team-filter-${value}`} variant="outline" className={filter === value ? "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-100" : undefined} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(`teamManagement.${value}`)}<span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-foreground">{new Intl.NumberFormat(i18n.language).format(value === "all" ? entries.length : value === "members" ? team.data?.members.length ?? 0 : team.data?.invitations.length ?? 0)}</span></Button>)}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card text-card-foreground">
          <div aria-hidden="true" className={`${rowClass} hidden border-b bg-muted text-xs font-medium text-neutral-600 dark:text-neutral-300 lg:grid`}>
            {["person", "access", "assignedEmployee", "status", "actions"].map(key => <span key={key}>{t(`teamManagement.${key}`)}</span>)}
          </div>
          <ul id="team-roster" className="divide-y" aria-label={t("operationsForm.teamEntries")}>
            {visible.map(row => <li key={row.key} id={`team-row-${row.key}`} className={`${rowClass} ${panel && "id" in panel && "id" in row.panel && panel.kind === row.panel.kind && panel.id === row.panel.id ? "bg-indigo-50 dark:bg-indigo-950" : ""}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{row.name.split(/\s+/).slice(0, 2).map(value => Array.from(value)[0]).join("").toLocaleUpperCase()}</span>
                <div className="min-w-0"><p className="break-words font-medium"><bdi>{row.name}</bdi></p>{row.name !== row.entry.email && <p className="break-all text-sm text-muted-foreground"><bdi>{row.entry.email}</bdi></p>}</div>
              </div>
              <div className="text-sm"><span className="mb-1 block text-xs text-muted-foreground lg:sr-only">{t("operationsForm.accessLevel")}</span><span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{t(`operationsForm.role_${row.entry.role}`)}</span></div>
              <div className="min-w-0 break-words text-sm"><span className="mb-1 block text-xs text-muted-foreground lg:sr-only">{t("teamManagement.assignedEmployee")}</span><bdi>{employeeName(row.entry.employeeId)}</bdi></div>
              <div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${row.pending ? "border border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100" : "bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100"}`}>{t(row.pending ? "operationsForm.pendingAcceptance" : "operationsForm.memberStatus")}</span></div>
              <div>{row.entry.role === "owner" ? <span className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground" title={t("teamManagement.ownerProtected")}><LockKeyhole aria-hidden="true" className="h-4 w-4" /><span className="lg:sr-only">{t("teamManagement.ownerProtected")}</span></span> : context.permissions.manageTeam && <Button type="button" id={`edit-${row.key}`} variant="outline" disabled={change.isPending} aria-label={t("teamManagement.editFor", { email: row.entry.email })} onClick={event => openPanel(row.panel, event.currentTarget)}>{t("teamManagement.edit")}</Button>}</div>
            </li>)}
          </ul>
          {!visible.length && <div className="space-y-3 p-8 text-center text-sm text-muted-foreground"><Users className="mx-auto h-8 w-8" aria-hidden="true" /><p role="status">{t(entries.length ? "teamManagement.noResults" : "teamManagement.empty")}</p>{entries.length > 0 && <Button variant="outline" onClick={() => { setSearch(""); setFilter("all"); }}>{t("teamManagement.clearSearch")}</Button>}</div>}
        </div>
      </>}
      {invitationUrl && panel?.kind !== "invite" && linkReceipt("invitation-link")}
      {context.permissions.isOwner && <details className="group rounded-xl border bg-card p-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform group-open:rotate-90 rtl:rotate-180" /><span><span className="block font-semibold">{t("operationsForm.ownerControls")}</span><span className="text-sm text-muted-foreground">{t("teamManagement.ownerHelp")}</span></span></summary>
        <div className="mt-4 space-y-4 border-t pt-4">
          <div className="max-w-lg space-y-2"><Label htmlFor="team-new-owner">{t("operationsForm.newOwner")}</Label><select id="team-new-owner" disabled={change.isPending || !team.isSuccess} className={selectClass} value={transferTo} onChange={event => setTransferTo(event.target.value)}><option value="">{t("operationsForm.chooseOwner")}</option>{team.data?.members.filter(member => member.role !== "owner").map(member => <option key={member.userId} value={member.userId}>{member.email}</option>)}</select></div>
          <Button variant="outline" disabled={!transferTo || change.isPending || !team.isSuccess || !team.data?.members.some(member => member.userId === transferTo && member.role !== "owner")} onClick={() => { if (window.confirm(t("operationsForm.transferConfirm", { email: team.data?.members.find(member => member.userId === transferTo)?.email }))) run("POST", "/api/company/transfer", { userId: transferTo }); }}>{t("operationsForm.transfer")}</Button>{receipt("/api/company/transfer")}
          <div><Button variant="outline" disabled={change.isPending} onClick={() => { if (window.confirm(t(context.company!.isActive ? "operationsForm.closeConfirm" : "operationsForm.reopenConfirm", { name: context.company!.name }))) run("PATCH", "/api/company/active", { isActive: !context.company!.isActive }); }}>{t(context.company!.isActive ? "operationsForm.closeCompany" : "operationsForm.reopenCompany")}</Button></div>{receipt("/api/company/active")}
        </div>
      </details>}
      <Sheet open={Boolean(panel && panelAvailable && context.permissions.manageTeam)} onOpenChange={open => { if (!open) closePanel(); }}>
        <SheetContent side={i18n.dir() === "rtl" ? "left" : "right"} dir={i18n.dir()} closeLabel={t("teamManagement.close")} overlayClassName="bg-black/20" className="phase3-form team-management flex h-[100dvh] w-full flex-col gap-0 p-0 sm:max-w-[480px]" onCloseAutoFocus={event => { event.preventDefault(); const target = trigger.current; if (target?.isConnected && !target.matches(":disabled")) target.focus(); else heading.current?.focus(); }} onOpenAutoFocus={event => { event.preventDefault(); const id = panel?.kind === "invite" ? "team-email" : panel ? `${panel.kind}-role-${panel.id}` : ""; document.getElementById(id)?.focus(); }}>
          <SheetHeader className="shrink-0 border-b p-6 pe-12 text-start sm:text-start">
            <SheetTitle>{t(panel?.kind === "invite" ? "teamManagement.invite" : panel?.kind === "member" ? "teamManagement.editMember" : "teamManagement.editInvitation")}</SheetTitle>
            <SheetDescription>{panel?.kind === "invite" ? t("operationsForm.inviteLoginHelp") : selected?.email}</SheetDescription>
            {selected && <div className="space-y-2 pt-3"><p className="break-words font-semibold"><bdi>{panel?.kind === "member" ? memberName(selected as Member) : selected.email}</bdi></p><span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs">{t(panel?.kind === "member" ? "operationsForm.memberStatus" : "operationsForm.pendingAcceptance")}</span></div>}
          </SheetHeader>
          {panel && panel.kind !== "invite" && selected && <AccessEditor key={`${panel.kind}-${panel.id}`} kind={panel.kind} entry={selected} employees={availableFor(panel)} busy={change.isPending || !context.permissions.manageTeam} refreshFailed={team.isError} onReload={() => void reloadTeam()} feedback={feedback[entryPath(panel)]} onDirty={setDirty} onCancel={() => closePanel(true)} onSave={(role, employeeId) => run("PATCH", entryPath(panel), { role, employeeId })} onRemove={() => run("DELETE", entryPath(panel))} />}
          {panel?.kind === "invite" && (invitationCreated ? <div className="flex min-h-0 flex-1 flex-col"><div className="flex-1 space-y-5 overflow-y-auto p-6"><Check aria-hidden="true" className="h-10 w-10 rounded-full bg-emerald-100 p-2 text-emerald-900" />{receipt("/api/company/invitations")}{linkReceipt("invitation-link")}</div><div className="flex flex-wrap justify-end gap-3 border-t p-4"><Button variant="outline" disabled={change.isPending} onClick={() => { setInvitationCreated(false); setRole("provider"); setSendEmail(true); setFeedback(previous => ({ ...previous, copy: {}, "/api/company/invitations": {} })); requestAnimationFrame(() => document.getElementById("team-email")?.focus()); }}>{t("teamManagement.inviteAnother")}</Button><Button disabled={change.isPending} onClick={() => closePanel(true)}>{t("teamManagement.done")}</Button></div></div> : <form className="flex min-h-0 flex-1 flex-col" aria-label={t("teamManagement.invite")} onSubmit={event => { event.preventDefault(); if (!change.isPending && !invitationDisabled) run("POST", "/api/company/invitations", { email, role, employeeId, sendEmail }); }}>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="space-y-2"><Label htmlFor="team-email">{t("operationsForm.email")}</Label><Input disabled={change.isPending} id="team-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="team-role">{t("operationsForm.accessLevel")}</Label><select disabled={change.isPending} id="team-role" className={selectClass} value={role} onChange={event => setRole(event.target.value as CompanyRole)}>{(["admin", "provider", "viewer"] as const).map(role => <option key={role} value={role}>{t(`operationsForm.role_${role}`)}</option>)}</select><p className="text-sm text-muted-foreground">{t("operationsForm.rolesHelp")}</p></div>
              <div className="space-y-2"><Label htmlFor="team-employee">{t("teamManagement.assignedEmployee")}</Label><select disabled={change.isPending} aria-describedby="team-assignment-help" id="team-employee" className={selectClass} value={employeeId ?? "none"} onChange={event => setEmployeeId(event.target.value === "none" ? null : Number(event.target.value))}><EmployeeOptions employees={availableEmployees} selected={employeeId} /></select><p id="team-assignment-help" className="text-sm text-muted-foreground">{t("operationsForm.assignmentHelp")}</p></div>
              <label className="flex min-h-11 items-center gap-3 text-sm"><input disabled={change.isPending} type="checkbox" checked={sendEmail} onChange={event => setSendEmail(event.target.checked)} />{t("operationsForm.sendInvitation")}</label>{receipt("/api/company/invitations")}
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><Button type="button" variant="outline" disabled={change.isPending} onClick={() => closePanel(true)}>{t("teamManagement.cancel")}</Button><Button disabled={change.isPending || invitationDisabled}>{t("operationsForm.createInvitation")}</Button></div>
          </form>)}
        </SheetContent>
      </Sheet>
    </>}
  </section>;
}
