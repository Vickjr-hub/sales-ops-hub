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
import { Check, Copy } from "lucide-react";
import { format, parseISO } from "date-fns";

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

type Submitted = {
  customer_name: string;
  spm_number: string;
  lines: number;
  sale_type: string;
  package_type: string;
  sale_date: string;
};

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
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  const reset = () => {
    setCustomerName(""); setSpmNumber(""); setLines(1);
    setSaleType("New Customer"); setPackageType("Standard");
    setNotes(""); setPhoto(null); setSaleDate(today());
    setSubmitted(null);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const trimmedName = customerName.trim();
      const trimmedSpm = spmNumber.trim();
      if (trimmedName.length < 2) throw new Error("Customer Name is required");
      if (trimmedSpm.length !== 9) throw new Error("SPM Number must be exactly 9 characters");
      if (lines < 1) throw new Error("Lines must be at least 1");
      if (!photo) throw new Error("Photo is required");
      if (photo.size > 10 * 1024 * 1024) throw new Error("Photo must be under 10MB");

      const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("sale-photos").upload(path, photo, {
        contentType: photo.type || undefined,
        upsert: false,
      });
      if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`);

      const { error } = await supabase.from("sales").insert({
        rep_id: userId,
        customer_name: trimmedName,
        spm_number: trimmedSpm,
        lines,
        sale_type: saleType,
        package_type: packageType,
        notes: notes.trim() || null,
        photo_url: path,
        sale_date: saleDate,
      });
      if (error) {
        // Clean up orphaned photo so storage doesn't accumulate junk
        await supabase.storage.from("sale-photos").remove([path]).catch(() => {});
        throw new Error(`Could not save sale: ${error.message}`);
      }

      return {
        customer_name: trimmedName,
        spm_number: spmNumber,
        lines,
        sale_type: saleType,
        package_type: packageType,
        sale_date: saleDate,
      } satisfies Submitted;
    },
    onSuccess: (data) => {
      toast.success("Sale submitted");
      qc.invalidateQueries({ queryKey: ["my-sales"] });
      setSubmitted(data);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to submit"),
  });

  if (submitted) {
    const summary = [
      `Customer: ${submitted.customer_name}`,
      `SPM: ${submitted.spm_number}`,
      `Lines: ${submitted.lines}`,
      `Sale Type: ${submitted.sale_type}`,
      `Package: ${submitted.package_type}`,
      `Date: ${format(parseISO(submitted.sale_date), "MMM d, yyyy")}`,
    ].join("\n");

    const copy = async () => {
      try {
        await navigator.clipboard.writeText(summary);
        toast.success("Summary copied to clipboard");
      } catch {
        toast.error("Copy failed");
      }
    };

    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Sale Submitted</h1>
        <p className="text-muted-foreground mt-1">Your submission was recorded and is pending owner review.</p>

        <div className="mt-8 border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Check className="h-5 w-5" /> Submission Confirmed
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted-foreground">Customer</dt><dd className="font-medium">{submitted.customer_name}</dd>
            <dt className="text-muted-foreground">SPM Number</dt><dd className="font-medium">{submitted.spm_number}</dd>
            <dt className="text-muted-foreground">Lines</dt><dd className="font-medium">{submitted.lines}</dd>
            <dt className="text-muted-foreground">Submission Date</dt><dd className="font-medium">{format(parseISO(submitted.sale_date), "MMM d, yyyy")}</dd>
          </dl>

          <pre className="mt-5 text-xs bg-muted p-3 rounded-md whitespace-pre-wrap font-mono">{summary}</pre>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Button onClick={copy} className="h-12 text-base flex-1">
              <Copy className="h-4 w-4" /> Copy Summary
            </Button>
            <Button variant="outline" onClick={reset} className="h-12 text-base flex-1">
              Submit Another Sale
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            <Input
              id="spm"
              required
              value={spmNumber}
              onChange={(e) => setSpmNumber(e.target.value)}
              maxLength={9}
              minLength={9}
              pattern=".{9}"
              title="SPM Number must be exactly 9 characters"
            />
            <p className="text-xs text-muted-foreground">Must be exactly 9 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lines">Number of Lines</Label>
            <Select value={String(lines)} onValueChange={(v) => setLines(Number(v))}>
              <SelectTrigger id="lines"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Input id="photo" type="file" accept="image/*" required
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          <p className="text-xs text-muted-foreground">Order screenshot or proof of sale (required).</p>
        </div>
        <Button type="submit" className="w-full h-12 text-base" disabled={submit.isPending}>
          {submit.isPending ? "Submitting…" : "Submit Sale"}
        </Button>
      </form>
    </div>
  );
}
