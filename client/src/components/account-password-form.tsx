import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { passwordChangeFormSchema } from "@shared/password";
import { PasswordUpdateResponseError, updateAccountPassword } from "@/lib/password";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export default function AccountPasswordForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const change = useMutation({
    mutationFn: () => updateAccountPassword({ currentPassword, newPassword }),
    onSuccess: result => {
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setError(""); setErrors({});
      if (result.requiresSignIn) { queryClient.clear(); window.location.assign("/login?returnTo=%2Faccount&passwordUpdated=1"); return; }
      setSaved(true);
    },
    onError: error => {
      if (isUnauthorizedError(error)) { queryClient.setQueryData(["/api/auth/user"], null); return; }
      if (error instanceof PasswordUpdateResponseError) { setError("passwordForm.unconfirmed"); return; }
      let message = ""; try { message = JSON.parse(error.message.replace(/^\d+:\s*/, "")).message || ""; } catch {}
      const known: Record<string, string> = {
        "Current password is incorrect.": "passwordForm.incorrect",
        "Choose a password different from your current password.": "passwordForm.different",
        "Choose a stronger password that meets your account's password requirements.": "passwordForm.stronger",
        "Too many attempts. Please try again later.": "passwordForm.rateLimited",
        "Your password was saved. Sign in again to continue.": "passwordForm.savedSignIn",
      };
      if (message === "Current password is incorrect.") { setErrors({ currentPassword: "passwordForm.incorrect" }); return; }
      setError(known[message] || "passwordForm.saveError");
    },
    onSettled: () => { submitting.current = false; },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setSaved(false); setError("");
    const parsed = passwordChangeFormSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        next[field] = field === "confirmPassword" ? "passwordForm.mismatch" : issue.code === "custom" ? "passwordForm.different" : field === "currentPassword" && issue.code === "too_small" ? "passwordForm.required" : "passwordForm.length";
      }
      setErrors(next); queueMicrotask(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return;
    }
    setErrors({}); submitting.current = true; change.mutate();
  }
  const edited = (field: string) => { setError(""); setSaved(false); setErrors(previous => { const next = { ...previous }; delete next[field]; return next; }); };
  return <Card id="password" className="scroll-mt-6" aria-labelledby="account-password-title">
    <CardHeader><h2 className="text-lg font-semibold" id="account-password-title">{t("passwordForm.title")}</h2><CardDescription>{t("passwordForm.intro")}</CardDescription></CardHeader>
    <CardContent><form ref={form} id="account-password-form" onSubmit={submit} noValidate className="space-y-4" aria-busy={change.isPending}>
      <fieldset disabled={change.isPending} className="space-y-4 min-w-0">
        {[{ id: "account-current-password", field: "currentPassword", label: "passwordForm.current", value: currentPassword, set: setCurrentPassword, auto: "current-password" },
          { id: "account-new-password", field: "newPassword", label: "passwordForm.new", value: newPassword, set: setNewPassword, auto: "new-password" },
          { id: "account-confirm-password", field: "confirmPassword", label: "passwordForm.confirm", value: confirmPassword, set: setConfirmPassword, auto: "new-password" }].map(item => <div className="space-y-2" key={item.field}>
          <Label htmlFor={item.id}>{t(item.label)}</Label>
          <Input id={item.id} name={item.field} type="password" autoComplete={item.auto} required maxLength={128} minLength={item.field === "currentPassword" ? undefined : 8} value={item.value}
            aria-invalid={Boolean(errors[item.field]) || undefined}
            aria-describedby={[item.field === "newPassword" ? "account-password-help" : "", errors[item.field] ? item.id + "-error" : ""].filter(Boolean).join(" ") || undefined}
            onChange={event => { item.set(event.target.value); edited(item.field); }} />
          {item.field === "newPassword" && <p id="account-password-help" className="text-sm text-muted-foreground">{t("passwordForm.help")}</p>}
          {errors[item.field] && <p id={item.id + "-error"} role="alert" className="text-sm text-red-700 dark:text-red-300">{t(errors[item.field])}</p>}
        </div>)}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t(error)}</p>}
      {saved && <p role="status" className="text-sm">{t("passwordForm.saved")}</p>}
      <Button type="submit" disabled={change.isPending} className="w-full sm:w-auto">{change.isPending && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none shrink-0" aria-hidden="true" />}{t(change.isPending ? "passwordForm.updating" : "passwordForm.title")}</Button>
    </form></CardContent>
  </Card>;
}
