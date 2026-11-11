import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LogOut, UserRound, Shield, Heart } from "lucide-react";
import type { WorkspaceContext } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useAppAdmin } from "@/hooks/use-app-admin";
import { useAuditAccess } from "@/hooks/use-audit-access";
import { useToast } from "@/hooks/use-toast";
import { logout } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AccountMenu() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: adminAccess } = useAppAdmin();
  const { data: auditAccess } = useAuditAccess();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const { data: context } = useQuery<WorkspaceContext>({
    queryKey: ["/api/company/context"], enabled: Boolean(user), retry: false,
  });
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  // OAuth photos are optional untrusted metadata. Only load secure image URLs.
  const avatarUrl = secureAvatarUrl(user?.profileImageUrl);
  const companyNames = context?.company ? [context.company.name] : context?.workspaces.map(workspace => workspace.name) || [];

  async function signOut() {
    setSigningOut(true);
    try { await logout(); }
    catch { toast({ title: "Unable to sign out", variant: "destructive" }); }
    finally { setSigningOut(false); }
  }

  return <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="header-icon-button h-11 w-11 p-0" aria-label={t("frontendFollowup.accountMenu")} disabled={!user || signingOut}>
          <Avatar key={`${user?.id}:${avatarUrl}`} className="h-8 w-8" aria-hidden="true">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" className="object-cover" />}
            <AvatarFallback className="bg-white/15 text-white"><UserRound className="h-5 w-5" /></AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="space-y-1 break-words">
          <p>{fullName || "My account"}</p>
          <p className="text-sm font-normal text-neutral-600">{user?.email}</p>
          {companyNames.map((name, index) => <p key={index} className="text-sm font-normal text-neutral-600">{name}</p>)}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account"><UserRound aria-hidden="true" /> Account details</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-11 whitespace-normal break-words">
          <Link href="/wishlist"><Heart aria-hidden="true" />{t("wishlist.title")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-11 whitespace-normal break-words">
          <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer"><Shield aria-hidden="true" />{t("legal.privacyPolicyNewTab")}</a>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={signingOut} onSelect={() => void signOut()}>
          <LogOut aria-hidden="true" /> Sign Out
        </DropdownMenuItem>
        {adminAccess?.isAdmin && <DropdownMenuItem asChild>
          <Link href="/administration"><Shield aria-hidden="true" /> Administration</Link>
        </DropdownMenuItem>}
        {auditAccess?.canRead && <DropdownMenuItem asChild>
          <Link href="/administration?section=audit"><Shield aria-hidden="true" />{t("audit.title")}</Link>
        </DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>;
}

function secureAvatarUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}
