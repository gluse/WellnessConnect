import { useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { accountDetailsSchema, type User, type WorkspaceContext } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AccountPasswordForm from "@/components/account-password-form";

function AccountDetailsForm({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const { data: context } = useQuery<WorkspaceContext>({
    queryKey: ["/api/company/context"], retry: false,
  });
  const companyNames = context?.company ? [context.company.name] : context?.workspaces.map(workspace => workspace.name) || [];
  const mutation = useMutation({
    mutationFn: async (names: { firstName: string; lastName: string }): Promise<User> => {
      const response = await apiRequest("PATCH", "/api/auth/user", names);
      return response.json();
    },
    onSuccess: updated => {
      queryClient.setQueryData(["/api/auth/user"], updated);
      void queryClient.invalidateQueries();
      setFirstName(updated.firstName || "");
      setLastName(updated.lastName || "");
      setSaved(true);
    },
    onError: error => {
      if (isUnauthorizedError(error)) {
        queryClient.setQueryData(["/api/auth/user"], null);
        return;
      }
      setError("Unable to save account details. Please try again.");
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (mutation.isPending) return;
    setError("");
    setSaved(false);
    const parsed = accountDetailsSchema.safeParse({ firstName, lastName });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    mutation.mutate(parsed.data);
  }

  return <Card>
    <CardHeader>
      <CardTitle>Personal information</CardTitle>
      <CardDescription>Update the name and surname on your account.</CardDescription>
    </CardHeader>
    <CardContent>
      <form id="account-details-form" onSubmit={submit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="account-name">Name</Label>
            <Input id="account-name" autoComplete="given-name" maxLength={100} value={firstName} disabled={mutation.isPending}
              onChange={event => { setFirstName(event.target.value); setSaved(false); setError(""); }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-surname">Surname</Label>
            <Input id="account-surname" autoComplete="family-name" maxLength={100} value={lastName} disabled={mutation.isPending}
              onChange={event => { setLastName(event.target.value); setSaved(false); setError(""); }} />
          </div>
        </div>
        <dl className="space-y-4 text-sm break-words">
          <div><dt className="font-medium">Email address</dt><dd className="mt-1 text-neutral-600">{user.email || "Not provided"}</dd></div>
          {companyNames.length > 0 && <div><dt className="font-medium">{companyNames.length > 1 ? "Companies" : "Company name"}</dt>{companyNames.map((name, index) => <dd key={index} className="mt-1 text-neutral-600">{name}</dd>)}</div>}
        </dl>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {saved && <p role="status" className="text-sm text-green-700">Account details saved.</p>}
        <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </CardContent>
  </Card>;
}

export default function Account() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <main className="min-h-screen flex items-center justify-center" role="status">Loading account details…</main>;
  if (!user) return <Redirect to="/login?returnTo=%2Faccount" />;

  return <div className="min-h-screen bg-neutral-50">
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Button variant="ghost" asChild className="-ml-3"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Back to dashboard</Link></Button>
      <div><h1 className="text-2xl font-semibold">Account details</h1><p className="mt-2 text-neutral-600">Manage your personal information and password.</p></div>
      <AccountDetailsForm key={user.id} user={user} />
      <AccountPasswordForm key={`password-${user.id}`} />
    </main>
  </div>;
}
