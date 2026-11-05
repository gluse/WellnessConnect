import { Link, useLocation } from "wouter";
import { Heart, Search, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AccountMenu from "@/components/account-menu";
import { LanguagePicker } from "@/components/language-picker";
import RoleSwitcher from "@/components/role-switcher";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { InboxControls } from "@/components/inbox";

export default function AppHeader() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();
  const [location] = useLocation();
  const appointmentArea = location === "/my-bookings" || location === "/my-services" || location.startsWith("/my-services/") || location === "/wishlist" || location === "/inbox";
  const searchArea = location === "/search" || (location === "/" && isAuthenticated);

  return (
    <header className={`app-header ${searchArea ? "search-app-header" : ""} sticky top-0 z-40 bg-header text-white border-b border-white/15 pt-[env(safe-area-inset-top)] [--accent:#343c53] [--accent-foreground:#fff] [--ring:#fff] [--background:var(--header-background)] ${appointmentArea || searchArea ? "[@media(max-height:30rem)]:static" : ""}`}>
      <div className="app-header-row max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" aria-label="FitsMyTime" className="app-header-brand flex min-w-0 items-center rounded-md font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="app-header-logo shrink-0 bg-primary rounded-lg flex items-center justify-center">
            <Heart className="text-white" aria-hidden="true" />
          </span>
          <span className="truncate">FitsMyTime</span>
        </Link>
        {isAuthenticated && <div className="hidden lg:block">
          <RoleSwitcher />
        </div>}
        <div className="app-header-actions flex shrink-0 items-center">
          {isAuthenticated && <InboxControls />}
          <LanguagePicker />
          {!isAuthenticated && <Button asChild variant="ghost" size="sm" className={`header-icon-button ${searchArea ? "hidden lg:inline-flex" : ""}`}><Link href="/search"><Search className="lg:hidden" aria-hidden="true" /><span className="sr-only lg:not-sr-only">{t("guestSearch.browse")}</span></Link></Button>}
          {!isAuthenticated && !isLoading && <Button asChild size="sm" className="header-icon-button"><Link href="/login?returnTo=%2Fsearch"><UserRound className="lg:hidden" aria-hidden="true" /><span className="sr-only lg:not-sr-only">{t("nav.login")}</span></Link></Button>}
          {isAuthenticated && <AccountMenu />}
        </div>
      </div>
    </header>
  );
}
