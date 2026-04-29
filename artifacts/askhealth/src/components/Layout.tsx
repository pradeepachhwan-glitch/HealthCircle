import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetCurrentUser, useGetMyCreditsSummary } from "@workspace/api-client-react";
import { useClerk, useAuth } from "@workspace/replit-auth-web";
import { MessageCircle, Users, Search, User, Shield, LogOut, Menu, CalendarDays, Stethoscope, HelpCircle, Info, Video, BadgeCheck } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import HealthCircleLogo from "@/components/HealthCircleLogo";

export function UserAvatar({ name, url, className = "" }: { name: string, url?: string | null, className?: string }) {
  if (url) {
    return <img src={url} alt={name} className={`rounded-full object-cover ${className}`} />;
  }
  const initials = name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  return (
    <div className={`rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold ${className}`}>
      {initials || "?"}
    </div>
  );
}

function SidebarContent() {
  const [location] = useLocation();
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const authReady = clerkLoaded && isSignedIn;
  const { data: user } = useGetCurrentUser({ query: { enabled: authReady } });
  const { data: credits } = useGetMyCreditsSummary({ query: { enabled: !!user } });
  const { signOut } = useClerk();

  const navItems = [
    { href: "/communities", icon: Users, label: "Communities" },
    { href: "/chat", icon: MessageCircle, label: "Ask Yukti AI" },
    { href: "/teleconsult", icon: Video, label: "Tele-Consult" },
    { href: "/providers", icon: Stethoscope, label: "Find Doctors" },
    { href: "/appointments", icon: CalendarDays, label: "Appointments" },
    { href: "/search", icon: Search, label: "Search" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  if (user?.role === "medical_professional" || user?.role === "admin") {
    navItems.push({ href: "/medpro", icon: Stethoscope, label: "Med Pro Portal" });
  } else if (user?.role === "member") {
    navItems.push({ href: "/become-a-doctor", icon: BadgeCheck, label: "Become a Doctor" });
  }

  if (user?.role === "admin" || user?.role === "moderator") {
    navItems.push({ href: "/admin", icon: Shield, label: "Admin" });
  }

  const isActive = (href: string) => {
    if (href === "/communities") {
      return location === "/communities" || location.startsWith("/communities/");
    }
    return location.startsWith(href);
  };

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="mb-8">
          <HealthCircleLogo size="sm" animate={false} />
        </div>

        {/* User + Level Card */}
        {user && (
          <div className="mb-6 p-4 rounded-xl bg-sidebar-accent/50 border border-sidebar-border">
            <div className="flex items-center gap-3 mb-3">
              <UserAvatar name={user.displayName} url={user.avatarUrl} className="w-8 h-8 text-xs" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{user.displayName}</div>
                <div className="text-xs text-sidebar-accent-foreground/70 capitalize">{user.role}</div>
              </div>
            </div>
            {credits && (
              <>
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="text-sidebar-accent-foreground font-medium">Level {credits.level}</span>
                  <span className="text-sidebar-accent-foreground/70">{credits.healthCredits} HC</span>
                </div>
                <Progress value={credits.progressPercent} className="h-1.5 bg-sidebar-border" />
                <div className="text-[10px] text-sidebar-accent-foreground/60 mt-1">{credits.creditsToNextLevel} HC to next level</div>
              </>
            )}
          </div>
        )}

        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                isActive(item.href)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}>
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="text-sm">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border space-y-1">
        <div className="flex gap-1 mb-1">
          <a href="/#about" className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-xs flex-1">
            <Info className="w-3.5 h-3.5" /> About
          </a>
          <a href="/#support" className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-xs flex-1">
            <HelpCircle className="w-3.5 h-3.5" /> Support
          </a>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 fixed inset-y-0 left-0">
        <SidebarContent />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
        <Link href="/">
          <div className="flex items-center gap-2 text-sidebar-foreground cursor-pointer">
            <HealthCircleLogo size="sm" animate={false} />
          </div>
        </Link>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r-sidebar-border">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <div className="flex-1 md:pl-64 pt-14 md:pt-0 pb-20 md:pb-0">
        <main className="h-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Navigation */}
      <BottomNav />
    </div>
  );
}
