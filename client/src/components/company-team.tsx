import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyRole, Employee, WorkspaceContext } from "@shared/schema";
import { roleLabels } from "@/components/provider/company-role-labels";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Member = { userId: string; email: string; firstName: string | null; lastName: string | null; role: CompanyRole; employeeId: number | null };
type Team = { members: Member[]; invitations: { id: string; email: string; role: CompanyRole; employeeId: number | null; expiresAt: string }[] };
const selectClass = "w-full border rounded-md p-2 bg-white";
export function invalidateWorkspace(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ predicate: query => /\/api\/(company|provider|services|bookings|availability|auth\/user)/.test(String(query.queryKey[0])) });
}
function MemberEditor({ member, employees, busy, onSave, onRemove }: { member: Member; employees: Employee[]; busy: boolean; onSave: (userId: string, role: string, employeeId: number | null) => void; onRemove: (userId: string) => void }) {
  const [role, setRole] = useState(member.role);
  const [employeeId, setEmployeeId] = useState(member.employeeId);
  useEffect(() => { setRole(member.role); setEmployeeId(member.employeeId); }, [member.role, member.employeeId]);
  return <li className="border rounded-md p-3 space-y-2">
    <p className="font-medium">{[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}</p>
    <p className="text-xs text-neutral-500">{member.email}</p>
    {member.role === "owner" ? <p>Owner</p> : <>
      <div className="grid sm:grid-cols-2 gap-2"><select aria-label={`Access for ${member.email}`} className={selectClass} value={role} onChange={event => setRole(event.target.value as CompanyRole)}>
        {(["admin", "provider", "viewer"] as const).map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}
      </select><select aria-label={`Employee for ${member.email}`} className={selectClass} value={employeeId ?? "none"} onChange={event => setEmployeeId(event.target.value === "none" ? null : Number(event.target.value))}>
        <option value="none">No employee assignment</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
      </select></div>
      <div className="flex gap-2"><Button size="sm" disabled={busy || (role !== "admin" && employeeId == null)} onClick={() => onSave(member.userId, role, employeeId)}>Save Access</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm(`Remove ${member.email}'s access to this company?`)) onRemove(member.userId); }}>Remove Access</Button></div>
    </>}
  </li>;
}

