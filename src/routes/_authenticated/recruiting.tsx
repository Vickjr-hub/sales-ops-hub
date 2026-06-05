import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CalendarClock, CheckCircle2, UserCheck, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { DatePickerField } from "@/components/DatePickerField";

import { OwnerOnly } from "@/components/OwnerOnly";

export const Route = createFileRoute("/_authenticated/recruiting")({
  head: () => ({ meta: [{ title: "Recruiting — Operator" }] }),
  component: () => <OwnerOnly><RecruitingPage /></OwnerOnly>,
});

const STATUSES = ["Applied", "Interview Scheduled", "Interview Completed", "Hired", "Rejected"] as const;
type Status = typeof STATUSES[number];

type Applicant = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: Status;
  interview_date: string | null;
  interview_time: string | null;
};

const STATUS_VARIANTS: Record<Status, string> = {
  "Applied": "bg-muted text-foreground",
  "Interview Scheduled": "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  "Interview Completed": "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "Hired": "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  "Rejected": "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

function fmtInterview(d: string | null, t: string | null) {
  if (!d) return "—";
  try {
    const datePart = format(parseISO(d), "MMM d, yyyy");
    if (!t) return datePart;
    const [h, m] = t.split(":");
    const dt = new Date();
    dt.setHours(Number(h), Number(m), 0);
    return `${datePart} • ${format(dt, "h:mm a")}`;
  } catch { return d; }
}

function RecruitingPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Applicant | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Applicant | null>(null);

  const { data: applicants = [] } = useQuery({
    queryKey: ["applicants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("applicants").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Applicant[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("applicants").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["applicants"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success(`Marked as ${v.status}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("applicants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applicants"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Applicant deleted");
    },
  });

  return (
    <div className="max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recruiting</h1>
          <p className="text-muted-foreground mt-1">Track applicants and schedule interviews.</p>
        </div>
        <Button className="h-11" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Applicant
        </Button>
      </div>

      <div className="mt-6 border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Interview</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicants.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No applicants yet.</TableCell></TableRow>
              )}
              {applicants.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.full_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>{a.phone || "—"}</div>
                    <div className="text-xs">{a.email || ""}</div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{fmtInterview(a.interview_date, a.interview_time)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_VARIANTS[a.status]}>{a.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => setScheduleFor(a)}>
                        <CalendarClock className="h-4 w-4 mr-1" /> Schedule
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: a.id, status: "Interview Completed" })}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
                      </Button>
                      <Button size="sm" variant="default" onClick={() => updateStatus.mutate({ id: a.id, status: "Hired" })}>
                        <UserCheck className="h-4 w-4 mr-1" /> Hire
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate({ id: a.id, status: "Rejected" })}>
                        <UserX className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this applicant?")) del.mutate(a.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <ApplicantDialog open={open} onOpenChange={setOpen} editing={editing} />
      <ScheduleDialog applicant={scheduleFor} onClose={() => setScheduleFor(null)} />
    </div>
  );
}

function ScheduleDialog({ applicant, onClose }: { applicant: Applicant | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string>("09:00");

  useEffect(() => {
    if (applicant) {
      setDate(applicant.interview_date);
      setTime(applicant.interview_time?.slice(0, 5) ?? "09:00");
    }
  }, [applicant]);

  const save = useMutation({
    mutationFn: async () => {
      if (!applicant) return;
      if (!date) throw new Error("Please select an interview date");
      if (!time) throw new Error("Please select an interview time");
      const { error } = await supabase
        .from("applicants")
        .update({ interview_date: date, interview_time: time, status: "Interview Scheduled" })
        .eq("id", applicant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applicants"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Interview scheduled");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!applicant} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Interview — {applicant?.full_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Interview Date</Label>
            <DatePickerField value={date} onChange={setDate} placeholder="Pick interview date" />
          </div>
          <div className="space-y-2">
            <Label>Interview Time</Label>
            <Input type="time" className="h-11" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="h-11" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save Interview"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ApplicantDialog({ open, onOpenChange, editing }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Applicant | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", notes: "",
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          full_name: editing.full_name,
          phone: editing.phone ?? "",
          email: editing.email ?? "",
          notes: editing.notes ?? "",
        });
      } else {
        setForm({ full_name: "", phone: "", email: "", notes: "" });
      }
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Full name is required");
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("applicants").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("applicants").insert({ ...payload, status: "Applied" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applicants"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success(editing ? "Applicant updated" : "Applicant added");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit" : "Add"} Applicant</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="h-11" disabled={save.isPending}>
              {save.isPending ? "Saving..." : editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
