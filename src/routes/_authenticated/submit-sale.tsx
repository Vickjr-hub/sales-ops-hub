import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import { RepOnly } from "@/components/OwnerOnly";

export const Route = createFileRoute("/_authenticated/submit-sale")({
  head: () => ({
    meta: [
      { title: "Submit Sale — Operator" },
      { name: "description", content: "Record a new sale with customer details, package, and proof photo for owner review." },
      { property: "og:title", content: "Submit Sale — Operator" },
      { property: "og:description", content: "Sales reps submit new sales for owner review and payroll." },
      { property: "og:url", content: "/submit-sale" },
    ],
    links: [{ rel: "canonical", href: "/submit-sale" }],
  }),
  component: () => <RepOnly><SubmitSale /></RepOnly>,
});

const today = () => new Date().toISOString().slice(0, 10);

function SubmitSale() {
  const { userId } = useRole();
  const qc = useQueryClient();

  const [customerName, setCustomerName] = useState("");
  const [spmNumber, setSpmNumber] = useState("");
  const [lines, setLines] = useState(1);
  const [saleType, setSaleType] = useState<"New Customer" | "Upgrade">("New Customer");
  const [packageType, setPackageType] = useState<"Standard" | "Extra" | "Premium">("Standard");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saleDate, setSaleDate] = useState<string>(today());

  const reset = () => {
    setCustomerName(""); setSpmNumber(""); setLines(1);
    setSaleType("New Customer"); setPackageType("Standard");
    setNotes(""); setPhoto(null); setSaleDate(today());
  };

  const submit = useMutation({
    mutationFn: async () => {
      const validateSale = (input: any) => {
  const issues: string[] = [];

  if (!input.customer_name) issues.push("Missing customer name");
  if (!input.spm_number || input.spm_number.length !== 9)
    issues.push("SPM number must be exactly 9 characters");
  if (!input.lines || input.lines <= 0)
    issues.push("Lines must be greater than 0");
  if (!input.sale_type) issues.push("Missing sale type");
  if (!input.package_type) issues.push("Missing package type");

  return issues;
};
      const validationIssues = validateSale({
        customer_name: customerName,
        spm_number: spmNumber,
        lines,
        sale_type: saleType,
        package_type: packageType
      });
      if (validationIssues.length > 0) {
        throw new Error(validationIssues.join(", "));
      }
      if (!userId) throw new Error("Not signed in");
      let photo_url: string | null = null;
      if (photo) {
        const ext = photo.name.split(".").pop() ?? "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("sale-photos").upload(path, photo);
        if (upErr) throw upErr;
        photo_url = path;
      }
      const { error } = await supabase.from("sales").insert({
        rep_id: userId,
        customer_name: customerName,
        spm_number: spmNumber,
        lines,
        sale_type: saleType,
        package_type: packageType,
        notes: notes || null,
        photo_url,
        sale_date: saleDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sale submitted");
      qc.invalidateQueries({ queryKey: ["my-sales"] });
      reset();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to submit"),
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Submit Sale</h1>
      <p className="text-muted-foreground mt-1">Record a new sale for owner review.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
        className="mt-8 space-y-5 border border-border rounded-lg p-6 bg-card"
      >
        <div className="space-y-2">
          <Label htmlFor="customer">Customer Name</Label>
          <Input id="customer" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="spm">SPM Number</Label>
            <Input id="spm" required value={spmNumber} onChange={(e) => setSpmNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lines">Number of Lines</Label>
            <Input id="lines" type="number" min={1} required value={lines}
              onChange={(e) => setLines(Math.max(1, Number(e.target.value)))} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Sale Type</Label>
            <Select value={saleType} onValueChange={(v) => setSaleType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="New Customer">New Customer</SelectItem>
                <SelectItem value="Upgrade">Upgrade</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Package Type</Label>
            <Select value={packageType} onValueChange={(v) => setPackageType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Extra">Extra</SelectItem>
                <SelectItem value="Premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sale-date">Sale Date</Label>
          <Input id="sale-date" type="date" required value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="photo">Photo Upload</Label>
          <Input id="photo" type="file" accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          <p className="text-xs text-muted-foreground">Order screenshot or proof of sale.</p>
        </div>
        <Button type="submit" className="w-full h-12 text-base" disabled={submit.isPending}>
          {submit.isPending ? "Submitting…" : "Submit Sale"}
        </Button>
      </form>
    </div>
  );
}
