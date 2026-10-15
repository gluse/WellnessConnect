import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { passwordChangeFormSchema } from "@shared/password";
import { PasswordUpdateResponseError, updateAccountPassword } from "@/lib/password";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountPasswordForm() {
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const change = useMutation({
    mutationFn: () => updateAccountPassword({ currentPassword, newPassword }),
    onSuccess: result => {
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setError("");
      if (result.requiresSignIn) { queryClient.clear(); window.location.assign("/login?returnTo=%2Faccount&passwordUpdated=1"); return; }
      setSaved(true);
    },
    onError: error => {
      if (isUnauthorizedError(error)) { queryClient.setQueryData(["/api/auth/user"], null); return; }
      if (error instanceof PasswordUpdateResponseError) { setError(error.message); return; }
      try { setError(JSON.parse(error.message.replace(/^\d+:\s*/, "")).message || "Unable to update your password."); }
      catch { setError("Unable to update your password. Please try again."); }
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (change.isPending) return;
    setSaved(false); setError("");
    const parsed = passwordChangeFormSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    change.mutate();
  }
  const edited = () => { setError(""); setSaved(false); };
  return <Card>
    <CardHeader><CardTitle>Update password</CardTitle><CardDescription>Verify your current password and choose a new one.</CardDescription></CardHeader>
    <CardContent><form id="account-password-form" onSubmit={submit} className="space-y-4">
      <fieldset disabled={change.isPending} className="space-y-4 min-w-0">
        <div className="space-y-2"><Label htmlFor="account-current-password">Current password</Label><Input id="account-current-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={event => { setCurrentPassword(event.target.value); edited(); }} /></div>
        <div className="space-y-2"><Label htmlFor="account-new-password">New password</Label><Input id="account-new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} aria-describedby="account-password-help" value={newPassword} onChange={event => { setNewPassword(event.target.value); edited(); }} /><p id="account-password-help" className="text-xs text-neutral-500">Use at least 8 characters and meet your account's password requirements.</p></div>
        <div className="space-y-2"><Label htmlFor="account-confirm-password">Confirm new password</Label><Input id="account-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={event => { setConfirmPassword(event.target.value); edited(); }} /></div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {saved && <p role="status" className="text-sm text-green-700">Password updated.</p>}
      <Button type="submit" disabled={change.isPending} className="w-full sm:w-auto">{change.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{change.isPending ? "Updating…" : "Update password"}</Button>
    </form></CardContent>
  </Card>;
}
