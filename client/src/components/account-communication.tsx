import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { notificationLanguages, type CommunicationSettings, type VerificationResult } from "@shared/notifications";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const languageNames: Record<string, string> = { en: "English", lv: "Latviešu", ru: "Русский", ar: "العربية", zh: "中文", fr: "Français", de: "Deutsch", hi: "हिन्दी", ja: "日本語", pt: "Português", es: "Español" };
export default function AccountCommunication({ actorId }: { actorId: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const current = useRef(true);
  const actionLock = useRef(false);
  useEffect(() => { current.current = true; return () => { current.current = false; }; }, []);
  const query = useQuery<CommunicationSettings>({ queryKey: ["/api/account/communication", actorId], queryFn: async ({ signal }) => (await apiRequest("GET", "/api/account/communication", undefined, signal)).json(), staleTime: 0, gcTime: 0, retry: false });
  const [draft, setDraft] = useState<CommunicationSettings | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<VerificationResult | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!challenge) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [challenge]);
  const settings = draft ?? query.data;
  const changedPhone = (settings?.phone?.trim() ?? "") !== (query.data?.phone ?? "");
  const save = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", "/api/account/communication", { phone: settings?.phone?.trim() || null, preferredMethod: settings?.preferredMethod ?? null, language: settings?.language, smsOptIn: settings?.smsOptIn, whatsappOptIn: settings?.whatsappOptIn })).json() as Promise<CommunicationSettings>,
    onSuccess: async data => { if (!current.current) return; setDraft(data); setError(""); setMessage("notifications.saved"); setChallenge(null); setCode(""); await query.refetch(); },
    onError: () => { if (current.current) setError("notifications.saveError"); },
    onSettled: () => { actionLock.current = false; },
  });
  const verify = useMutation({
    mutationFn: async (action: "start" | "check") => {
      // The API verifies the saved phone. Save only that field here; other
      // preference edits remain a draft until the user explicitly saves them.
      if (action === "start" && changedPhone) {
        let saved: CommunicationSettings;
        try { saved = await (await apiRequest("PATCH", "/api/account/communication", { phone: settings?.phone?.trim() })).json(); }
        catch { throw new Error("phone-save"); }
        if (!current.current) throw new Error("unmounted");
        client.setQueryData(["/api/account/communication", actorId], saved);
        setDraft(previous => previous ? { ...previous, phone: saved.phone, phoneVerified: saved.phoneVerified, smsOptIn: saved.smsOptIn, whatsappOptIn: saved.whatsappOptIn, preferredMethod: previous.preferredMethod === "email" ? "email" : null } : saved);
      }
      if (!current.current) throw new Error("unmounted");
      return (await apiRequest("POST", `/api/account/communication/verify/${action}`, action === "check" ? { code } : {})).json() as Promise<VerificationResult>;
    },
    onSuccess: async result => { if (!current.current) return; setChallenge(result); setNow(Date.now()); setError(""); setMessage(result.status === "verified" ? "notifications.verified" : "notifications.codeSent"); if (result.status === "verified") { setDraft(previous => previous ? { ...previous, phoneVerified: true } : null); setCode(""); await query.refetch(); } },
    onError: failure => { if (current.current) setError(failure.message === "phone-save" ? "notifications.saveError" : "notifications.verifyError"); },
    onSettled: () => { actionLock.current = false; },
  });
  const busy = save.isPending || verify.isPending;
  const verified = Boolean(settings?.phoneVerified && !changedPhone);
  const edit = (patch: Partial<CommunicationSettings>) => { if (settings) setDraft({ ...settings, ...patch }); setMessage(""); setError(""); };
  const submit = (event: FormEvent) => { event.preventDefault(); if (busy || actionLock.current) return; if (settings?.phone && !/^\+[1-9]\d{7,14}$/.test(settings.phone.trim())) { setError("notifications.phoneInvalid"); return; } actionLock.current = true; save.mutate(); };
  const verifyPhone = (action: "start" | "check") => {
    if (busy || actionLock.current) return;
    if (action === "start" && !/^\+[1-9]\d{7,14}$/.test(settings?.phone?.trim() ?? "")) { setError("notifications.phoneInvalid"); return; }
    setError(""); setMessage(""); actionLock.current = true; verify.mutate(action);
  };
  const expired = Boolean(challenge?.expiresAt && now >= new Date(challenge.expiresAt).getTime());
  const coolingDown = Boolean(challenge?.nextSendAt && now < new Date(challenge.nextSendAt).getTime());
  return <Card id="communication" aria-labelledby="communication-heading"><CardHeader><h2 id="communication-heading" className="text-lg font-semibold">{t("notifications.settingsTitle")}</h2><p className="text-sm text-muted-foreground">{t("notifications.settingsHelp")}</p></CardHeader><CardContent className="space-y-5">
    {query.isPending ? <p role="status">{t("notifications.loading")}</p> : query.isError ? <div role="alert"><p>{t("notifications.loadError")}</p><Button onClick={() => void query.refetch()}>{t("notifications.retry")}</Button></div> : settings && <>
      <form id="communication-form" onSubmit={submit} noValidate className="space-y-5" aria-busy={busy}>
        <CommunicationFields settings={settings} busy={busy} verified={verified} error={error} edit={edit} onPhoneChange={() => { setChallenge(null); setCode(""); }}
          sendCode={!verified && <Button type="button" variant="outline" className="min-h-11 h-auto whitespace-normal shrink-0 sm:max-w-[16rem]" disabled={busy || !settings.phone?.trim() || !settings.verificationAvailable || coolingDown} onClick={() => verifyPhone("start")}>{t(verify.isPending ? "notifications.sendingCode" : "notifications.sendCode")}</Button>}
          verification={!verified && <>
            <p className="text-sm text-muted-foreground">{t(!settings.verificationAvailable ? "notifications.verificationUnavailable" : coolingDown ? "notifications.resendWait" : changedPhone ? "notifications.saveAndVerifyHelp" : "notifications.verifyHelp")}</p>
            <PhoneVerification busy={busy} challenge={challenge} expired={expired} code={code} error={error} setCode={setCode} verifyPhone={verifyPhone} />
          </>}
        />
        <Button disabled={busy} type="submit" className="min-h-11 h-auto whitespace-normal">{t(save.isPending ? "notifications.saving" : "notifications.save")}</Button>
      </form>
    </>}
    {error && <p id="communication-error" role="alert" className="text-sm text-red-700 dark:text-red-300">{t(error)}</p>}{message && <p role="status" className="text-sm">{t(message)}</p>}
  </CardContent></Card>;
}


