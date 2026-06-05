import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, DollarSign, CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useRole } from "@/hooks/useRole";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Sales Operations Dashboard — Operator" },
      { name: "description", content: "Overview of active reps, applicants, payroll totals, and upcoming interviews for your sales team." },
      { property: "og:title", content: "Sales Operations Dashboard — Operator" },
      { property: "og:description", content: "Track active reps, applicants, payroll, and upcoming interviews at a glance." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: DashboardGate,
});

function DashboardGate() {
  const { role, isLoading } = useRole();
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (role === "rep") return <Navigate to="/submit-sale" replace />;
  return <Dashboard />;
}

type Applicant = {
  id: string;
  full_name: string;
  status: string;
  interview_date: string | null;
  interview_time: string | null;
};

function fmtInterview(d: string, t: string | null) {
  try {
    const date = format(parseISO(d), "EEE, MMM d");
    if (!t) return date;
    const [h, m] = t.split(":");
    const dt = new Date();
    dt.setHours(Number(h), Number(m), 0);
    return `${date} • ${format(dt, "h:mm a")}`;
  } catch { return d; }
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const [applicants, payroll] = await Promise.all([
        supabase.from("applicants").select("id, full_name, status, interview_date, interview_time"),
        supabase.from("payroll_entries").select("gross_commission"),
      ]);
      const apps = (applicants.data ?? []) as Applicant[];
      const pay = payroll.data ?? [];
      const todayStr = new Date().toISOString().slice(0, 10);
      const upcoming = apps
        .filter((a) => a.status === "Interview Scheduled" && a.interview_date && a.interview_date >= todayStr)
        .sort((a, b) => {
          const ad = `${a.interview_date}T${a.interview_time ?? "00:00"}`;
          const bd = `${b.interview_date}T${b.interview_time ?? "00:00"}`;
          return ad.localeCompare(bd);
        });
      return {
        activeReps: apps.filter((a) => a.status === "Hired").length,
        totalApplicants: apps.length,
        payrollTotal: pay.reduce((s, p) => s + Number(p.gross_commission ?? 0), 0),
        scheduledInterviews: apps.filter((a) => a.status === "Interview Scheduled").length,
        upcoming,
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

      <div className="mt-8 border border-border rounded-lg bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Upcoming Interviews</h2>
        </div>
        {(!data?.upcoming || data.upcoming.length === 0) ? (
          <p className="px-6 py-8 text-center text-muted-foreground text-sm">No upcoming interviews scheduled.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.upcoming.map((a) => (
              <li key={a.id} className="px-6 py-4 flex items-center justify-between">
                <span className="font-medium">{a.full_name}</span>
                <span className="text-sm text-muted-foreground">{fmtInterview(a.interview_date!, a.interview_time)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
