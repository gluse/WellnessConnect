import { useRef, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useFormLocale } from "@/components/forms-locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InvitationRecovery({ returnTo }: { returnTo: string }) {
  const { t } = useFormLocale();
  const [email, setEmail] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(false), [error, setError] = useState("");
  const locked = useRef(false), errorRef = useRef<HTMLParagraphElement>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (locked.current) return; locked.current = true;
    setBusy(true); setMessage(false); setError("");
    try {
      const response = await apiRequest("POST", "/api/auth/invite-recovery", { email, returnTo });
      await response.json(); setMessage(true);
    } catch (failure) {
      setError(failure instanceof Error && failure.message.startsWith("429:") ? "rateLimited" : "recoveryFailed"); requestAnimationFrame(() => errorRef.current?.focus());
    } finally { locked.current = false; setBusy(false); }
  }
  return <form onSubmit={submit} aria-labelledby="auth-recovery-heading" className="auth-form border rounded-lg p-4 space-y-4">
    <h2 id="auth-recovery-heading" className="text-lg font-semibold">{t("authForm.recoveryTitle")}</h2>
    <p className="text-sm text-muted-foreground">{t("authForm.recoveryHelp")}</p>
    <div><Label htmlFor="invitation-recovery-email">{t("authForm.invitedEmail")}</Label><Input id="invitation-recovery-email" type="email" required maxLength={254} autoComplete="email" disabled={busy} value={email} onChange={event => setEmail(event.target.value)} /></div>
    <Button type="submit" variant="outline" disabled={busy}>{t(busy ? "authForm.sending" : "authForm.recoverySend")}</Button>
    {message && <p role="status" className="text-sm">{t("authForm.recoverySent")}</p>}
    {error && <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">{t(`authForm.${error}`)}</p>}
  </form>;
}
