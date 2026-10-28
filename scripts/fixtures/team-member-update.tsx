import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "../../client/src/components/ui/toaster";
import CompanyTeam from "../../client/src/components/company-team";
import { queryClient } from "../../client/src/lib/queryClient";
import type { Employee, WorkspaceContext } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
const context = {
  company: { id: 7, name: "Synthetic company", isActive: true },
  membership: { role: "owner", userId: "owner" }, workspaces: [], invalid: false,
  permissions: { manageCompany: true, manageTeam: true, manageServices: true,
    manageSchedules: true, manageBookings: true, readAll: true, isOwner: true },
} as unknown as WorkspaceContext;
const employees = [10, 11, 12, 13].map(id => ({ id, name: `Synthetic employee ${id}` })) as Employee[];
const team = {
  members: [
    { userId: "owner", email: "owner@example.test", firstName: "Synthetic", lastName: "Owner", role: "owner", employeeId: null as number | null },
    { userId: "member", email: "member@example.test", firstName: "Synthetic", lastName: "Member", role: "provider", employeeId: 10 },
  ],
  invitations: [] as { id: string; email: string; role: string; employeeId: number | null; expiresAt: string }[],
};
if (params.get("scenario") === "santa") {
  Object.assign(team.members[1], { firstName: "Juris", lastName: "Synthetic", email: "juris@example.test" });
  team.invitations.push({ id: "santa-invite", email: "santa@example.test", role: "admin", employeeId: 11, expiresAt: "2099-01-01T00:00:00Z" },
    { id: "other-invite", email: "other@example.test", role: "provider", employeeId: 12, expiresAt: "2099-01-01T00:00:00Z" });
}
const fixture = {
  ready: false,
  calls: [] as { method: string; path: string; body: Record<string, unknown> }[],
  unexpected: [] as string[], result: "success", holdGet: params.has("holdGet"), holdWrite: false,
  errorGet: params.has("loadError"), confirm: true, confirmations: [] as string[],
  clipboard: "", copyFails: false,
  resolveGet: null as (() => void) | null,
  resolveWrite: null as (() => void) | null,
  serverMember: () => structuredClone(team.members[1]),
  serverTeam: () => structuredClone(team),
  setServerMember: (role: string, employeeId: number) => Object.assign(team.members[1], { role, employeeId }),
  setServerInvitation: (id: string, role: string, employeeId: number) => Object.assign(team.invitations.find(invitation => invitation.id === id)!, { role, employeeId }),
  refresh: () => queryClient.invalidateQueries({ queryKey: ["/api/company/team"] }),
  remount: () => {},
  rerender: () => {},
  setPermissions: (manageTeam: boolean, isOwner: boolean) => { context.permissions.manageTeam = manageTeam; context.permissions.isOwner = isOwner; fixture.rerender(); },
  switchWorkspace: () => { context.company = { ...context.company!, id: 8, name: "Other synthetic company" }; fixture.rerender(); },
};
Object.assign(window, { phase2Fixture: fixture, teamUpdateFixture: fixture });
window.confirm = message => { fixture.confirmations.push(message || ""); return fixture.confirm; };
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { if (fixture.copyFails) throw Error("Clipboard denied"); fixture.clipboard = text; } } });
const otherTeam = { members: [{ ...team.members[0], email: "other-owner@example.test" }], invitations: [] as typeof team.invitations };
if (params.has("denied")) { context.permissions.manageTeam = false; context.permissions.isOwner = false; }
if (params.has("readOnly")) context.permissions.manageTeam = false;
if (params.has("empty")) { team.members = []; team.invitations = []; }
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const target = context.company?.id === 8 ? otherTeam : team;
  fixture.calls.push({ path, method, body });
  if (path === "/api/company/team" && method === "GET") {
    if (fixture.holdGet) await new Promise<void>(resolve => { fixture.resolveGet = resolve; });
    if (fixture.errorGet) return Response.json({}, { status: 503 });
    return Response.json(target);
  }
  if (path === "/api/company/members/member" && method === "PATCH") {
    if (fixture.holdWrite) await new Promise<void>(resolve => { fixture.resolveWrite = resolve; });
    if (fixture.result === "forbidden") return Response.json({ message: "Forbidden" }, { status: 403 });
    Object.assign(target.members.find(member => member.userId === "member")!, body);
    // Match the real endpoint's acknowledgement, with no updated member object.
    return Response.json({ success: true });
  }
  if (path === "/api/company/invitations" && method === "POST") {
    if (fixture.holdWrite) await new Promise<void>(resolve => { fixture.resolveWrite = resolve; });
    if (fixture.result === "forbidden") return Response.json({ message: "Forbidden" }, { status: 403 });
    if (body.employeeId != null && (team.members.some(member => member.employeeId === body.employeeId) || team.invitations.some(invite => invite.employeeId === body.employeeId))) {
      return Response.json({ message: "Employee already assigned" }, { status: 409 });
    }
    const id = `invite-${team.invitations.length + 1}`;
    team.invitations.push({ email: body.email, role: body.role, employeeId: body.employeeId, id, expiresAt: "2099-01-01T00:00:00Z" });
    return Response.json({ invitationUrl: `${location.origin}/invitation?token=${id}`, emailSent: false });
  }
  if (path.startsWith("/api/company/invitations/") && method === "DELETE") {
    if (fixture.result === "forbidden") return Response.json({}, { status: 403 });
    const index = team.invitations.findIndex(invitation => invitation.id === path.split("/").at(-1));
    team.invitations.splice(index, 1);
    return Response.json({ success: true });
  }
  if (path === "/api/company/members/member" && method === "DELETE") {
    if (fixture.result === "forbidden") return Response.json({}, { status: 403 });
    team.members = team.members.filter(member => member.userId !== "member");
    return Response.json({ success: true });
  }
  if (path === "/api/company/active" && method === "PATCH") {
    if (fixture.result === "forbidden") return Response.json({}, { status: 403 });
    context.company!.isActive = body.isActive;
    fixture.rerender();
    return Response.json({ success: true });
  }
  if (path === "/api/company/transfer" && method === "POST") {
    if (fixture.result === "forbidden") return Response.json({}, { status: 403 });
    return Response.json({ success: true });
  }
  if (path.startsWith("/api/company/invitations/") && method === "PATCH") {
    if (fixture.holdWrite) await new Promise<void>(resolve => { fixture.resolveWrite = resolve; });
    if (fixture.result === "forbidden") return Response.json({ message: "Forbidden" }, { status: 403 });
    const id = path.split("/").at(-1), invitation = team.invitations.find(item => item.id === id);
    if (!invitation) return Response.json({ message: "Not found" }, { status: 404 });
    if (body.employeeId != null && (team.members.some(member => member.employeeId === body.employeeId) || team.invitations.some(other => other.id !== id && other.employeeId === body.employeeId))) return Response.json({ message: "Employee already assigned" }, { status: 409 });
    Object.assign(invitation, { role: body.role, employeeId: body.employeeId });
    return Response.json({ success: true });
  }
  fixture.unexpected.push(`${method} ${path}`);
  throw Error("Unexpected synthetic request");
};
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false,
  resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
function Fixture() {
  const [revision, setRevision] = useState(0);
  const [, update] = useState(0);
  fixture.remount = () => setRevision(value => value + 1);
  fixture.rerender = () => update(value => value + 1);
  useEffect(() => { document.documentElement.lang = i18next.language; document.documentElement.dir = "ltr"; fixture.ready = true; }, []);
  return <div className="min-h-screen bg-background text-foreground"><main className="mx-auto max-w-6xl p-4 sm:p-8"><CompanyTeam key={revision} context={context} employees={employees} /></main><Toaster /></div>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
