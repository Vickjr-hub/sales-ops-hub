import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/backend-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { OwnerOnly } from "@/components/OwnerOnly";

export const Route = createFileRoute("/_authenticated/settings")({  head: () => ({
    meta: [
      { title: "Settings — Operator" },
      { name: "description", content: "Update commission rates for future phone line, internet, and DirecTV sale approvals." },
      { property: "og:title", content: "Settings — Operator" },
      { property: "og:description", content: "Manage commission rates used to calculate sales rep payroll." },
      { property: "og:url", content: "/settings" },
    ],
    links: [{ rel: "canonical", href: "/settings" }],
  }),
  component: () => <OwnerOnly><SettingsPage /></OwnerOnly>,
});

type Settings = {
  id: string;
  phone_line_rate: number;
  internet_rate: number;
  directv_rate: number;
  groupme_webhook_url?: string | null;
  webhook_enabled?: boolean;
};

function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    phone_line_rate: 200,
    internet_rate: 0,
    directv_rate: 50,
    groupme_webhook_url: '',
    webhook_enabled: false,
  });

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
        groupme_webhook_url: data.groupme_webhook_url || '',
        webhook_enabled: data.webhook_enabled || false,
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
      qc.invalidateQueries({ queryKey: ["payroll"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Settings saved. New approvals will use these rates.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="text-muted-foreground mt-1">Update commission rates and webhook configuration.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="mt-6 space-y-5 border border-border rounded-lg p-6 bg-card"
      >
        <div className="space-y-2">
          <Label>Phone Line Rate ($)</Label>
          <Input type="number" step="0.01" min={0} value={form.phone_line_rate}
            onChange={(e) => setForm({ ...form, phone_line_rate: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Internet Rate ($)</Label>
          <Input type="number" step="0.01" min={0} value={form.internet_rate}
            onChange={(e) => setForm({ ...form, internet_rate: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>DirecTV Rate ($)</Label>
          <Input type="number" step="0.01" min={0} value={form.directv_rate}
            onChange={(e) => setForm({ ...form, directv_rate: Number(e.target.value) })} />
        </div>

        <div className="border-t border-border pt-4 mt-6">
          <h2 className="text-lg font-semibold mb-4">Webhook Integration (Optional)</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="webhook-enabled"
                checked={form.webhook_enabled}
                onCheckedChange={(checked) =>
                  setForm({ ...form, webhook_enabled: checked as boolean })
                }
              />
              <Label htmlFor="webhook-enabled" className="cursor-pointer">Enable webhook notifications</Label>
            </div>
            {form.webhook_enabled && (
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL (GroupMe or custom)</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  placeholder="https://api.groupme.com/v3/bots/post?token=..."
                  value={form.groupme_webhook_url}
                  onChange={(e) => setForm({ ...form, groupme_webhook_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Sales submissions will be posted to this URL.</p>
              </div>
            )}
          </div>
        </div>

        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}
