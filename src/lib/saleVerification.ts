export type VerificationCheck = { label: string; ok: boolean };
export type VerificationResult = {
  status: "Valid" | "Needs Review";
  issueCount: number;
  checks: VerificationCheck[];
};

type SaleLike = {
  customer_name?: string | null;
  spm_number?: string | null;
  lines?: number | null;
  sale_type?: string | null;
  package_type?: string | null;
  photo_url?: string | null;
};

export function verifySale(s: SaleLike): VerificationResult {
  const checks: VerificationCheck[] = [
    { label: "Customer Name", ok: !!s.customer_name && s.customer_name.trim().length > 0 },
    { label: "SPM Number", ok: !!s.spm_number && s.spm_number.trim().length === 9 },
    { label: "Lines", ok: typeof s.lines === "number" && s.lines > 0 },
    { label: "Sale Type", ok: !!s.sale_type && s.sale_type.trim().length > 0 },
    { label: "Package Type", ok: !!s.package_type && s.package_type.trim().length > 0 },
    { label: "Photo", ok: !!s.photo_url },
  ];
  const issueCount = checks.filter((c) => !c.ok).length;
  return {
    status: issueCount === 0 ? "Valid" : "Needs Review",
    issueCount,
    checks,
  };
}
