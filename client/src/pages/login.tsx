import { useRef, useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import { isAllowedAuthReturnTo } from "@shared/navigation";
import { socialProviders, socialProviderLabels, type AuthProviders, type SocialProvider } from "@shared/social-auth";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { FaGoogle, FaFacebook, FaApple, FaMicrosoft } from "react-icons/fa6";
import InvitationRecovery from "@/components/invitation-recovery";
import { useAuth } from "@/hooks/useAuth";
import { useFormLocale } from "@/components/forms-locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const providerIcons = { google: FaGoogle, facebook: FaFacebook, apple: FaApple, microsoft: FaMicrosoft };
function callbackError(code: string | null) {
  switch (code) {
    case null: return "";
    case "invitation_session_expired": return "invitationExpired";
    case "google_disabled": case "social_disabled": return "providerUnavailable";
    case "social_cancelled": return "socialCancelled";
    case "social_session_expired": return "sessionExpired";
    default: return "signInFailed";
  }
}
export default function Login() {
  const { t, i18n, language } = useFormLocale();
  const { isAuthenticated } = useAuth();
  const [signup, setSignup] = useState(false), [busy, setBusy] = useState(false);
  const locked = useRef(false), heading = useRef<HTMLHeadingElement>(null), errorRef = useRef<HTMLParagraphElement>(null);
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [firstName, setFirstName] = useState(""), [lastName, setLastName] = useState("");
  const [accountType, setAccountType] = useState("personal"), [companyName, setCompanyName] = useState(""), [companyNameError, setCompanyNameError] = useState("");
  const requestedReturn = new URLSearchParams(window.location.search).get("returnTo");
  const returnTo = isAllowedAuthReturnTo(requestedReturn) ? requestedReturn : "/";
  const [message, setMessage] = useState(new URLSearchParams(window.location.search).get("passwordUpdated") === "1" ? "passwordUpdated" : "");
  const [error, setError] = useState(() => callbackError(new URLSearchParams(window.location.search).get("error")));
  const providers = useQuery<AuthProviders>({ queryKey: ["/api/auth/providers"], staleTime: 60_000, retry: false });
  const enabled = socialProviders.filter(provider => providers.data?.[provider]);
  // Use the configured language list. Native names keep the choice understandable
  // before the visitor can read the current interface language.
  const languages = (Array.isArray(i18n.options.supportedLngs) ? i18n.options.supportedLngs : Object.keys(i18n.services.resourceStore.data)).filter(code => code !== "cimode");
  const languageName = (code: string) => new Intl.DisplayNames([code], { type: "language" }).of(code) || code;
  if (isAuthenticated) return <Redirect to={returnTo} />;

  async function socialSignIn(provider: SocialProvider) {
    if (locked.current) return;
    setCompanyNameError("");
    if (signup && accountType === "company" && (!companyName.trim() || companyName.trim().length > 150)) {
      setCompanyNameError("companyInvalid"); requestAnimationFrame(() => document.getElementById("signup-company")?.focus()); return;
    }
    locked.current = true; setBusy(true); setError(""); setMessage("");
    try {
      if (signup && accountType === "company") {
        const response = await apiRequest("POST", `/api/auth/${provider}`, { companyName: companyName.trim(), returnTo });
        const result = await response.json();
        if (typeof result.url !== "string" || !result.url) throw new Error("Missing sign-in URL");
        window.location.assign(result.url);
      } else window.location.assign(`/api/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}`);
    } catch { locked.current = false; setBusy(false); setError("socialStartFailed"); requestAnimationFrame(() => errorRef.current?.focus()); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (locked.current) return;
    setConfirmPasswordError("");
    if (signup && (!confirmPassword || password !== confirmPassword)) {
      setError(""); setMessage(""); setConfirmPasswordError(confirmPassword ? "passwordMismatch" : "confirmRequired"); requestAnimationFrame(() => document.getElementById("confirm-password")?.focus()); return;
    }
    locked.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const response = await apiRequest("POST", signup ? "/api/auth/signup" : "/api/auth/login", { email, password, firstName, lastName, accountType, companyName, returnTo });
      const result = await response.json();
      setPassword(""); setConfirmPassword("");
      if (signup && !result.signedIn) setMessage("checkEmail");
      else { queryClient.clear(); window.location.assign(returnTo); }
    } catch (failure) {
      const raw = failure instanceof Error ? failure.message : "";
      setError(raw.startsWith("429:") ? "rateLimited" : !signup && raw.startsWith("401:") ? "invalidCredentials" : signup && raw.startsWith("400:") ? "signupFailed" : "signInFailed");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { locked.current = false; setBusy(false); }
  }

  return <main className="min-h-[100dvh] bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
    <Card className="auth-form auth-page-card w-full max-w-md">
      <CardHeader className="text-center space-y-4">
        <div><Label htmlFor="auth-language">{t("authForm.language")}</Label><select id="auth-language" value={language} onChange={event => void i18n.changeLanguage(event.target.value)}>{languages.map(code => <option key={code} value={code} lang={code}>{languageName(code)}</option>)}</select></div>
        <Heart aria-hidden="true" className="w-10 h-10 text-primary mx-auto" />
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold">{t(signup ? "authForm.createTitle" : "authForm.welcome")}</h1>
        <p className="text-sm text-muted-foreground">FitsMyTime</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={submit} className="space-y-6" aria-label={t(signup ? "authForm.createTitle" : "authForm.signIn")}>
          {signup && (returnTo === "/" || returnTo === "/search" || accountType === "company") && <fieldset disabled={busy} className="space-y-4 min-w-0">
            <legend className="text-lg font-semibold mb-4">{t("authForm.accountSetup")}</legend>
            {(returnTo === "/" || returnTo === "/search") && <div><Label htmlFor="signup-type">{t("authForm.accountType")}</Label><select id="signup-type" value={accountType} disabled={busy} onChange={event => { setAccountType(event.target.value); setCompanyNameError(""); }}><option value="personal">{t("authForm.personal")}</option><option value="company">{t("authForm.company")}</option></select></div>}
            {accountType === "company" && <div><Label htmlFor="signup-company">{t("authForm.companyName")}</Label><Input id="signup-company" required maxLength={150} value={companyName} disabled={busy} aria-invalid={Boolean(companyNameError)} aria-describedby={companyNameError ? "signup-company-error" : undefined} onChange={event => { setCompanyName(event.target.value); setCompanyNameError(""); }} />{companyNameError && <p id="signup-company-error" role="alert" className="text-sm text-destructive mt-1">{t(`authForm.${companyNameError}`)}</p>}</div>}
          </fieldset>}
          {(providers.isPending || providers.isError || enabled.length > 0) && <section aria-labelledby="auth-options-heading" className="space-y-3">
            <h2 id="auth-options-heading" className="text-lg font-semibold">{t("authForm.options")}</h2>
            {providers.isPending && <p role="status" className="text-sm text-muted-foreground">{t("authForm.loadingOptions")}</p>}
            {enabled.map(provider => { const Icon = providerIcons[provider]; return <Button key={provider} type="button" className="w-full" variant="outline" disabled={busy} onClick={() => socialSignIn(provider)}><Icon aria-hidden="true" />{t("authForm.continueWith", { provider: socialProviderLabels[provider] })}</Button>; })}
            {providers.isError && <div className="text-sm space-y-2"><p role="status">{t("authForm.optionsFailed")}</p><Button type="button" variant="outline" disabled={busy || providers.isFetching} onClick={() => void providers.refetch()}>{t("authForm.retryOptions")}</Button></div>}
          </section>}
          {signup && <fieldset disabled={busy} className="space-y-4 min-w-0 border-t pt-5"><legend className="font-semibold px-2">{t("authForm.profile")}</legend><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label htmlFor="first-name">{t("authForm.firstName")}</Label><Input id="first-name" autoComplete="given-name" maxLength={100} value={firstName} onChange={event => setFirstName(event.target.value)} /></div>
            <div><Label htmlFor="last-name">{t("authForm.lastName")}</Label><Input id="last-name" autoComplete="family-name" maxLength={100} value={lastName} onChange={event => setLastName(event.target.value)} /></div>
          </div></fieldset>}
          <fieldset disabled={busy} className="space-y-4 min-w-0 border-t pt-5"><legend className="font-semibold px-2">{t("authForm.emailSignIn")}</legend>
            <div><Label htmlFor="email">{t("authForm.email")}</Label><Input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></div>
            <div><Label htmlFor="password">{t("authForm.password")}</Label><Input id="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={8} maxLength={128} aria-describedby={signup ? "auth-password-help" : undefined} value={password} onChange={event => { setPassword(event.target.value); setConfirmPasswordError(""); }} />{signup && <p id="auth-password-help" className="text-sm text-muted-foreground mt-1">{t("authForm.passwordHelp")}</p>}</div>
            {signup && <div><Label htmlFor="confirm-password">{t("authForm.confirmPassword")}</Label><Input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} aria-invalid={Boolean(confirmPasswordError)} aria-describedby={confirmPasswordError ? "confirm-password-error" : undefined} onChange={event => { setConfirmPassword(event.target.value); setConfirmPasswordError(""); }} />{confirmPasswordError && <p id="confirm-password-error" role="alert" className="text-sm text-destructive mt-1">{t(`authForm.${confirmPasswordError}`)}</p>}</div>}
          </fieldset>
          {error && <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">{t(`authForm.${error}`)}</p>}
          {message && <p role="status" className="text-sm">{t(`authForm.${message}`)}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{t(busy ? "authForm.wait" : signup ? "authForm.createAccount" : "authForm.signIn")}</Button>
        </form>
        {/^\/invite(?:\?|$)/.test(returnTo) && <InvitationRecovery returnTo={returnTo} />}
        <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => { setSignup(!signup); setMessage(""); setError(""); setPassword(""); setConfirmPassword(""); setConfirmPasswordError(""); setCompanyNameError(""); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); }}>{t(signup ? "authForm.switchSignIn" : "authForm.switchSignup")}</Button>
        <Link href="/" className="block text-center text-sm">{t("authForm.back")}</Link>
        <a href="/privacy-policy.html" className="block text-center text-sm underline underline-offset-4">{t("legal.privacyPolicy")}</a>
      </CardContent>
    </Card>
  </main>;
}
