import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export default function AccountRole({ user }: { user: User }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const alive = useRef(true), locked = useRef(false);
  const request = useRef<AbortController | null>(null);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  const mutation = useMutation({
    mutationFn: async (): Promise<User> => {
      request.current = new AbortController();
      return (await apiRequest("PATCH", "/api/users/role", { role: "provider" }, request.current.signal)).json();
    },
    onSuccess: updated => {
      if (!alive.current || client.getQueryData<User>(["/api/auth/user"])?.id !== user.id) return;
      client.setQueryData(["/api/auth/user"], updated);
      void client.invalidateQueries({ queryKey: ["/api/company/context"] });
      setSaved(true);
    },
    onError: failure => {
      if (!alive.current) return;
      if (isUnauthorizedError(failure)) client.setQueryData(["/api/auth/user"], null);
      else setError(true);
    },
    onSettled: () => { locked.current = false; request.current = null; },
  });
  const provider = user.currentRole === "provider";
  return <Card aria-labelledby="account-role-title">
    <CardHeader><h2 id="account-role-title" className="text-lg font-semibold">{t("accountRole.title")}</h2><CardDescription>{t("accountRole.help")}</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="space-y-2"><Label htmlFor="account-role">{t("accountRole.current")}</Label><Input id="account-role" readOnly value={t(provider ? "accountRole.provider" : "accountRole.buyer")} className="bg-muted" /></div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t("accountRole.error")}</p>}
      {saved && <p role="status" className="text-sm">{t("accountRole.activated")}</p>}
      {provider ? <Button asChild className="min-h-11 h-auto whitespace-normal"><Link href="/my-services">{t("accountRole.manage")}</Link></Button> : <Button disabled={mutation.isPending} className="min-h-11 h-auto whitespace-normal" onClick={() => {
        if (locked.current) return;
        locked.current = true; setError(false); mutation.mutate();
      }}>{t(mutation.isPending ? "accountRole.activating" : "accountRole.become")}</Button>}
    </CardContent>
  </Card>;
}
