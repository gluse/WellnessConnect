import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyRole, Employee, WorkspaceContext } from "@shared/schema";
import { useFormLocale } from "@/components/forms-locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Member = { userId: string; email: string; firstName: string | null; lastName: string | null; role: CompanyRole; employeeId: number | null };
type Team = { members: Member[]; invitations: { id: string; email: string; role: CompanyRole; employeeId: number | null; expiresAt: string }[] };
const selectClass = "w-full border rounded-md p-2 bg-background";
export function invalidateWorkspace(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ predicate: query => /\/api\/(company|provider|services|bookings|availability|auth\/user)/.test(String(query.queryKey[0])) });
}
function MemberEditor({ member, employees, busy, pending, feedback, onSave, onRemove }: { member: Member; employees: Employee[]; busy: boolean; pending?: boolean; feedback?: { error?: string; message?: string }; onSave: (userId: string, role: string, employeeId: number | null) => void; onRemove: (userId: string) => void }) {
  const { t } = useFormLocale();
  const [role, setRole] = useState(member.role);
  const [employeeId, setEmployeeId] = useState(member.employeeId);
  useEffect(() => { setRole(member.role); setEmployeeId(member.employeeId); }, [member.role, member.employeeId]);
  return <li className="border rounded-md p-3 space-y-2">
    <p className="font-medium">{[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}</p>
    <p className="text-sm text-muted-foreground break-all"><bdi>{member.email}</bdi></p>
    {member.role === "owner" ? <p>{t("operationsForm.role_owner")}</p> : <>
      <div className="grid sm:grid-cols-2 gap-2"><select disabled={busy} aria-label={t("operationsForm.memberAccess", { email: member.email })} className={selectClass} value={role} onChange={event => setRole(event.target.value as CompanyRole)}>
        {(["admin", "provider", "viewer"] as const).map(role => <option key={role} value={role}>{t(`operationsForm.role_${role}`)}</option>)}
      </select><select disabled={busy} aria-label={t("operationsForm.memberEmployee", { email: member.email })} aria-describedby={`assignment-${member.userId}`} className={selectClass} value={employeeId ?? "none"} onChange={event => setEmployeeId(event.target.value === "none" ? null : Number(event.target.value))}>
        <option value="none">{t("operationsForm.noEmployee")}</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
      </select></div>
      <p id={`assignment-${member.userId}`} className="text-sm text-muted-foreground">{t("operationsForm.assignmentHelp")}</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || (role !== "admin" && employeeId == null)} onClick={() => onSave(member.userId, role, employeeId)}>{t("operationsForm.saveAccess")}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm(t("operationsForm.removeMember", { email: member.email }))) onRemove(member.userId); }}>{t("operationsForm.removeAccess")}</Button></div>
    </>}
    {pending && <p role="status">{t("operationsForm.saving")}</p>}
    {feedback?.error && <p role="alert" className="text-destructive">{feedback.error}</p>}{feedback?.message && <p role="status">{feedback.message}</p>}
  </li>;
}

