import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/backend-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { DatePickerField } from "@/components/DatePickerField";

import { OwnerOnly } from "@/components/OwnerOnly";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — Operator" },
      { name: "description", content: "Calculate weekly commission payroll for your door-to-door sales reps and generate payroll summaries." },
      { property: "og:title", content: "Payroll — Operator" },
      { property: "og:description", content: "Weekly commission payroll calculation and summaries for door-to-door sales teams." },
      { property: "og:url", content: "/payroll" },
    ],
    links: [{ rel: "canonical", href: "/payroll" }],
  }),
  component: () => <OwnerOnly><PayrollPage /></OwnerOnly>,
});

type Entry = {
  id: string;
  sale_id: string | null;
  rep_id: string | null;
  owner_id: string | null;
  rep_name: string;
  commission_amount: number | null;
  product_type: string | null;
  sale_value: number | null;
  activation_date: string | null;
  status: string | null;
  created_at: string;
  pay_period_start: string | null;
  pay_period_end: string | null;
};

function defaultWeek() {
  const now = new Date();
  return {
    start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    end: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function PayrollPage() {
  const wk = defaultWeek();
  const [filterStart, setFilterStart] = useState<string | null>(wk.start);
  const [filterEnd, setFilterEnd] = useState<string | null>(wk.end);

  const { data: entries = [] } = useQuery({
    queryKey: ["payroll"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterStart && (!e.pay_period_start || e.pay_period_start < filterStart)) return false;
      if (filterEnd && (!e.pay_period_end || e.pay_period_end > filterEnd)) return false;
      return true;
    });
  }, [entries, filterStart, filterEnd]);

  const total = filtered.reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);

  const exportCsv = () => {
    const escape = (value: string | number | null) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["rep", "sale_id", "commission", "product_type", "status", "date"],
      ...filtered.map((entry) => [
        entry.rep_name,
        entry.sale_id,
        Number(entry.commission_amount ?? 0).toFixed(2),
        entry.product_type,
        entry.status,
        entry.activation_date ?? entry.created_at.slice(0, 10),
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `operator-payroll-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground mt-1">Weekly commissions by rep.</p>
        </div>
        <Button variant="outline" className="h-11" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end border border-border rounded-lg p-4 bg-card">
        <div className="space-y-2">
          <Label>Pay Period Start</Label>
          <DatePickerField value={filterStart} onChange={setFilterStart} />
        </div>
        <div className="space-y-2">
          <Label>Pay Period End</Label>
          <DatePickerField value={filterEnd} onChange={setFilterEnd} />
        </div>
        <Button variant="outline" className="h-11" onClick={() => { setFilterStart(null); setFilterEnd(null); }}>
          Clear
        </Button>
      </div>

      <div className="mt-4 border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep Name</TableHead>
                <TableHead>Sale</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No approved or activated sales in this period.</TableCell></TableRow>
              )}
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.rep_name}</TableCell>
                  <TableCell className="font-mono text-xs">{e.sale_id ?? "Legacy"}</TableCell>
                  <TableCell className="capitalize">{(e.product_type ?? "legacy").replaceAll("_", " ")}</TableCell>
                  <TableCell>{e.status ?? "Legacy"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(e.activation_date ?? e.created_at)}</TableCell>
                  <TableCell className="text-right font-semibold">${Number(e.commission_amount ?? 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="border-t border-border px-4 py-4 flex justify-between items-center bg-muted/30">
          <span className="text-sm font-medium text-muted-foreground">Period Total</span>
          <span className="text-2xl font-bold">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

