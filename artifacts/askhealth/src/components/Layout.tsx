import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetCurrentUser, useGetMyCreditsSummary } from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";
import { Search, User, Shield, LogOut, Menu, Activity } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";

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
  const { data: user } = useGetCurrentUser();
  const { data: credits } = useGetMyCreditsSummary({ query: { enabled: !!user } });
  const { signOut } = useClerk();

  const navItems = [
    { href: "/communities", icon: Home, label: "Communities" },
    { href: "/search", icon: Search, label: "Search" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  if (user?.role === "admin") {
    navItems.push({ href: "/admin", icon: Shield, label: "Admin" });
  }

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">AskHealth AI</span>
        </div>

        {credits && (
          <div className="mb-8 p-4 rounded-xl bg-sidebar-accent/50 border border-sidebar-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-sidebar-accent-foreground">Level {credits.level}</span>
              <span className="text-xs text-sidebar-accent-foreground/70">{credits.healthCredits} HC</span>
            </div>
            <Progress value={credits.progressPercent} className="h-1.5 mb-2 bg-sidebar-border" />
            <div className="text-xs text-sidebar-accent-foreground/70">{credits.creditsToNextLevel} to next level</div>
          </div>
        )}

        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                location.startsWith(item.href) && (item.href !== "/communities" || location === "/communities" || location.startsWith("/communities/"))
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}>
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer w-full text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 fixed inset-y-0 left-0">
        <SidebarContent />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2 text-sidebar-foreground">
          <Activity className="w-5 h-5 text-sidebar-primary" />
          <span className="font-bold">AskHealth AI</span>
        </div>
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
      <div className="flex-1 md:pl-64 pt-14 md:pt-0 pb-16 md:pb-0">
        <main className="h-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Navigation */}
      <BottomNav />
    </div>
  );
}
