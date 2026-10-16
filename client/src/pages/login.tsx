import { useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import { isAllowedAuthReturnTo } from "@shared/navigation";
import { socialProviders, socialProviderLabels, signInErrorMessage, type AuthProviders, type SocialProvider } from "@shared/social-auth";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { FaGoogle, FaFacebook, FaApple, FaMicrosoft } from "react-icons/fa6";
import InvitationRecovery from "@/components/invitation-recovery";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const providerIcons = { google: FaGoogle, facebook: FaFacebook, apple: FaApple, microsoft: FaMicrosoft };

export default function Login() {
  const { isAuthenticated } = useAuth();
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountType, setAccountType] = useState("personal");
  const [companyName, setCompanyName] = useState("");
  const [companyNameError, setCompanyNameError] = useState("");
  const requestedReturn = new URLSearchParams(window.location.search).get("returnTo");
  const returnTo = isAllowedAuthReturnTo(requestedReturn) ? requestedReturn : "/";
  const [message, setMessage] = useState(new URLSearchParams(window.location.search).get("passwordUpdated") === "1" ? "Password updated. Sign in with your new password." : "");
  const loginError = new URLSearchParams(window.location.search).get("error");
  const [error, setError] = useState(signInErrorMessage(loginError));
  const providers = useQuery<AuthProviders>({ queryKey: ["/api/auth/providers"], staleTime: 60_000, retry: false });
  if (isAuthenticated) return <Redirect to={returnTo} />;

  async function socialSignIn(provider: SocialProvider) {
    if (busy) return;
    setCompanyNameError("");
    if (signup && accountType === "company" && (!companyName.trim() || companyName.trim().length > 150)) {
      setCompanyNameError("Enter a company name of 1 to 150 characters."); return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      if (signup && accountType === "company") {
        const response = await apiRequest("POST", `/api/auth/${provider}`, { companyName: companyName.trim(), returnTo });
        const result = await response.json();
        if (typeof result.url !== "string" || !result.url) throw new Error("Missing sign-in URL");
        window.location.assign(result.url);
      } else window.location.assign(`/api/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}`);
    } catch { setBusy(false); setError("Unable to start sign-in. Please try again."); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setConfirmPasswordError("");
    if (signup && (!confirmPassword || password !== confirmPassword)) {
      setError(""); setMessage("");
      setConfirmPasswordError(confirmPassword ? "Passwords do not match." : "Confirm your password.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await apiRequest("POST", signup ? "/api/auth/signup" : "/api/auth/login", { email, password, firstName, lastName, accountType, companyName, returnTo });
      const result = await response.json();
      setPassword("");
      setConfirmPassword("");
      if (signup && !result.signedIn) setMessage(result.message);
      else { queryClient.clear(); window.location.assign(returnTo); }
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unable to sign in";
      try { setError(JSON.parse(raw.slice(raw.indexOf(":") + 1)).message || "Unable to sign in"); }
      catch { setError("Unable to sign in. Please try again."); }
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Heart className="w-10 h-10 text-primary mx-auto mb-2" />
          <CardTitle>{signup ? "Create your account" : "Welcome back"}</CardTitle>
          <p className="text-sm text-neutral-500">FitsMyTime</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submit} className="space-y-4">
            {signup && (returnTo === "/" || returnTo === "/search") && <div>
              <Label htmlFor="signup-type">Account type</Label>
              <select id="signup-type" className="w-full border rounded-md p-2 bg-white" value={accountType} disabled={busy} onChange={event => { setAccountType(event.target.value); setCompanyNameError(""); }}>
                <option value="personal">Personal account</option><option value="company">Create a company</option>
              </select>
            </div>}
            {signup && accountType === "company" && <div>
              <Label htmlFor="signup-company">Company name *</Label>
              <Input id="signup-company" required maxLength={150} value={companyName} disabled={busy} aria-invalid={Boolean(companyNameError)} aria-describedby={companyNameError ? "signup-company-error" : undefined} onChange={event => { setCompanyName(event.target.value); setCompanyNameError(""); }} />
              {companyNameError && <p id="signup-company-error" role="alert" className="text-sm text-red-600 mt-1">{companyNameError}</p>}
            </div>}
            {socialProviders.filter(provider => providers.data?.[provider]).map(provider => {
              const Icon = providerIcons[provider];
              return <Button key={provider} type="button" className="w-full" variant="outline" disabled={busy} onClick={() => socialSignIn(provider)}><Icon aria-hidden="true" />{`Continue with ${socialProviderLabels[provider]}`}</Button>;
            })}
            {providers.isError && <div className="text-sm space-y-2"><p>Other sign-in options could not load. You can still sign in with email.</p><Button type="button" variant="outline" disabled={busy || providers.isFetching} onClick={() => void providers.refetch()}>Retry sign-in options</Button></div>}
            {signup && <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="first-name">First name (optional)</Label><Input id="first-name" autoComplete="given-name" maxLength={100} value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
              <div><Label htmlFor="last-name">Last name (optional)</Label><Input id="last-name" autoComplete="family-name" maxLength={100} value={lastName} onChange={e => setLastName(e.target.value)} /></div>
            </div>}
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={8} maxLength={128} value={password} onChange={e => { setPassword(e.target.value); setConfirmPasswordError(""); }} />{signup && <p className="text-xs text-neutral-500 mt-1">Use at least 8 characters, including uppercase, lowercase, and a number.</p>}</div>
            {signup && <div>
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword}
                aria-invalid={Boolean(confirmPasswordError)} aria-describedby={confirmPasswordError ? "confirm-password-error" : undefined}
                onChange={event => { setConfirmPassword(event.target.value); setConfirmPasswordError(""); }} />
              {confirmPasswordError && <p id="confirm-password-error" role="alert" className="text-sm text-red-600 mt-1">{confirmPasswordError}</p>}
            </div>}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            {message && <p role="status" className="text-sm text-green-700">{message}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</Button>
          </form>
          {/^\/invite(?:\?|$)/.test(returnTo) && <InvitationRecovery returnTo={returnTo} />}
          <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => { setSignup(!signup); setMessage(""); setError(""); setPassword(""); setConfirmPassword(""); setConfirmPasswordError(""); setCompanyNameError(""); }}>{signup ? "Already have an account? Sign in" : "New here? Create an account"}</Button>
          <Link href="/" className="block text-center text-sm text-neutral-500 hover:text-primary">Back to FitsMyTime</Link>
        </CardContent>
      </Card>
    </main>
  );
}