export default function CompanyTeam({ context, employees }: { context: WorkspaceContext; employees: Employee[] }) {
  const { t } = useFormLocale();
  const locked = useRef(false);
  const [feedback, setFeedback] = useState<Record<string, { error?: string; message?: string }>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("provider");
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [transferTo, setTransferTo] = useState("");
  useEffect(() => { setEmployeeId(null); setInvitationUrl(""); setTransferTo(""); setEmail(""); setFeedback({}); }, [context.company?.id]);
  const canViewTeam = context.permissions.manageTeam || context.permissions.isOwner;
  const team = useQuery<Team>({ queryKey: ["/api/company/team"], enabled: Boolean(context.company && canViewTeam), retry: false });
  const change = useMutation({
    mutationFn: async (action: { method: string; path: string; body?: unknown }) => {
      const response = await apiRequest(action.method, action.path, action.body); return response.json();
    },
    onSuccess: async (data, action) => {
      if (data.invitationUrl) { setInvitationUrl(data.invitationUrl); setEmail(""); toast({ title: t(data.emailSent ? "operationsForm.invitationSent" : "operationsForm.shareInvitation") }); }
      setFeedback(previous => ({ ...previous, [action.path]: { message: data.invitationUrl ? t(data.emailSent ? "operationsForm.invitationSent" : "operationsForm.shareInvitation") : t("operationsForm.saved") } }));
      await invalidateWorkspace(queryClient);
    },
    onError: (_, action) => setFeedback(previous => ({ ...previous, [action.path]: { error: t("operationsForm.saveError") } })),
    onSettled: () => { locked.current = false; },
  });
  const run = (method: string, path: string, body?: unknown) => { if (locked.current) return; locked.current = true; setFeedback(previous => ({ ...previous, [path]: {} })); change.mutate({ method, path, body }); };
  const receipt = (path: string) => <>{change.isPending && change.variables?.path === path && <p role="status">{t("operationsForm.saving")}</p>}{feedback[path]?.error && <p role="alert" className="text-destructive">{feedback[path].error}</p>}{feedback[path]?.message && <p role="status">{feedback[path].message}</p>}</>;
  return <Card className="phase3-form">
    <CardHeader><h2 className="text-xl font-semibold">{t("operationsForm.team")}</h2></CardHeader>
    <CardContent className="space-y-4">
      {context.company && <p className="text-sm text-muted-foreground">{context.company.name} · {t(`operationsForm.role_${context.membership!.role}`)}{!context.company.isActive ? t("operationsForm.closed") : ""}</p>}
      {context.membership?.role === "viewer" && <p className="text-sm">{t("operationsForm.viewerHelp")}</p>}
      {context.membership?.role === "provider" && <p className="text-sm">{t("operationsForm.providerHelp")}</p>}
      {context.company && canViewTeam && <div className="space-y-4 border-t pt-4">
        {team.isLoading ? <p role="status">{t("operationsForm.loadingTeam")}</p> : team.isError ? <p role="alert">{t("operationsForm.loadTeamError")}</p> : <section aria-labelledby="team-access-heading"><h3 id="team-access-heading" className="font-semibold mb-3">{t("operationsForm.access")}</h3><ul className="space-y-4">
          {team.data?.members.map(member => <MemberEditor key={member.userId} member={member} employees={employees} busy={change.isPending || !context.permissions.manageTeam} pending={change.isPending && change.variables?.path === `/api/company/members/${member.userId}`} feedback={feedback[`/api/company/members/${member.userId}`]}
            onSave={(userId, role, employeeId) => run("PATCH", `/api/company/members/${userId}`, { role, employeeId })} onRemove={userId => run("DELETE", `/api/company/members/${userId}`)} />)}
        </ul></section>}
        {change.variables?.method === "DELETE" && feedback[change.variables.path]?.message && <p role="status">{feedback[change.variables.path].message}</p>}
        {context.permissions.manageTeam && <form className="space-y-4 rounded-md bg-muted p-4" onSubmit={event => { event.preventDefault(); if (change.isPending || (role !== "admin" && employeeId == null)) return; run("POST", "/api/company/invitations", { email, role, employeeId, sendEmail }); }}>
          <h3 className="font-semibold">{t("operationsForm.invite")}</h3>
          <div><Label htmlFor="team-email">{t("operationsForm.email")}</Label><Input disabled={change.isPending} id="team-email" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></div>
          <div><Label htmlFor="team-role">{t("operationsForm.accessLevel")}</Label><select disabled={change.isPending} id="team-role" className={selectClass} value={role} onChange={event => setRole(event.target.value)}>{(["admin", "provider", "viewer"] as const).map(role => <option key={role} value={role}>{t(`operationsForm.role_${role}`)}</option>)}</select></div>
          <div><Label htmlFor="team-employee">{t("operationsForm.employee")}</Label><select disabled={change.isPending} aria-describedby="team-assignment-help" id="team-employee" className={selectClass} value={employeeId ?? "none"} onChange={event => setEmployeeId(event.target.value === "none" ? null : Number(event.target.value))}>
            <option value="none">{t("operationsForm.noEmployee")}</option>{employees.filter(employee => !team.data?.members.some(member => member.employeeId === employee.id)).map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select><p id="team-assignment-help" className="text-sm text-muted-foreground mt-1">{t("operationsForm.assignmentHelp")}</p></div>
          <p className="text-sm text-muted-foreground">{t("operationsForm.rolesHelp")}</p>
          <label className="flex items-center gap-2 min-h-11 text-sm"><input disabled={change.isPending} type="checkbox" checked={sendEmail} onChange={event => setSendEmail(event.target.checked)} />{t("operationsForm.sendInvitation")}</label>
          <Button disabled={change.isPending || (role !== "admin" && employeeId == null)}>{t("operationsForm.createInvitation")}</Button>
          {receipt("/api/company/invitations")}
        </form>}
        {invitationUrl && <div className="space-y-2"><Label htmlFor="invitation-link">{t("operationsForm.invitationLink")}</Label><Input id="invitation-link" readOnly value={invitationUrl} onFocus={event => event.target.select()} />
          <Button variant="outline" onClick={() => void navigator.clipboard.writeText(invitationUrl).then(() => setFeedback(previous => ({ ...previous, copy: { message: t("operationsForm.copied") } }))).catch(() => setFeedback(previous => ({ ...previous, copy: { error: t("operationsForm.copyHelp") } })))}>{t("operationsForm.copyLink")}</Button>{receipt("copy")}</div>}
        {team.data?.invitations.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3"><p className="text-sm break-all">{t("operationsForm.pendingInvitation", { email: invitation.email })} · {t(`operationsForm.role_${invitation.role}`)}</p>
          <Button size="sm" variant="outline" disabled={change.isPending || !context.permissions.manageTeam} onClick={() => run("DELETE", `/api/company/invitations/${invitation.id}`)}>{t("operationsForm.revoke")}</Button>{receipt(`/api/company/invitations/${invitation.id}`)}</div>)}
        {context.permissions.isOwner && <div className="space-y-3 border-t pt-3">
          <h3 className="font-semibold">{t("operationsForm.ownerControls")}</h3>
          <select disabled={change.isPending} aria-label={t("operationsForm.newOwner")} className={selectClass} value={transferTo} onChange={event => setTransferTo(event.target.value)}><option value="">{t("operationsForm.chooseOwner")}</option>{team.data?.members.filter(member => member.role !== "owner").map(member => <option key={member.userId} value={member.userId}>{member.email}</option>)}</select>
          <Button variant="outline" disabled={!transferTo || change.isPending} onClick={() => { if (window.confirm(t("operationsForm.transferConfirm", { email: team.data?.members.find(member => member.userId === transferTo)?.email }))) run("POST", "/api/company/transfer", { userId: transferTo }); }}>{t("operationsForm.transfer")}</Button>
          <div><Button variant="outline" disabled={change.isPending} onClick={() => { if (window.confirm(context.company!.isActive ? t("operationsForm.closeConfirm", { name: context.company!.name }) : t("operationsForm.reopenConfirm", { name: context.company!.name }))) run("PATCH", "/api/company/active", { isActive: !context.company!.isActive }); }}>{context.company.isActive ? t("operationsForm.closeCompany") : t("operationsForm.reopenCompany")}</Button></div>
          {receipt("/api/company/transfer")}{receipt("/api/company/active")}
        </div>}
      </div>}
    </CardContent>
  </Card>;
}
