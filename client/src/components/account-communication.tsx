import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  const changedPhone = (settings?.phone ?? "") !== (query.data?.phone ?? "");
  const dirty = Boolean(draft && JSON.stringify(draft) !== JSON.stringify(query.data));
  const save = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", "/api/account/communication", { phone: settings?.phone?.trim() || null, preferredMethod: settings?.preferredMethod ?? null, language: settings?.language, smsOptIn: settings?.smsOptIn, whatsappOptIn: settings?.whatsappOptIn })).json() as Promise<CommunicationSettings>,
    onSuccess: async data => { if (!current.current) return; setDraft(data); setError(""); setMessage("notifications.saved"); setChallenge(null); setCode(""); await query.refetch(); },
    onError: () => { if (current.current) setError("notifications.saveError"); },
    onSettled: () => { actionLock.current = false; },
  });
  const verify = useMutation({
    mutationFn: async (action: "start" | "check") => (await apiRequest("POST", `/api/account/communication/verify/${action}`, action === "check" ? { code } : {})).json() as Promise<VerificationResult>,
    onSuccess: async result => { if (!current.current) return; setChallenge(result); setNow(Date.now()); setError(""); setMessage(result.status === "verified" ? "notifications.verified" : "notifications.codeSent"); if (result.status === "verified") { setDraft(null); setCode(""); await query.refetch(); } },
    onError: () => { if (current.current) setError("notifications.verifyError"); },
    onSettled: () => { actionLock.current = false; },
  });
  const busy = save.isPending || verify.isPending;
  const verified = Boolean(settings?.phoneVerified && !changedPhone);
  const edit = (patch: Partial<CommunicationSettings>) => { if (settings) setDraft({ ...settings, ...patch }); setMessage(""); setError(""); };
  const submit = (event: FormEvent) => { event.preventDefault(); if (busy || actionLock.current) return; if (settings?.phone && !/^\+[1-9]\d{7,14}$/.test(settings.phone)) { setError("notifications.phoneInvalid"); return; } actionLock.current = true; save.mutate(); };
  const verifyPhone = (action: "start" | "check") => { if (busy || actionLock.current) return; actionLock.current = true; verify.mutate(action); };
  const expired = Boolean(challenge?.expiresAt && now >= new Date(challenge.expiresAt).getTime());
  const coolingDown = Boolean(challenge?.nextSendAt && now < new Date(challenge.nextSendAt).getTime());
  return <Card id="communication" aria-labelledby="communication-heading"><CardHeader><h2 id="communication-heading" className="text-lg font-semibold">{t("notifications.settingsTitle")}</h2><p className="text-sm text-muted-foreground">{t("notifications.settingsHelp")}</p></CardHeader><CardContent className="space-y-5">
    {query.isPending ? <p role="status">{t("notifications.loading")}</p> : query.isError ? <div role="alert"><p>{t("notifications.loadError")}</p><Button onClick={() => void query.refetch()}>{t("notifications.retry")}</Button></div> : settings && <>
      <form id="communication-form" onSubmit={submit} noValidate className="space-y-5" aria-busy={busy}>
        <fieldset disabled={busy} className="space-y-5 min-w-0">
          <div className="space-y-2"><Label htmlFor="communication-phone">{t("notifications.phone")}</Label><Input id="communication-phone" type="tel" autoComplete="tel" dir="ltr" maxLength={16} value={settings.phone ?? ""} aria-describedby={error === "notifications.phoneInvalid" ? "communication-phone-help communication-error" : "communication-phone-help"} aria-invalid={error === "notifications.phoneInvalid" || undefined} onChange={event => { edit({ phone: event.target.value, phoneVerified: false, smsOptIn: false, whatsappOptIn: false, preferredMethod: settings.preferredMethod === "email" ? "email" : null }); setChallenge(null); setCode(""); }} /><p id="communication-phone-help" className="text-sm text-muted-foreground">{t("notifications.phoneHelp")}</p><p role="status" className="text-sm">{t(verified ? "notifications.verified" : "notifications.notVerified")}</p></div>
          <div className="space-y-3">{(["sms", "whatsapp"] as const).map(method => <label key={method} className="flex gap-3 items-start min-h-11"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" disabled={!verified} checked={method === "sms" ? settings.smsOptIn : settings.whatsappOptIn} onChange={event => { const checked = event.target.checked; edit({ [method === "sms" ? "smsOptIn" : "whatsappOptIn"]: checked, ...(!checked && settings.preferredMethod === method ? { preferredMethod: "email" as const } : {}) }); }} /><span>{t(`notifications.optIn.${method}`)}</span></label>)}<p className="text-sm text-muted-foreground">{t("notifications.verificationHelp")}</p></div>
          <div className="space-y-2"><Label htmlFor="communication-method">{t("notifications.preferred")}</Label><select id="communication-method" className="min-h-11 border rounded-md p-2 bg-background w-full" value={settings.preferredMethod ?? ""} onChange={event => edit({ preferredMethod: (event.target.value || null) as CommunicationSettings["preferredMethod"] })}><option value="">{t("notifications.serviceDefault")}</option><option value="email">{t("notifications.method.email")}</option><option value="sms" disabled={!verified || !settings.smsOptIn}>{t("notifications.method.sms")}</option><option value="whatsapp" disabled={!verified || !settings.whatsappOptIn}>{t("notifications.method.whatsapp")}</option></select></div>
          <div className="space-y-2"><Label htmlFor="communication-language">{t("notifications.language")}</Label><select id="communication-language" className="min-h-11 border rounded-md p-2 bg-background w-full" value={settings.language} onChange={event => edit({ language: event.target.value as CommunicationSettings["language"] })}>{notificationLanguages.map(language => <option key={language} value={language} lang={language}>{languageNames[language]}</option>)}</select></div>
        </fieldset>
        <Button disabled={busy} type="submit" className="min-h-11 h-auto whitespace-normal">{t(busy ? "notifications.saving" : "notifications.save")}</Button>
      </form>
      {!verified && settings.phone && <div className="border rounded-lg p-4 space-y-3"><p className="text-sm">{t(dirty ? "notifications.saveBeforeVerify" : !settings.verificationAvailable ? "notifications.verificationUnavailable" : "notifications.verifyHelp")}</p><Button type="button" variant="outline" className="min-h-11 h-auto whitespace-normal" disabled={busy || dirty || !settings.verificationAvailable || coolingDown} onClick={() => verifyPhone("start")}>{t("notifications.sendCode")}</Button>
        {challenge?.status === "pending" && <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (!expired && /^\d{6}$/.test(code)) verifyPhone("check"); }}><Label htmlFor="communication-code">{t("notifications.code")}</Label><Input id="communication-code" autoComplete="one-time-code" inputMode="numeric" dir="ltr" maxLength={6} value={code} onChange={event => setCode(event.target.value)} disabled={busy || expired} aria-invalid={error === "notifications.verifyError" || undefined} aria-describedby={error === "notifications.verifyError" ? "communication-error" : undefined} /><Button type="submit" disabled={busy || expired || !/^\d{6}$/.test(code)}>{t("notifications.verify")}</Button>{expired && <p role="status">{t("notifications.codeExpired")}</p>}</form>}
      </div>}
    </>}
    {error && <p id="communication-error" role="alert" className="text-sm text-red-700 dark:text-red-300">{t(error)}</p>}{message && <p role="status" className="text-sm">{t(message)}</p>}
  </CardContent></Card>;
}
