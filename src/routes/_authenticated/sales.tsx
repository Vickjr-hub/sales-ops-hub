import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/backend-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Check, X, AlertTriangle, ShieldCheck, Zap } from "lucide-react";
import { OwnerOnly } from "@/components/OwnerOnly";
import { verifySale } from "@/lib/saleVerification";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales Review — Operator" },
      { name: "description", content: "Review, approve, or reject sales submitted by your door-to-door sales reps." },
      { property: "og:title", content: "Sales Review — Operator" },
      { property: "og:description", content: "Approve or reject rep-submitted sales to keep payroll accurate." },
      { property: "og:url", content: "/sales" },
    ],
    links: [{ rel: "canonical", href: "/sales" }],
  }),
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
  status: "Pending" | "Approved" | "Activated" | "Rejected";
  activation_status: "Pending Activation" | "Activated";
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  const v = status === "Approved" ? "default" : status === "Rejected" ? "destructive" : "secondary";
  return <Badge variant={v as any}>{status}</Badge>;
}

function ActivationBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "Activated" ? "default" : "outline"} className="gap-1">
      <Zap className="h-3 w-3" /> {status}
    </Badge>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function SaleCard({
  sale, repName, onApprove, onReject, onActivate, onViewPhoto, busy,
}: {
  sale: Sale;
  repName: string;
  onApprove: () => void;
  onReject: () => void;
  onActivate: () => void;
  onViewPhoto: () => void;
  busy: boolean;
}) {
  const v = verifySale(sale);
  const needsReview = v.status === "Needs Review";
  return (
    <div className={`border rounded-lg p-5 bg-card ${needsReview ? "border-destructive/50" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-lg">{sale.customer_name}</div>
          <div className="text-sm text-muted-foreground">
            {format(parseISO(sale.sale_date), "MMM d, yyyy")} · {repName}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={sale.status} />
          <ActivationBadge status={sale.activation_status} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div><div className="text-muted-foreground text-xs">SPM #</div><div className="font-medium">{sale.spm_number}</div></div>
        <div><div className="text-muted-foreground text-xs">Lines</div><div className="font-medium">{sale.lines}</div></div>
        <div><div className="text-muted-foreground text-xs">Type</div><div className="font-medium">{sale.sale_type}</div></div>
        <div><div className="text-muted-foreground text-xs">Package</div><div className="font-medium">{sale.package_type}</div></div>
        <div>
          <div className="text-muted-foreground text-xs">Photo</div>
          {sale.photo_url ? (
            <Button variant="link" size="sm" className="px-0 h-auto" onClick={onViewPhoto}>View photo</Button>
          ) : <span className="text-muted-foreground">—</span>}
        </div>
        {sale.notes && (
          <div className="col-span-2 sm:col-span-3">
            <div className="text-muted-foreground text-xs">Notes</div>
            <div className="font-medium whitespace-pre-wrap">{sale.notes}</div>
          </div>
        )}
      </div>

      <div className={`mt-4 rounded-md p-3 ${needsReview ? "bg-destructive/10" : "bg-muted"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm">
            {needsReview ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <ShieldCheck className="h-4 w-4 text-primary" />}
            Verification: {v.status}
          </div>
          <div className="text-xs text-muted-foreground">
            {v.issueCount === 0 ? "No issues" : `${v.issueCount} issue${v.issueCount === 1 ? "" : "s"}`}
          </div>
        </div>
        <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs">
          {v.checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-1 ${c.ok ? "text-foreground" : "text-destructive"}`}>
              {c.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {c.ok ? c.label : `Missing/Invalid ${c.label}`}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" disabled={sale.status === "Approved" || busy} onClick={onApprove}>
          <Check className="h-4 w-4" /> Approve
        </Button>
        <Button size="sm" variant="outline" disabled={sale.status === "Rejected" || busy} onClick={onReject}>
          <X className="h-4 w-4" /> Reject
        </Button>
        <Button
          size="sm"
          variant="default"
          disabled={busy || sale.status !== "Approved" || sale.activation_status === "Activated"}
          onClick={onActivate}
        >
          <Zap className="h-4 w-4" /> Mark Activated
        </Button>
      </div>
    </div>
  );
}

function SalesReview() {
  const qc = useQueryClient();
  const [repFilter, setRepFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activationFilter, setActivationFilter] = useState<string>("all");
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

  const counts = useMemo(() => {
    const list = sales ?? [];
    return {
      total: list.length,
      pending: list.filter((s) => s.status === "Pending").length,
      approved: list.filter((s) => s.status === "Approved").length,
      rejected: list.filter((s) => s.status === "Rejected").length,
      pendingActivation: list.filter((s) => s.activation_status === "Pending Activation").length,
      activated: list.filter((s) => s.activation_status === "Activated").length,
    };
  }, [sales]);

  const filtered = useMemo(() => {
    return (sales ?? []).filter((s) => {
      if (repFilter !== "all" && s.rep_id !== repFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (activationFilter !== "all" && s.activation_status !== activationFilter) return false;
      if (from && s.sale_date < from) return false;
      if (to && s.sale_date > to) return false;
      return true;
    });
  }, [sales, repFilter, statusFilter, activationFilter, from, to]);

  const needsReview = useMemo(() => filtered.filter((s) => verifySale(s).status === "Needs Review"), [filtered]);
  const valid = useMemo(() => filtered.filter((s) => verifySale(s).status === "Valid"), [filtered]);

  const updateSale = useMutation({
    mutationFn: async (patch: { id: string; changes: Partial<Sale> }) => {
      const { data, error } = await supabase
        .from("sales")
        .update(patch.changes)
        .eq("id", patch.id)
        .select("id, status, activation_status")
        .single();
      if (error) throw error;
      if (!data) throw new Error("The sale was not updated");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-all"] });
      qc.invalidateQueries({ queryKey: ["payroll"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
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

  const renderCard = (s: Sale) => (
    <SaleCard
      key={s.id}
      sale={s}
      repName={profileMap.get(s.rep_id) ?? "—"}
      busy={updateSale.isPending}
      onApprove={() => updateSale.mutate({ id: s.id, changes: { status: "Approved" } }, { onSuccess: () => toast.success("Sale approved") })}
      onReject={() => updateSale.mutate({ id: s.id, changes: { status: "Rejected" } }, { onSuccess: () => toast.success("Sale rejected") })}
      onActivate={() => updateSale.mutate({ id: s.id, changes: { status: "Activated", activation_status: "Activated" } }, { onSuccess: () => toast.success("Sale activated and payroll updated") })}
      onViewPhoto={() => s.photo_url && viewPhoto(s.photo_url)}
    />
  );

  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-bold tracking-tight">Sales Review</h1>
      <p className="text-muted-foreground mt-1">Approve, reject, and track activation of rep-submitted sales.</p>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Total Submitted" value={counts.total} />
        <SummaryCard label="Pending Review" value={counts.pending} />
        <SummaryCard label="Approved" value={counts.approved} />
        <SummaryCard label="Rejected" value={counts.rejected} />
        <SummaryCard label="Pending Activation" value={counts.pendingActivation} />
        <SummaryCard label="Activated" value={counts.activated} />
      </div>

      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-4 border border-border rounded-lg p-4 bg-card">
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
          <Label>Activation</Label>
          <Select value={activationFilter} onValueChange={setActivationFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activations</SelectItem>
              <SelectItem value="Pending Activation">Pending Activation</SelectItem>
              <SelectItem value="Activated">Activated</SelectItem>
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

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-xl font-semibold">Needs Review</h2>
          <Badge variant="destructive">{needsReview.length}</Badge>
        </div>
        {needsReview.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
            No sales require attention.
          </div>
        ) : (
          <div className="grid gap-4">{needsReview.map(renderCard)}</div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Valid Sales</h2>
          <Badge>{valid.length}</Badge>
        </div>
        {valid.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
            No valid sales match the current filters.
          </div>
        ) : (
          <div className="grid gap-4">{valid.map(renderCard)}</div>
        )}
      </section>
    </div>
  );
}
