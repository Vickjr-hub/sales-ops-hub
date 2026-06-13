import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { Mail, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { OwnerOnly } from "@/components/OwnerOnly";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTeam, inviteRepresentative } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team Management — Operator" },
      { name: "description", content: "Invite representatives and manage team access." },
    ],
  }),
  component: () => <OwnerOnly><TeamPage /></OwnerOnly>,
});

function TeamPage() {
  const queryClient = useQueryClient();
  const loadTeam = useServerFn(getTeam);
  const sendInvite = useServerFn(inviteRepresentative);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["team"],
    queryFn: () => loadTeam(),
  });

  const invite = useMutation({
    mutationFn: () => sendInvite({ data: { email } }),
    onSuccess: ({ email: invitedEmail }) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success(`Invitation sent to ${invitedEmail}`);
      setEmail("");
      setOpen(false);
    },
    onError: (inviteError) => toast.error(inviteError.message),
  });

  const representatives = data?.members.filter((member) => member.role === "rep") ?? [];
  const pending = data?.invitations.filter((invitation) => invitation.status === "pending") ?? [];

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
          <p className="mt-1 text-muted-foreground">Invite representatives and review team access.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="h-11 gap-2">
          <UserPlus className="h-4 w-4" /> Invite Representative
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <Users className="h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-3xl font-bold">{representatives.length}</p>
          <p className="text-sm text-muted-foreground">Representatives</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-3xl font-bold">{pending.length}</p>
          <p className="text-sm text-muted-foreground">Pending invitations</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading team…</p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-destructive">{error.message}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name / Email</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email}</TableCell>
                  <TableCell>Representative</TableCell>
                  <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
                  <TableCell>{format(parseISO(invitation.created_at), "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))}
              {representatives.map((member) => {
                const acceptedInvite = data?.invitations.find(
                  (invitation) => invitation.user_id === member.userId && invitation.status === "accepted",
                );
                return (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div className="font-medium">{member.fullName || member.email || "Representative"}</div>
                      {member.fullName && member.email ? <div className="text-xs text-muted-foreground">{member.email}</div> : null}
                    </TableCell>
                    <TableCell>Representative</TableCell>
                    <TableCell><Badge>Active</Badge></TableCell>
                    <TableCell>{acceptedInvite ? format(parseISO(acceptedInvite.created_at), "MMM d, yyyy") : "—"}</TableCell>
                  </TableRow>
                );
              })}
              {pending.length === 0 && representatives.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No representatives yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Representative</DialogTitle>
            <DialogDescription>An email invitation will let this person securely create their password.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); invite.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="representative@company.com"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? "Sending…" : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}