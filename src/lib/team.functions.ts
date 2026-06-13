import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
});

async function requireOwner(context: {
  userId: string;
  supabase: { rpc: (name: "has_role", args: { _user_id: string; _role: "owner" }) => PromiseLike<{ data: boolean | null; error: { message: string } | null }> };
}) {
  const { data: isOwner, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "owner",
  });
  if (error) throw new Error(`Unable to verify owner access: ${error.message}`);
  if (!isOwner) throw new Error("Forbidden: Owner access is required");
}

export const inviteRepresentative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireOwner(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingInvite } = await supabaseAdmin
      .from("team_invitations")
      .select("id")
      .eq("email", data.email)
      .eq("status", "pending")
      .maybeSingle();
    if (existingInvite) throw new Error("A pending invitation already exists for this email address");

    const request = getRequest();
    const redirectTo = `${new URL(request.url).origin}/accept-invite`;
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { redirectTo },
    );
    if (inviteError || !invited.user) {
      throw new Error(inviteError?.message ?? "Unable to send the invitation");
    }

    const userId = invited.user.id;
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "rep" });
    const { error: recordError } = await supabaseAdmin.from("team_invitations").insert({
      email: data.email,
      invited_by: context.userId,
      user_id: userId,
      role: "rep",
      status: "pending",
    });

    if (roleError || recordError) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "rep");
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(roleError?.message ?? recordError?.message ?? "Unable to create the invitation");
    }

    return { email: data.email };
  });

export const getTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: roles, error: rolesError }, { data: invites, error: invitesError }] =
      await Promise.all([
        supabaseAdmin.from("user_roles").select("user_id, role"),
        supabaseAdmin
          .from("team_invitations")
          .select("id, email, status, created_at, expires_at, accepted_at, user_id")
          .order("created_at", { ascending: false }),
      ]);
    if (rolesError) throw new Error(rolesError.message);
    if (invitesError) throw new Error(invitesError.message);

    const userIds = (roles ?? []).map((row) => row.user_id);
    const { data: profiles, error: profilesError } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [], error: null };
    if (profilesError) throw new Error(profilesError.message);

    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    const inviteEmails = new Map(
      (invites ?? []).filter((invite) => invite.user_id).map((invite) => [invite.user_id, invite.email]),
    );

    return {
      members: (roles ?? []).map((row) => ({
        userId: row.user_id,
        role: row.role,
        fullName: names.get(row.user_id) ?? "",
        email: inviteEmails.get(row.user_id) ?? null,
      })),
      invitations: invites ?? [],
    };
  });

export const acceptRepresentativeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = typeof context.claims.email === "string" ? context.claims.email.toLowerCase() : null;
    if (!email) throw new Error("The invitation email could not be verified");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("team_invitations")
      .select("id, user_id, expires_at, status")
      .eq("email", email)
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .maybeSingle();
    if (invitationError) throw new Error(invitationError.message);
    if (!invitation) throw new Error("No pending invitation was found for this account");
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await supabaseAdmin.from("team_invitations").update({ status: "expired" }).eq("id", invitation.id);
      throw new Error("This invitation has expired. Ask the owner for a new invitation.");
    }

    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "rep")
      .maybeSingle();
    if (!role) throw new Error("Representative access was not provisioned for this invitation");

    const { error: updateError } = await supabaseAdmin
      .from("team_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });