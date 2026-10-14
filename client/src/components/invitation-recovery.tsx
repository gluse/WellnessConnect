import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InvitationRecovery({ returnTo }: { returnTo: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await apiRequest("POST", "/api/auth/invite-recovery", { email, returnTo });
      setMessage((await response.json()).message);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      try { setError(JSON.parse(raw.slice(raw.indexOf(":") + 1)).message); }
      catch { setError("Unable to send a sign-in email. Please try again."); }
    } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="border rounded-lg p-4 space-y-3">
    <p className="font-medium">No password yet, or invitation sign-in expired?</p>
    <p className="text-sm text-neutral-600">Request a fresh email link to finish your invitation.</p>
    <Label htmlFor="invitation-recovery-email">Invited email address</Label>
    <Input id="invitation-recovery-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
    <Button type="submit" variant="outline" disabled={busy}>{busy ? "Sending…" : "Send fresh sign-in email"}</Button>
    {message && <p role="status" className="text-sm text-green-700">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </form>;
}
