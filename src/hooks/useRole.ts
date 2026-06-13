import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/backend-client";

export type AppRole = "owner" | "rep";

export function useRole() {
  const { data, isLoading } = useQuery({
    queryKey: ["current-role"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return { role: null as AppRole | null, userId: null, fullName: "" };

      const [{ data: roleRow }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      return {
        role: (roleRow?.role ?? null) as AppRole | null,
        userId: user.id,
        fullName: profile?.full_name ?? "",
      };
    },
    staleTime: 60_000,
  });

  return {
    role: data?.role ?? null,
    userId: data?.userId ?? null,
    fullName: data?.fullName ?? "",
    isOwner: data?.role === "owner",
    isRep: data?.role === "rep",
    isLoading,
  };
}