type CommunicationFieldsProps = {
  settings: CommunicationSettings;
  busy: boolean;
  verified: boolean;
  error: string;
  edit: (patch: Partial<CommunicationSettings>) => void;
  onPhoneChange: () => void;
  sendCode: ReactNode;
  verification: ReactNode;
};

function CommunicationFields({ settings, busy, verified, error, edit, onPhoneChange, sendCode, verification }: CommunicationFieldsProps) {
  const { t } = useTranslation();
  return <fieldset disabled={busy} className="space-y-5 min-w-0">
          <div className="space-y-2"><Label htmlFor="communication-phone">{t("notifications.phone")}</Label><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><Input className="min-w-0 min-h-11 flex-1" placeholder="+37120000000" id="communication-phone" type="tel" autoComplete="tel" dir="ltr" maxLength={16} value={settings.phone ?? ""} aria-describedby={error === "notifications.phoneInvalid" ? "communication-phone-help communication-error" : "communication-phone-help"} aria-invalid={error === "notifications.phoneInvalid" || undefined} onChange={event => { edit({ phone: event.target.value, phoneVerified: false, smsOptIn: false, whatsappOptIn: false, preferredMethod: settings.preferredMethod === "email" ? "email" : null }); onPhoneChange(); }} />{sendCode}</div><p id="communication-phone-help" className="text-sm text-muted-foreground">{t("notifications.phoneHelp")}</p><p role="status" className="text-sm">{t(verified ? "notifications.verified" : "notifications.notVerified")}</p>{verification}</div>
          <div className="space-y-3">{(["sms", "whatsapp"] as const).map(method => <label key={method} className="flex gap-3 items-start min-h-11"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" disabled={!verified} checked={method === "sms" ? settings.smsOptIn : settings.whatsappOptIn} onChange={event => { const checked = event.target.checked; edit({ [method === "sms" ? "smsOptIn" : "whatsappOptIn"]: checked, ...(!checked && settings.preferredMethod === method ? { preferredMethod: "email" as const } : {}) }); }} /><span>{t(`notifications.optIn.${method}`)}</span></label>)}<p className="text-sm text-muted-foreground">{t("notifications.verificationHelp")}</p></div>
          <div className="space-y-2"><Label htmlFor="communication-method">{t("notifications.preferred")}</Label><select id="communication-method" className="min-h-11 border rounded-md p-2 bg-background w-full" value={settings.preferredMethod ?? ""} onChange={event => edit({ preferredMethod: (event.target.value || null) as CommunicationSettings["preferredMethod"] })}><option value="">{t("notifications.serviceDefault")}</option><option value="email">{t("notifications.method.email")}</option><option value="sms" disabled={!verified || !settings.smsOptIn}>{t("notifications.method.sms")}</option><option value="whatsapp" disabled={!verified || !settings.whatsappOptIn}>{t("notifications.method.whatsapp")}</option></select></div>
          <div className="space-y-2"><Label htmlFor="communication-language">{t("notifications.language")}</Label><select id="communication-language" className="min-h-11 border rounded-md p-2 bg-background w-full" value={settings.language} onChange={event => edit({ language: event.target.value as CommunicationSettings["language"] })}>{notificationLanguages.map(language => <option key={language} value={language} lang={language}>{languageNames[language]}</option>)}</select></div>
        </fieldset>;
}

type PhoneVerificationProps = {
  busy: boolean;
  challenge: VerificationResult | null;
  expired: boolean;
  code: string;
  error: string;
  setCode: (code: string) => void;
  verifyPhone: (action: "start" | "check") => void;
};

function PhoneVerification({ busy, challenge, expired, code, error, setCode, verifyPhone }: PhoneVerificationProps) {
  const { t } = useTranslation();
  if (challenge?.status !== "pending") return null;
  const canCheck = !busy && !expired && /^\d{6}$/.test(code);
  return <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
    <Label htmlFor="communication-code">{t("notifications.code")}</Label>
    <div className="flex flex-col gap-3 sm:flex-row">
      <Input id="communication-code" className="min-w-0 min-h-11 flex-1" autoComplete="one-time-code" inputMode="numeric" dir="ltr" maxLength={6} value={code} onChange={event => setCode(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (canCheck) verifyPhone("check"); } }} disabled={busy || expired} aria-invalid={error === "notifications.verifyError" || undefined} aria-describedby={error === "notifications.verifyError" ? "communication-error" : undefined} />
      <Button type="button" className="min-h-11 h-auto whitespace-normal" disabled={!canCheck} onClick={() => verifyPhone("check")}>{t("notifications.verify")}</Button>
    </div>
    {expired && <p role="status">{t("notifications.codeExpired")}</p>}
  </div>;
}
