import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Plus, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Payroll — Operator" }] }),
  component: PayrollPage,
});

type Entry = {
  id: string;
  rep_name: string;
  raw_lines: number;
  activated_lines: number;
  internet_sales: number;
  directv_sales: number;
  gross_commission: number;
};

type Rates = { phone_line_rate: number; internet_rate: number; directv_rate: number };

function calc(e: Pick<Entry, "activated_lines" | "internet_sales" | "directv_sales">, r: Rates) {
  return (
    Number(e.activated_lines) * Number(r.phone_line_rate) +
    Number(e.internet_sales) * Number(r.internet_rate) +
    Number(e.directv_sales) * Number(r.directv_rate)
  );
}

function PayrollPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Entry | null>(null);
  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

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

  const total = entries.reduce((s, e) => s + Number(e.gross_commission), 0);

  return (
    <div className="max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground mt-1">Manage rep commissions for the current period.</p>
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

      <div className="mt-6 border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep Name</TableHead>
                <TableHead className="text-right">Raw Lines</TableHead>
                <TableHead className="text-right">Activated</TableHead>
                <TableHead className="text-right">Internet</TableHead>
                <TableHead className="text-right">DirectTV</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No entries yet.</TableCell></TableRow>
              )}
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.rep_name}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{e.raw_lines}</TableCell>
                  <TableCell className="text-right">{e.activated_lines}</TableCell>
                  <TableCell className="text-right">{e.internet_sales}</TableCell>
                  <TableCell className="text-right">{e.directv_sales}</TableCell>
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
          <span className="text-sm font-medium text-muted-foreground">Total Payroll</span>
          <span className="text-2xl font-bold">${total.toFixed(2)}</span>
        </div>
      </div>

      <EntryDialog open={open} onOpenChange={setOpen} editing={editing} rates={rates} />
      <SummaryDialog open={summaryOpen} onOpenChange={setSummaryOpen} entries={entries} total={total} />
    </div>
  );
}

function EntryDialog({ open, onOpenChange, editing, rates }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Entry | null; rates: Rates | undefined;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Omit<Entry, "id" | "gross_commission">>({
    rep_name: "", raw_lines: 0, activated_lines: 0, internet_sales: 0, directv_sales: 0,
  });

  // reset on open
  useState(() => {});
  if (open && editing && form.rep_name !== editing.rep_name && form !== (editing as any)) {
    // noop — handled below via effect-like pattern using key would be cleaner; using simple sync
  }

  // sync when editing changes
  const editingId = editing?.id ?? null;
  // simple effect via useState pattern
  if ((open as any)._mark !== editingId) {
    (open as any)._mark = editingId;
    if (editing) {
      const { id: _id, gross_commission: _g, ...rest } = editing;
      // schedule sync
      Promise.resolve().then(() => setForm(rest));
    } else {
      Promise.resolve().then(() => setForm({ rep_name: "", raw_lines: 0, activated_lines: 0, internet_sales: 0, directv_sales: 0 }));
    }
  }

  const save = useMutation({
    mutationFn: async () => {
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
      <DialogContent>
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
            <Button type="submit" disabled={save.isPending}>{editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SummaryDialog({ open, onOpenChange, entries, total }: {
  open: boolean; onOpenChange: (v: boolean) => void; entries: Entry[]; total: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payroll Summary</DialogTitle>
        </DialogHeader>
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
        <div className="flex justify-between border-t border-border pt-4">
          <span className="font-medium">Total</span>
          <span className="text-xl font-bold">${total.toFixed(2)}</span>
        </div>
        <DialogFooter>
          <Button onClick={() => window.print()}>Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
