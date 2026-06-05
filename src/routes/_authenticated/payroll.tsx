import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Plus, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { DatePickerField } from "@/components/DatePickerField";

import { OwnerOnly } from "@/components/OwnerOnly";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Payroll — Operator" }] }),
  component: () => <OwnerOnly><PayrollPage /></OwnerOnly>,
});

type Entry = {
  id: string;
  rep_name: string;
  raw_lines: number;
  activated_lines: number;
  internet_sales: number;
  directv_sales: number;
  gross_commission: number;
  pay_period_start: string | null;
  pay_period_end: string | null;
};

type Rates = { phone_line_rate: number; internet_rate: number; directv_rate: number };

function calc(e: Pick<Entry, "activated_lines" | "internet_sales" | "directv_sales">, r: Rates) {
  return (
    Number(e.activated_lines) * Number(r.phone_line_rate) +
    Number(e.internet_sales) * Number(r.internet_rate) +
    Number(e.directv_sales) * Number(r.directv_rate)
  );
}

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
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Entry | null>(null);
  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

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

  const { data: rates } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? { phone_line_rate: 200, internet_rate: 0, directv_rate: 50 }) as Rates;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Entry deleted");
    },
  });

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterStart && (!e.pay_period_start || e.pay_period_start < filterStart)) return false;
      if (filterEnd && (!e.pay_period_end || e.pay_period_end > filterEnd)) return false;
      return true;
    });
  }, [entries, filterStart, filterEnd]);

  const total = filtered.reduce((s, e) => s + Number(e.gross_commission), 0);

  return (
    <div className="max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground mt-1">Weekly commissions by rep.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11" onClick={() => setSummaryOpen(true)}>
            <FileText className="h-4 w-4 mr-2" /> Summary
          </Button>
          <Button className="h-11" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Entry
          </Button>
        </div>
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
                <TableHead className="text-right">Raw</TableHead>
                <TableHead className="text-right">Activated</TableHead>
                <TableHead className="text-right">Internet</TableHead>
                <TableHead className="text-right">DirectTV</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No entries in this period.</TableCell></TableRow>
              )}
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.rep_name}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{e.raw_lines}</TableCell>
                  <TableCell className="text-right">{e.activated_lines}</TableCell>
                  <TableCell className="text-right">{e.internet_sales}</TableCell>
                  <TableCell className="text-right">{e.directv_sales}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {fmtDate(e.pay_period_start)} – {fmtDate(e.pay_period_end)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">${Number(e.gross_commission).toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this entry?")) del.mutate(e.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
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

      <EntryDialog open={open} onOpenChange={setOpen} editing={editing} rates={rates} defaultPeriod={wk} />
      <SummaryDialog open={summaryOpen} onOpenChange={setSummaryOpen} entries={filtered} start={filterStart} end={filterEnd} />
    </div>
  );
}

function EntryDialog({ open, onOpenChange, editing, rates, defaultPeriod }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Entry | null; rates: Rates | undefined;
  defaultPeriod: { start: string; end: string };
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Omit<Entry, "id" | "gross_commission">>({
    rep_name: "", raw_lines: 0, activated_lines: 0, internet_sales: 0, directv_sales: 0,
    pay_period_start: defaultPeriod.start, pay_period_end: defaultPeriod.end,
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const { id: _id, gross_commission: _g, ...rest } = editing;
      setForm(rest);
    } else {
      setForm({
        rep_name: "", raw_lines: 0, activated_lines: 0, internet_sales: 0, directv_sales: 0,
        pay_period_start: defaultPeriod.start, pay_period_end: defaultPeriod.end,
      });
    }
  }, [open, editing, defaultPeriod.start, defaultPeriod.end]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.rep_name.trim()) throw new Error("Rep name is required");
      if (!form.pay_period_start || !form.pay_period_end) throw new Error("Pay period dates are required");
      if (form.pay_period_end < form.pay_period_start) throw new Error("End date must be after start date");
      const r = rates ?? { phone_line_rate: 200, internet_rate: 0, directv_rate: 50 };
      const gross = calc(form, r);
      if (editing) {
        const { error } = await supabase.from("payroll_entries").update({ ...form, gross_commission: gross }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payroll_entries").insert({ ...form, gross_commission: gross });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success(editing ? "Entry updated" : "Entry added");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const preview = rates ? calc(form, rates) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit" : "Add"} Payroll Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Rep Name</Label>
            <Input required value={form.rep_name} onChange={(e) => setForm({ ...form, rep_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Pay Period Start</Label>
              <DatePickerField value={form.pay_period_start} onChange={(v) => setForm({ ...form, pay_period_start: v })} />
            </div>
            <div className="space-y-2">
              <Label>Pay Period End</Label>
              <DatePickerField value={form.pay_period_end} onChange={(v) => setForm({ ...form, pay_period_end: v })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Raw Lines Sold</Label>
              <Input type="number" min={0} value={form.raw_lines} onChange={(e) => setForm({ ...form, raw_lines: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Activated Lines</Label>
              <Input type="number" min={0} value={form.activated_lines} onChange={(e) => setForm({ ...form, activated_lines: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Internet Sales</Label>
              <Input type="number" min={0} value={form.internet_sales} onChange={(e) => setForm({ ...form, internet_sales: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>DirectTV Sales</Label>
              <Input type="number" min={0} value={form.directv_sales} onChange={(e) => setForm({ ...form, directv_sales: Number(e.target.value) })} />
            </div>
          </div>
          <div className="bg-muted/40 rounded-md p-3 flex justify-between">
            <span className="text-sm text-muted-foreground">Gross Commission</span>
            <span className="font-bold">${preview.toFixed(2)}</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="h-11" disabled={save.isPending}>
              {save.isPending ? "Saving..." : editing ? "Save" : "Add Entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SummaryDialog({ open, onOpenChange, entries, start, end }: {
  open: boolean; onOpenChange: (v: boolean) => void; entries: Entry[]; start: string | null; end: string | null;
}) {
  const totals = entries.reduce(
    (a, e) => ({
      activated: a.activated + Number(e.activated_lines),
      internet: a.internet + Number(e.internet_sales),
      directv: a.directv + Number(e.directv_sales),
      gross: a.gross + Number(e.gross_commission),
    }),
    { activated: 0, internet: 0, directv: 0, gross: 0 },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Payroll Summary</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Period: {start ? fmtDate(start) : "All time"} – {end ? fmtDate(end) : "All time"}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryStat label="Total Activated Lines" value={totals.activated} />
          <SummaryStat label="Total Internet Sales" value={totals.internet} />
          <SummaryStat label="Total DirectTV Sales" value={totals.directv} />
          <SummaryStat label="Total Gross Payroll" value={`$${totals.gross.toFixed(2)}`} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep Name</TableHead>
                <TableHead className="text-right">Activated</TableHead>
                <TableHead className="text-right">Internet</TableHead>
                <TableHead className="text-right">DirectTV</TableHead>
                <TableHead className="text-right">Gross</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.rep_name}</TableCell>
                  <TableCell className="text-right">{e.activated_lines}</TableCell>
                  <TableCell className="text-right">{e.internet_sales}</TableCell>
                  <TableCell className="text-right">{e.directv_sales}</TableCell>
                  <TableCell className="text-right font-semibold">${Number(e.gross_commission).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button onClick={() => window.print()}>Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border rounded-md p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
