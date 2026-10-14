import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LogOut, UserRound } from "lucide-react";
import type { WorkspaceContext } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { logout } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AccountMenu() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const { data: context } = useQuery<WorkspaceContext>({
    queryKey: ["/api/company/context"], enabled: Boolean(user), retry: false,
  });
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const companyNames = context?.company ? [context.company.name] : context?.workspaces.map(workspace => workspace.name) || [];

  async function signOut() {
    setSigningOut(true);
    try { await logout(); }
    catch { toast({ title: "Unable to sign out", variant: "destructive" }); }
    finally { setSigningOut(false); }
  }

  return <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="w-8 h-8 p-0" aria-label="Open account menu" disabled={!user || signingOut}>
          <span className="w-6 h-6 bg-neutral-200 rounded-full flex items-center justify-center">
            <UserRound className="w-4 h-4" aria-hidden="true" />
          </span>
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
        <DropdownMenuItem disabled={signingOut} onSelect={() => void signOut()}>
          <LogOut aria-hidden="true" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>;
}
