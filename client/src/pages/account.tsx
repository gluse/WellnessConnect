import { useRef, useState, type FormEvent } from "react";
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
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useFormLocale } from "@/components/forms-locale";
import AccountPasswordForm from "@/components/account-password-form";
import AccountAddresses from "@/components/account-addresses";

function AccountDetailsForm({ user }: { user: User }) {
  const { t } = useFormLocale();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [invalid, setInvalid] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const { data: context } = useQuery<WorkspaceContext>({ queryKey: ["/api/company/context"], retry: false });
  const companyNames = context?.company ? [context.company.name] : context?.workspaces.map(workspace => workspace.name) || [];
  const mutation = useMutation({
    mutationFn: async (names: { firstName: string; lastName: string }): Promise<User> => (await apiRequest("PATCH", "/api/auth/user", names)).json(),
    onSuccess: updated => {
      queryClient.setQueryData(["/api/auth/user"], updated); void queryClient.invalidateQueries();
      setFirstName(updated.firstName || ""); setLastName(updated.lastName || ""); setSaved(true);
    },
    onError: error => {
      if (isUnauthorizedError(error)) { queryClient.setQueryData(["/api/auth/user"], null); return; }
      setError("accountForm.saveError");
    },
    onSettled: () => { submitting.current = false; },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setError(""); setSaved(false);
    const parsed = accountDetailsSchema.safeParse({ firstName, lastName });
    if (!parsed.success) {
      setInvalid(parsed.error.issues.map(issue => String(issue.path[0])));
      queueMicrotask(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return;
    }
    setInvalid([]); submitting.current = true; mutation.mutate(parsed.data);
  }
  return <Card id="personal" className="scroll-mt-6" aria-labelledby="account-personal-title">
    <CardHeader><h2 className="text-lg font-semibold" id="account-personal-title">{t("accountForm.personal")}</h2><CardDescription>{t("accountForm.personalHelp")}</CardDescription></CardHeader>
    <CardContent><form ref={form} id="account-details-form" onSubmit={submit} className="space-y-6" noValidate aria-busy={mutation.isPending}>
      <div className="grid gap-4 sm:grid-cols-2">
        {[{ field: "firstName", id: "account-name", value: firstName, set: setFirstName, auto: "given-name", label: "accountForm.firstName" }, { field: "lastName", id: "account-surname", value: lastName, set: setLastName, auto: "family-name", label: "accountForm.lastName" }].map(item => <div key={item.field} className="space-y-2">
          <Label htmlFor={item.id}>{t(item.label)}</Label>
          <Input id={item.id} autoComplete={item.auto} dir="auto" maxLength={100} value={item.value} disabled={mutation.isPending}
            aria-invalid={invalid.includes(item.field) || undefined} aria-describedby={invalid.includes(item.field) ? item.id + "-error" : undefined}
            onChange={event => { item.set(event.target.value); setSaved(false); setError(""); setInvalid(previous => previous.filter(field => field !== item.field)); }} />
          {invalid.includes(item.field) && <p id={item.id + "-error"} role="alert" className="text-sm text-red-700 dark:text-red-300">{t("accountForm.nameLimit")}</p>}
        </div>)}
      </div>
      <dl className="space-y-4 text-sm break-words bg-muted rounded-lg p-4">
        <div><dt className="font-medium">{t("accountForm.email")}</dt><dd className="mt-1 text-muted-foreground"><bdi>{user.email || t("accountForm.notProvided")}</bdi></dd></div>
        {companyNames.length > 0 && <div><dt className="font-medium">{t("accountForm.companies")}</dt>{companyNames.map((name, index) => <dd key={index} className="mt-1 text-muted-foreground"><bdi>{name}</bdi></dd>)}</div>}
      </dl>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t(error)}</p>}
      {saved && <p role="status" className="text-sm">{t("accountForm.saved")}</p>}
      <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">{mutation.isPending && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none shrink-0" aria-hidden="true" />}{t(mutation.isPending ? "accountForm.saving" : "accountForm.save")}</Button>
    </form></CardContent>
  </Card>;
}
export default function Account() {
  const { user, isLoading } = useAuth();
  const { t, i18n } = useFormLocale();
  if (isLoading) return <main className="min-h-screen flex items-center justify-center" role="status">{t("accountForm.loading")}</main>;
  if (!user) return <Redirect to="/login?returnTo=%2Faccount" />;
  return <div className="phase2-form min-h-screen bg-background text-foreground" dir={i18n.dir()}>
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Button variant="ghost" asChild><Link href="/"><ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />{t("accountForm.back")}</Link></Button>
      <div><h1 className="text-2xl font-semibold">{t("accountForm.title")}</h1><p className="mt-2 text-muted-foreground">{t("accountForm.intro")}</p></div>
      <nav aria-label={t("accountForm.sections")} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <a className="underline py-3" href="#personal">{t("accountForm.personal")}</a><a className="underline py-3" href="#addresses">{t("addressForm.title")}</a><a className="underline py-3" href="#password">{t("passwordForm.title")}</a>
      </nav>
      <AccountDetailsForm key={user.id} user={user} />
      <AccountAddresses key={`addresses-${user.id}`} />
      <AccountPasswordForm key={`password-${user.id}`} />
    </main>
  </div>;
}
