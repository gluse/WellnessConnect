import { Link } from "wouter";
import { Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AccountMenu from "@/components/account-menu";
import { LanguagePicker } from "@/components/language-picker";
import RoleSwitcher from "@/components/role-switcher";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function AppHeader() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 font-semibold text-lg text-neutral-800">
          <span className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Heart className="w-4 h-4 text-white" aria-hidden="true" />
          </span>
          FitsMyTime
        </Link>
        {isAuthenticated && <div className="w-full sm:w-auto sm:order-none order-last">
          <RoleSwitcher />
        </div>}
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <LanguagePicker />
          {!isAuthenticated && <Button asChild variant="ghost" size="sm"><Link href="/search">{t("guestSearch.browse")}</Link></Button>}
          {!isAuthenticated && !isLoading && <Button asChild size="sm"><Link href="/login?returnTo=%2Fsearch">{t("nav.login")}</Link></Button>}
          {isAuthenticated && <AccountMenu />}
        </div>
      </div>
    </header>
  );
}
