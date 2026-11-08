import { useState } from "react";
import type { NativeProofClient } from "../client";
import { proofMessages, type ProofLanguage } from "./messages";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";

export function NativeProof({ client }: { client: NativeProofClient | null }) {
  const [language, setLanguage] = useState<ProofLanguage>("en"), [busy, setBusy] = useState(false);
  const [session, setSession] = useState(client?.session ?? null), [waiting, setWaiting] = useState(false);
  const [cold, setCold] = useState(false), [account, setAccount] = useState(""), [error, setError] = useState(false);
  const t = proofMessages[language];
  async function run(operation: () => Promise<void>) {
    if (!client || busy) return;
    setBusy(true); setError(false);
    try { await operation(); } catch { setError(true); setAccount(""); }
    finally { setSession(client.session); setBusy(false); }
  }
  return <main lang={language} dir="ltr">
    <h1>{t.title}</h1><p>{t.notice}</p>
    <Label htmlFor="proof-language">{t.language}</Label>{" "}<select id="proof-language" value={language} onChange={event => setLanguage(event.target.value as ProofLanguage)}><option value="en">English</option><option value="lv">Latviešu</option><option value="ru">Русский</option></select>
    {!client ? <p role="alert">{t.unavailable}</p> : <>
      <p role="status" aria-live="polite">{busy ? t.working : session?.user.displayName ?? (waiting ? t.waiting : t.signedOut)}</p>
      <div className="controls"><Button disabled={busy} onClick={() => void run(async () => { setAccount(""); setWaiting(false); await client.beginLogin(); setWaiting(true); })}>{t.start}</Button>
      <Button disabled={busy} onClick={() => void run(async () => { setAccount(""); await client.restore(); setWaiting(false); })}>{t.restore}</Button></div>
      <label className="check"><input type="checkbox" checked={cold} onChange={event => setCold(event.target.checked)} />{t.cold}</label>
      <div className="controls">{(["proof-alice", "proof-bob"] as const).map(id => <Button key={id} disabled={busy || !waiting} onClick={() => void run(async () => { setAccount(""); await client.simulateReturn(id, cold); setWaiting(false); })}>{id === "proof-alice" ? t.alice : t.bob}</Button>)}</div>
      <div className="controls"><Button disabled={busy || !session} onClick={() => void run(async () => { if (session) setAccount((await client.account(session.user.id)).displayName); })}>{t.read}</Button>
      <Button disabled={busy} onClick={() => void run(async () => { setAccount(""); setWaiting(false); await client.logout(); })}>{t.logout}</Button></div>
      <p data-testid="account-result">{account || t.empty}</p>{error && <p role="alert">{t.error}</p>}
    </>}
  </main>;
}
