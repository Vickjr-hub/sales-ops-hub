import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/backend-client";
import { acceptRepresentativeInvitation } from "@/lib/team.functions";

export const Route = createFileRoute("/accept-invite")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Accept Invitation — Operator" },
      { name: "description", content: "Create your Operator account from a team invitation." },
    ],
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const navigate = useNavigate();
  const acceptInvite = useServerFn(acceptRepresentativeInvitation);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessionReady(Boolean(data.session)));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionReady(Boolean(session));
    });
    return () => subscription.unsubscribe();
  }, []);

  const completeAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName.trim() },
      });
      if (error) throw error;

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("Unable to verify your account");
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", userData.user.id);
      if (profileError) throw profileError;

      await acceptInvite();
      toast.success("Account created successfully");
      navigate({ to: "/submit-sale", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to accept the invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set your name and password to join your team in Operator.</p>

        {!sessionReady ? (
          <div className="mt-6 rounded-md border border-border bg-muted p-4 text-sm">
            This invitation link is invalid or has expired. Ask the owner to send a new invitation.
          </div>
        ) : (
          <form onSubmit={completeAccount} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input id="invite-name" required minLength={2} maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-password">Password</Label>
              <Input id="invite-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-password-confirm">Confirm Password</Label>
              <Input id="invite-password-confirm" type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}