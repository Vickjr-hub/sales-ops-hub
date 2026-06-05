import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Check, X } from "lucide-react";
import { OwnerOnly } from "@/components/OwnerOnly";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales Review — Operator" }] }),
  component: () => <OwnerOnly><SalesReview /></OwnerOnly>,
});

type Sale = {
  id: string;
  rep_id: string;
  customer_name: string;
  spm_number: string;
  lines: number;
  sale_type: string;
  package_type: string;
  notes: string | null;
  photo_url: string | null;
  sale_date: string;
  status: "Pending" | "Approved" | "Rejected";
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  const v = status === "Approved" ? "default" : status === "Rejected" ? "destructive" : "secondary";
  return <Badge variant={v as any}>{status}</Badge>;
}

function SalesReview() {
  const qc = useQueryClient();
  const [repFilter, setRepFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: profiles } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    (profiles ?? []).forEach((p) => m.set(p.id, p.full_name || "(unnamed)"));
    return m;
  }, [profiles]);

  const { data: sales } = useQuery({
    queryKey: ["sales-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  const filtered = useMemo(() => {
    return (sales ?? []).filter((s) => {
      if (repFilter !== "all" && s.rep_id !== repFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (from && s.sale_date < from) return false;
      if (to && s.sale_date > to) return false;
      return true;
    });
  }, [sales, repFilter, statusFilter, from, to]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "Approved" | "Rejected" }) => {
      const { error } = await supabase.from("sales").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Sale ${v.status.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["sales-all"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  const reps = useMemo(() => {
    const ids = new Set((sales ?? []).map((s) => s.rep_id));
    return Array.from(ids).map((id) => ({ id, name: profileMap.get(id) ?? id }));
  }, [sales, profileMap]);

  const viewPhoto = async (path: string) => {
    const { data, error } = await supabase.storage.from("sale-photos").createSignedUrl(path, 60 * 5);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-bold tracking-tight">Sales Review</h1>
      <p className="text-muted-foreground mt-1">Approve or reject rep-submitted sales.</p>

      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 border border-border rounded-lg p-4 bg-card">
        <div className="space-y-1">
          <Label>Rep</Label>
          <Select value={repFilter} onValueChange={setRepFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reps</SelectItem>
              {reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="mt-6 border border-border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sale Date</TableHead>
              <TableHead>Rep</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>SPM #</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Photo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-10">No sales match filters.</TableCell></TableRow>
            ) : filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{format(parseISO(s.sale_date), "MMM d, yyyy")}</TableCell>
                <TableCell>{profileMap.get(s.rep_id) ?? "—"}</TableCell>
                <TableCell className="font-medium">{s.customer_name}</TableCell>
                <TableCell>{s.spm_number}</TableCell>
                <TableCell>{s.lines}</TableCell>
                <TableCell>{s.sale_type}</TableCell>
                <TableCell>{s.package_type}</TableCell>
                <TableCell>
                  {s.photo_url ? (
                    <Button variant="link" size="sm" className="px-0" onClick={() => viewPhoto(s.photo_url!)}>View</Button>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" disabled={s.status === "Approved" || setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: s.id, status: "Approved" })}>
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" disabled={s.status === "Rejected" || setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: s.id, status: "Rejected" })}>
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
