import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";

export default function RoleSwitcher() {
  const [location] = useLocation();
  const inMyServices = location === "/my-services" || location.startsWith("/my-services/");
  return (
    <nav aria-label="Services" className="bg-neutral-100 p-1 rounded-lg flex">
      <Button
        asChild
        variant={location === "/" ? "default" : "ghost"}
        size="sm"
        className="flex-1 sm:flex-none px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium"
      >
        <Link href="/" aria-current={location === "/" ? "page" : undefined}>Find Services</Link>
      </Button>
      <Button
        asChild
        variant={location === "/my-bookings" ? "default" : "ghost"}
        size="sm"
        className="flex-1 sm:flex-none px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium"
      >
        <Link href="/my-bookings" aria-current={location === "/my-bookings" ? "page" : undefined}>My Bookings</Link>
      </Button>
      <Button
        asChild
        variant={inMyServices ? "default" : "ghost"}
        size="sm"
        className="flex-1 sm:flex-none px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium"
      >
        <Link href="/my-services" aria-current={inMyServices ? "page" : undefined}>My Services</Link>
      </Button>
    </nav>
  );
}
