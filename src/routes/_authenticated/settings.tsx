import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Operator" }] }),
  component: SettingsPage,
});

type Settings = { id: string; phone_line_rate: number; internet_rate: number; directv_rate: number };

function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ phone_line_rate: 200, internet_rate: 0, directv_rate: 50 });

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        phone_line_rate: Number(data.phone_line_rate),
        internet_rate: Number(data.internet_rate),
        directv_rate: Number(data.directv_rate),
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (data) {
        const { error } = await supabase.from("settings").update(form).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("settings").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="text-muted-foreground mt-1">Update commission rates used in payroll.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="mt-6 space-y-5 border border-border rounded-lg p-6 bg-card"
      >
        <div className="space-y-2">
          <Label>Phone Line Rate ($)</Label>
          <Input type="number" step="0.01" min={0} value={form.phone_line_rate}
            onChange={(e) => setForm({ ...form, phone_line_rate: Number(e.target.value) })} />
          <p className="text-xs text-muted-foreground">Paid per activated line.</p>
        </div>
        <div className="space-y-2">
          <Label>Internet Rate ($)</Label>
          <Input type="number" step="0.01" min={0} value={form.internet_rate}
            onChange={(e) => setForm({ ...form, internet_rate: Number(e.target.value) })} />
          <p className="text-xs text-muted-foreground">Paid per internet sale.</p>
        </div>
        <div className="space-y-2">
          <Label>DirectTV Rate ($)</Label>
          <Input type="number" step="0.01" min={0} value={form.directv_rate}
            onChange={(e) => setForm({ ...form, directv_rate: Number(e.target.value) })} />
          <p className="text-xs text-muted-foreground">Paid per DirectTV sale.</p>
        </div>
        <Button type="submit" className="h-11 w-full" disabled={save.isPending}>Save Changes</Button>
      </form>
    </div>
  );
}
