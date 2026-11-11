import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

export default function RoleSwitcher() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [location] = useLocation();
  const inMyServices = location === "/my-services" || location.startsWith("/my-services/");
  const inSearch = location === "/" || location === "/search";
  return (
    <nav aria-label={t("mobileNavigation.navigation")} className="bg-white/10 p-1 rounded-lg flex flex-wrap">
      <Button
        asChild
        variant={inSearch ? "default" : "ghost"}
        size="sm"
        className="flex-1 sm:flex-none px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium"
      >
        <Link href="/" aria-current={inSearch ? "page" : undefined}>{t("searchPage.navSearch")}</Link>
      </Button>
      <Button
        asChild
        variant={location === "/my-bookings" ? "default" : "ghost"}
        size="sm"
        className="flex-1 sm:flex-none px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium"
      >
        <Link href="/my-bookings" aria-current={location === "/my-bookings" ? "page" : undefined}>{t("booking.myBookings")}</Link>
      </Button>
      {user?.currentRole === "provider" && <Button
        asChild
        variant={inMyServices ? "default" : "ghost"}
        size="sm"
        className="flex-1 sm:flex-none px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium"
      >
        <Link href="/my-services" aria-current={inMyServices ? "page" : undefined}>{t("provider.myServices")}</Link>
      </Button>}
    </nav>
  );
}
