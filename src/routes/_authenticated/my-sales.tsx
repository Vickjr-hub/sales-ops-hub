import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { useRole } from "@/hooks/useRole";
import { RepOnly } from "@/components/OwnerOnly";

export const Route = createFileRoute("/_authenticated/my-sales")({
  head: () => ({
    meta: [
      { title: "My Sales — Operator" },
      { name: "description", content: "Review your submitted sales and their approval status." },
      { property: "og:title", content: "My Sales — Operator" },
      { property: "og:description", content: "Sales rep submission history and approval status." },
      { property: "og:url", content: "/my-sales" },
    ],
    links: [{ rel: "canonical", href: "/my-sales" }],
  }),
  component: () => <RepOnly><MySales /></RepOnly>,
});

function StatusBadge({ status }: { status: string }) {
  const v = status === "Approved" ? "default" : status === "Rejected" ? "destructive" : "secondary";
  return <Badge variant={v as any}>{status}</Badge>;
}

function MySales() {
  const { userId } = useRole();
  const { data } = useQuery({
    queryKey: ["my-sales", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*")
        .eq("rep_id", userId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight">My Sales</h1>
      <p className="text-muted-foreground mt-1">Your submission history.</p>

      <div className="mt-6 border border-border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Submitted</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>SPM #</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Sale Type</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Activation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!data || data.length === 0) ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No sales submitted yet.</TableCell></TableRow>
            ) : data.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>{format(parseISO(s.created_at), "MMM d, yyyy")}</TableCell>
                <TableCell className="font-medium">{s.customer_name}</TableCell>
                <TableCell>{s.spm_number}</TableCell>
                <TableCell>{s.lines}</TableCell>
                <TableCell>{s.sale_type}</TableCell>
                <TableCell>{s.package_type}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell>
                  <Badge variant={s.activation_status === "Activated" ? "default" : "outline"}>
                    {s.activation_status ?? "Pending Activation"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
