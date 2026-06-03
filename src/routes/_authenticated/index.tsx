import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, DollarSign, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Operator" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const [applicants, payroll] = await Promise.all([
        supabase.from("applicants").select("id,status"),
        supabase.from("payroll_entries").select("gross_commission"),
      ]);
      const apps = applicants.data ?? [];
      const pay = payroll.data ?? [];
      const activeReps = new Set<string>();
      apps.forEach((a) => { if (a.status === "Hired") activeReps.add(a.id); });
      return {
        activeReps: apps.filter((a) => a.status === "Hired").length,
        totalApplicants: apps.length,
        payrollTotal: pay.reduce((s, p) => s + Number(p.gross_commission ?? 0), 0),
        scheduledInterviews: apps.filter((a) => a.status === "Interview Scheduled").length,
      };
    },
  });

  const cards = [
    { label: "Active Reps", value: data?.activeReps ?? 0, icon: Users },
    { label: "Total Applicants", value: data?.totalApplicants ?? 0, icon: UserPlus },
    { label: "Current Payroll Total", value: `$${(data?.payrollTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign },
    { label: "Scheduled Interviews", value: data?.scheduledInterviews ?? 0, icon: CalendarClock },
  ];

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground mt-1">Overview of operations.</p>
      <div className="grid gap-4 mt-8 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="border border-border rounded-lg p-6 bg-card">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold mt-3">{c.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
