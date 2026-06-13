import { ReactNode } from "react";
import { useRole } from "@/hooks/useRole";
import { Navigate } from "@tanstack/react-router";

export function OwnerOnly({ children }: { children: ReactNode }) {
  const { role, isLoading } = useRole();
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!role) return <p className="text-destructive">This account does not have access to Operator. Contact your owner.</p>;
  if (role !== "owner") return <Navigate to="/my-sales" replace />;
  return <>{children}</>;
}

export function RepOnly({ children }: { children: ReactNode }) {
  const { role, isLoading } = useRole();
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!role) return <p className="text-destructive">This account does not have access to Operator. Contact your owner.</p>;
  if (role !== "rep") return <Navigate to="/" replace />;
  return <>{children}</>;
}
