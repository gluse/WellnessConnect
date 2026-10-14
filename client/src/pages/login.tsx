import { useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import InvitationRecovery from "@/components/invitation-recovery";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountType, setAccountType] = useState("personal");
  const [companyName, setCompanyName] = useState("");
  const requestedReturn = new URLSearchParams(window.location.search).get("returnTo");
  const returnTo = requestedReturn && (requestedReturn === "/account" || /^\/invite(?:\?|$)/.test(requestedReturn)) ? requestedReturn : "/";
  const [message, setMessage] = useState("");
  const loginError = new URLSearchParams(window.location.search).get("error");
  const [error, setError] = useState(loginError === "invitation_session_expired" ? "Your invitation sign-in expired. Request a fresh sign-in email below, or sign in if you already have a password." : loginError ? "Sign-in could not be completed. Please try again." : "");
  const { data: providers } = useQuery<{ google: boolean }>({ queryKey: ["/api/auth/providers"] });
  if (isAuthenticated) return <Redirect to={returnTo} />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await apiRequest("POST", signup ? "/api/auth/signup" : "/api/auth/login", { email, password, firstName, lastName, accountType, companyName, returnTo });
      const result = await response.json();
      setPassword("");
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
          <p className="text-sm text-neutral-500">WellnessFind</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers?.google && <Button className="w-full" variant="outline" disabled={busy} onClick={() => window.location.assign("/api/auth/google")}>Continue with Google</Button>}
          <form onSubmit={submit} className="space-y-4">
            {signup && returnTo === "/" && <div>
              <Label htmlFor="signup-type">Account type</Label>
              <select id="signup-type" className="w-full border rounded-md p-2 bg-white" value={accountType} onChange={event => setAccountType(event.target.value)}>
                <option value="personal">Personal account</option><option value="company">Create a company</option>
              </select>
            </div>}
            {signup && accountType === "company" && <div><Label htmlFor="signup-company">Company name *</Label><Input id="signup-company" required maxLength={150} value={companyName} onChange={event => setCompanyName(event.target.value)} /></div>}
            {signup && <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="first-name">First name (optional)</Label><Input id="first-name" autoComplete="given-name" maxLength={100} value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
              <div><Label htmlFor="last-name">Last name (optional)</Label><Input id="last-name" autoComplete="family-name" maxLength={100} value={lastName} onChange={e => setLastName(e.target.value)} /></div>
            </div>}
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />{signup && <p className="text-xs text-neutral-500 mt-1">Use at least 8 characters, including uppercase, lowercase, and a number.</p>}</div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            {message && <p role="status" className="text-sm text-green-700">{message}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</Button>
          </form>
          {returnTo !== "/" && <InvitationRecovery returnTo={returnTo} />}
          <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => { setSignup(!signup); setMessage(""); setError(""); setPassword(""); }}>{signup ? "Already have an account? Sign in" : "New here? Create an account"}</Button>
          <Link href="/" className="block text-center text-sm text-neutral-500 hover:text-primary">Back to WellnessFind</Link>
        </CardContent>
      </Card>
    </main>
  );
}
