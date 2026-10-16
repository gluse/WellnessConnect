import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, Calendar, User } from "lucide-react";

export default function BottomNavigation() {
  const [location] = useLocation();
  const isActive = (href: string) => location === href || (href === "/" && location === "/search");

  const tabs = [
    { href: "/", label: "Home", icon: Home },
    { href: "/my-bookings", label: "My Bookings", icon: Calendar },
    { href: "/account", label: "Profile", icon: User },
  ];

  return (
    <nav aria-label="Customer navigation" className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] max-w-md mx-auto">
      <div className="flex justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.href}
              asChild
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center py-2 px-3 relative ${
                isActive(tab.href) ? "text-primary" : "text-neutral-400"
              }`}
            >
              <Link href={tab.href} aria-current={isActive(tab.href) ? "page" : undefined}>
                <Icon className="w-5 h-5 mb-1" aria-hidden="true" />
                <span className="text-xs font-medium">{tab.label}</span>
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
