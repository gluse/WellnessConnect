import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InvitationRecovery from "@/components/invitation-recovery";

type Invitation = { id: string; companyName: string; role: string; emailHint?: string };
export default function Invite() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const token = new URLSearchParams(window.location.search).get("token");
  const exchangeStarted = useRef(false);
  const [exchanging, setExchanging] = useState(Boolean(window.location.hash));
  const redirecting = useRef(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorText = (error: unknown) => {
    const raw = error instanceof Error ? error.message : "Unable to accept invitation";
    try { return JSON.parse(raw.slice(raw.indexOf(":") + 1)).message; } catch { return "Unable to accept invitation. Please try again."; }
  };
  const returnTo = window.location.pathname + window.location.search;
  const recoverSession = () => {
    if (redirecting.current) return;
    redirecting.current = true;
    queryClient.setQueryData(["/api/auth/user"], null);
    queryClient.removeQueries({ queryKey: ["/api/auth/invite-status"] });
    queryClient.removeQueries({ queryKey: ["/api/company/my-invitations"] });
    window.location.assign(`/login?error=invitation_session_expired&returnTo=${encodeURIComponent(returnTo)}`);
  };
  useEffect(() => {
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const refreshToken = fragment.get("refresh_token");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!refreshToken) { setExchanging(false); if (fragment.get("error")) setError("This sign-in link has expired. Sign in or request a new invitation."); return; }
    (async () => {
      await queryClient.cancelQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/auth/") });
      const response = await apiRequest("POST", "/api/auth/invite-session", { refreshToken });
      await response.json();
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.removeQueries({ queryKey: ["/api/auth/invite-status"] });
      queryClient.removeQueries({ queryKey: ["/api/company/my-invitations"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    })().catch(error => { if (isUnauthorizedError(error)) recoverSession(); else setError(errorText(error)); }).finally(() => setExchanging(false));
  }, []);
  const preview = useQuery<Invitation>({ queryKey: ["/api/company/invitation", token], queryFn: async () => {
    const response = await apiRequest("GET", `/api/company/invitation?token=${encodeURIComponent(token!)}`); return response.json();
  }, enabled: Boolean(token), retry: false });
  const pending = useQuery<Invitation[]>({ queryKey: ["/api/company/my-invitations"], enabled: isAuthenticated && !exchanging, retry: false });
  const inviteStatus = useQuery<{ needsPassword: boolean }>({ queryKey: ["/api/auth/invite-status"], enabled: isAuthenticated && !exchanging, retry: false, staleTime: 0, refetchOnWindowFocus: true });
  const mustSetPassword = Boolean(inviteStatus.data?.needsPassword);
  const passwordsMatch = password === confirmPassword;
  const passwordMismatch = Boolean(confirmPassword) && !passwordsMatch;
  useEffect(() => { if (isUnauthorizedError(inviteStatus.error)) recoverSession(); }, [inviteStatus.error]);
  const accept = async (id: string) => {
    if (busy || (mustSetPassword && (password.length < 8 || !passwordsMatch))) return;
    setBusy(true); setError("");
    try {
      const statusResponse = await apiRequest("GET", "/api/auth/invite-status");
      const status: { needsPassword: boolean } = await statusResponse.json();
      queryClient.setQueryData(["/api/auth/invite-status"], status);
      if (status.needsPassword) {
        if (password.length < 8 || !passwordsMatch) return;
        const response = await apiRequest("POST", "/api/auth/invite-password", { password });
        await response.json();
        setPassword(""); setConfirmPassword("");
        queryClient.setQueryData(["/api/auth/invite-status"], { needsPassword: false });
      }
      await apiRequest("POST", "/api/company/invitations/accept", { id });
      queryClient.clear(); window.location.assign("/dashboard");
    } catch (error) { if (isUnauthorizedError(error)) recoverSession(); else setError(errorText(error)); } finally { setBusy(false); }
  };
  const invitations = token ? preview.data ? [preview.data] : [] : pending.data || [];
  return <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 [overflow-wrap:anywhere]"><Card className="w-full max-w-lg min-w-0">
    <CardHeader><CardTitle>Join a company</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {(exchanging || isLoading || preview.isLoading || (isAuthenticated && pending.isLoading)) && <p>Loading invitation…</p>}
      {(error || preview.error || pending.error || inviteStatus.error) && <p role="alert" className="text-red-600">{error || errorText(preview.error || pending.error || inviteStatus.error)}</p>}
      {isAuthenticated && <p className="text-sm text-neutral-600">Signed in as {user?.email}</p>}
      {mustSetPassword && <>
        <div><Label htmlFor="invited-password">Set your password</Label><Input id="invited-password" type="password" required disabled={busy} minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" /><p className="text-xs text-neutral-500 mt-1">Use at least 8 characters, including uppercase, lowercase, and a number.</p></div>
        <div><Label htmlFor="invited-confirm-password">{t("authForm.confirmPassword")}</Label><Input id="invited-confirm-password" type="password" required disabled={busy} minLength={8} maxLength={128} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" aria-invalid={passwordMismatch} aria-describedby={passwordMismatch ? "invited-confirm-password-error" : undefined} />{passwordMismatch && <p id="invited-confirm-password-error" role="alert" className="text-sm text-destructive mt-1">{t("authForm.passwordMismatch")}</p>}</div>
      </>}
      {invitations.map(invitation => <div key={invitation.id} className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">{invitation.companyName}</h2>
        <p>Access: {invitation.role === "viewer" ? "Read-only" : invitation.role === "provider" ? "Service provider" : "Administrator"}</p>
        {invitation.emailHint && <p className="text-sm text-neutral-600">Invited email: {invitation.emailHint}</p>}
        {isAuthenticated ? <Button className="max-w-full h-auto min-h-10 whitespace-normal" disabled={busy || exchanging || inviteStatus.isFetching || inviteStatus.isPending || Boolean(inviteStatus.error) || (mustSetPassword && (password.length < 8 || !passwordsMatch))} onClick={() => void accept(invitation.id)}>Accept Invitation</Button>
          : <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="text-primary underline">Sign in or create an account to join</Link>}
      </div>)}
      {!token && isAuthenticated && !pending.isLoading && !invitations.length && <p>No pending invitations for this email address.</p>}
      {!isAuthenticated && !token && !exchanging && <Link href="/login?returnTo=%2Finvite" className="text-primary underline">Sign in to see your invitations</Link>}
      {!isAuthenticated && !exchanging && !isLoading && <InvitationRecovery returnTo={returnTo} />}
      <Link href="/" className="block text-sm text-neutral-500">Back to FitsMyTime</Link>
    </CardContent>
  </Card></main>;
}
