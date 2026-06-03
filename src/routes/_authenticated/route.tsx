import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, DollarSign, Users, Settings as SettingsIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/payroll", label: "Payroll", icon: DollarSign },
  { to: "/recruiting", label: "Recruiting", icon: Users },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function AuthedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`${mobileOpen ? "block" : "hidden"} md:block fixed md:static inset-0 md:inset-auto z-40 w-64 bg-card border-r border-border flex-shrink-0`}>
        <div className="flex flex-col h-full p-4">
          <div className="px-2 py-4">
            <h1 className="text-xl font-bold tracking-tight">Operator</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Sales Operations</p>
          </div>
          <nav className="mt-4 flex-1 space-y-1">
            {nav.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Button variant="ghost" onClick={handleLogout} className="justify-start gap-3 h-11">
            <LogOut className="h-5 w-5" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between border-b border-border px-4 bg-card">
          <h1 className="font-bold">Operator</h1>
          <Button variant="outline" size="sm" onClick={() => setMobileOpen(!mobileOpen)}>Menu</Button>
        </header>
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
