import { useLocation } from "wouter";
import { Home, Users, Mic, User, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/communities", icon: Users, label: "Communities" },
  { href: "/chat", icon: Mic, label: "Ask Yukti", center: true },
  { href: "/providers", icon: Stethoscope, label: "Doctors" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const [location, navigate] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/60 safe-area-pb md:hidden">
      <div className="flex items-center justify-around px-1 py-1">
        {navItems.map((item) => {
          const active = item.href === "/"
            ? location === "/"
            : location.startsWith(item.href);
          if (item.center) {
            return (
              <div key={item.href} className="flex flex-col items-center flex-1">
                <button
                  onClick={() => navigate(item.href)}
                  aria-label={item.label}
                  className={cn(
                    "flex items-center justify-center -mt-5 w-14 h-14 rounded-full shadow-lg active:scale-95 transition-transform",
                    active
                      ? "bg-primary text-primary-foreground shadow-primary/40"
                      : "bg-primary text-primary-foreground shadow-primary/30"
                  )}
                  data-testid={`bottom-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="w-6 h-6" />
                </button>
                <span
                  className={cn(
                    "text-[10px] font-semibold mt-0.5",
                    active ? "text-primary" : "text-primary/80"
                  )}
                >
                  {item.label}
                </span>
              </div>
            );
          }
          return (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={active}
              navigate={navigate}
            />
          );
        })}
      </div>
    </nav>
  );
}

function NavItem({ href, icon: Icon, label, active, navigate }: { href: string; icon: any; label: string; active: boolean; navigate: (path: string) => void }) {
  return (
    <button
      onClick={() => navigate(href)}
      data-testid={`bottom-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2 px-3 flex-1 transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className={cn("w-5 h-5 transition-transform", active && "scale-110")} />
      <span className={cn("text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground/70")}>{label}</span>
    </button>
  );
}