export default function CompanyTeam({ context, employees }: { context: WorkspaceContext; employees: Employee[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("provider");
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [transferTo, setTransferTo] = useState("");
  useEffect(() => { setEmployeeId(null); setInvitationUrl(""); setTransferTo(""); setEmail(""); }, [context.company?.id]);
  const canViewTeam = context.permissions.manageTeam || context.permissions.isOwner;
  const team = useQuery<Team>({ queryKey: ["/api/company/team"], enabled: Boolean(context.company && canViewTeam), retry: false });
  const errorToast = (error: Error) => {
    const raw = error.message.replace(/^\d+:\s*/, "");
    let message = "Unable to complete this change.";
    try { message = JSON.parse(raw).message || message; } catch {}
    toast({ title: "Unable to update company", description: message, variant: "destructive" });
  };
  const change = useMutation({
    mutationFn: async (action: { method: string; path: string; body?: unknown }) => {
      const response = await apiRequest(action.method, action.path, action.body); return response.json();
    },
    onSuccess: async (data, action) => {
      if (data.invitationUrl) { setInvitationUrl(data.invitationUrl); setEmail(""); toast({ title: data.emailSent ? "Invitation emailed" : "Share invitation link", description: data.message }); }
      await invalidateWorkspace(queryClient);
    },
    onError: errorToast,
  });
  const run = (method: string, path: string, body?: unknown) => change.mutate({ method, path, body });
  return <Card>
    <CardHeader><CardTitle>Company team</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {context.company && <p className="text-sm text-neutral-600">{context.company.name} · {roleLabels[context.membership!.role]}{!context.company.isActive ? " · Closed" : ""}</p>}
      {context.membership?.role === "viewer" && <p className="text-sm">You can view reservations assigned to you. Contact an administrator for changes.</p>}
      {context.membership?.role === "provider" && <p className="text-sm">You can confirm, complete, cancel, and reschedule your assigned reservations.</p>}
      {context.company && canViewTeam && <div className="space-y-4 border-t pt-4">
        {team.isLoading ? <p>Loading team…</p> : team.isError ? <p role="alert">Unable to load the team.</p> : <ul className="space-y-2">
          {team.data?.members.map(member => <MemberEditor key={member.userId} member={member} employees={employees} busy={change.isPending || !context.permissions.manageTeam}
            onSave={(userId, role, employeeId) => run("PATCH", `/api/company/members/${userId}`, { role, employeeId })} onRemove={userId => run("DELETE", `/api/company/members/${userId}`)} />)}
        </ul>}
        {context.permissions.manageTeam && <form className="space-y-3 rounded-md bg-neutral-50 p-3" onSubmit={event => { event.preventDefault(); run("POST", "/api/company/invitations", { email, role, employeeId, sendEmail }); }}>
          <h4 className="font-medium">Invite a team member</h4>
          <div><Label htmlFor="team-email">Email address</Label><Input id="team-email" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></div>
          <div><Label htmlFor="team-role">Access level</Label><select id="team-role" className={selectClass} value={role} onChange={event => setRole(event.target.value)}>{(["admin", "provider", "viewer"] as const).map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></div>
          <div><Label htmlFor="team-employee">Employee</Label><select id="team-employee" className={selectClass} value={employeeId ?? "none"} onChange={event => setEmployeeId(event.target.value === "none" ? null : Number(event.target.value))}>
            <option value="none">No employee assignment</option>{employees.filter(employee => !team.data?.members.some(member => member.employeeId === employee.id)).map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select><p className="text-xs text-neutral-500 mt-1">Add an employee in Provider profile first. Providers and read-only members need an assignment.</p></div>
          <p className="text-sm text-neutral-600">Administrators manage all company services and reservations. Providers manage their own reservations. Read-only members can view their own reservations.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sendEmail} onChange={event => setSendEmail(event.target.checked)} />Send invitation email</label>
          <Button disabled={change.isPending || (role !== "admin" && employeeId == null)}>Create Invitation</Button>
        </form>}
        {invitationUrl && <div className="space-y-2"><Label htmlFor="invitation-link">Invitation link (expires in 7 days)</Label><Input id="invitation-link" readOnly value={invitationUrl} onFocus={event => event.target.select()} />
          <Button variant="outline" onClick={() => void navigator.clipboard.writeText(invitationUrl).then(() => toast({ title: "Invitation link copied" })).catch(() => toast({ title: "Select and copy the link above" }))}>Copy Link</Button></div>}
        {team.data?.invitations.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3"><p className="text-sm">Pending: {invitation.email} · {roleLabels[invitation.role]}</p>
          <Button size="sm" variant="outline" disabled={change.isPending || !context.permissions.manageTeam} onClick={() => run("DELETE", `/api/company/invitations/${invitation.id}`)}>Revoke</Button></div>)}
        {context.permissions.isOwner && <div className="space-y-3 border-t pt-3">
          <h4 className="font-medium">Owner controls</h4>
          <select aria-label="New owner" className={selectClass} value={transferTo} onChange={event => setTransferTo(event.target.value)}><option value="">Choose a new owner</option>{team.data?.members.filter(member => member.role !== "owner").map(member => <option key={member.userId} value={member.userId}>{member.email}</option>)}</select>
          <Button variant="outline" disabled={!transferTo || change.isPending} onClick={() => { if (window.confirm("Transfer ownership to this member? You will become an administrator.")) run("POST", "/api/company/transfer", { userId: transferTo }); }}>Transfer Ownership</Button>
          <div><Button variant="outline" disabled={change.isPending} onClick={() => { if (window.confirm(context.company!.isActive ? "Close this company? Its offers will be hidden and new bookings disabled. Reservation history is preserved." : "Reopen this company? Its published offers will become visible again.")) run("PATCH", "/api/company/active", { isActive: !context.company!.isActive }); }}>{context.company.isActive ? "Close Company" : "Reopen Company"}</Button></div>
        </div>}
      </div>}
    </CardContent>
  </Card>;
}
