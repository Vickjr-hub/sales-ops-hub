## Operator V1 — Telecom Sales Verification

Build on the existing `sales` workflow without redesign or auth changes. All work is concentrated in three existing routes plus one DB column.

### 1. Database

Add one column to `sales` via migration:
- `activation_status text NOT NULL DEFAULT 'Pending Activation'` (values: `Pending Activation`, `Activated`)

Verification is computed client-side from the existing fields — no schema change needed. A sale is **Valid** when all six checks pass; otherwise **Needs Review**:
- `customer_name` non-empty
- `spm_number` exactly 9 characters
- `lines > 0`
- `sale_type` non-empty
- `package_type` non-empty
- `photo_url` non-null

A shared helper `src/lib/saleVerification.ts` returns `{ status, issueCount, checks: [{label, ok}] }`.

### 2. Submit Sale (rep) — `submit-sale.tsx`

Tighten client validation to match verification rules (SPM 9 chars, photo required, lines ≥ 1) so reps cannot create a "Needs Review" sale by accident.

On successful insert, instead of immediately resetting, show an inline **Success Confirmation card** with:
- Customer, SPM, Lines, Submission Date
- **Copy Summary** button → copies formatted block (`Customer:` / `SPM:` / `Lines:` / `Sale Type:` / `Package:` / `Date:`) via `navigator.clipboard`, with toast confirmation
- **Submit Another Sale** button → resets form

### 3. Sales Review (owner) — `sales.tsx`

**Operations Summary strip** at the top — six small cards:
Total Submitted · Pending Review · Approved · Rejected · Pending Activation · Activated.
Counts derived from the same `sales` query (no extra fetches).

**Card-based layout** replacing the single table. Two sections rendered in order:
1. **Needs Review** — sales failing verification (red accent, expanded by default at top)
2. **Valid Sales** — sales passing verification

Each sale card shows:
- Header: customer name, sale date, rep name
- Body: SPM, lines, type, package, photo link, notes
- **Verification panel**: status badge (Valid / Needs Review), issue count, and the six ✓/✗ checks
- **Status badge** (Pending/Approved/Rejected) and **Activation badge** (Pending Activation / Activated)
- Actions: Approve, Reject, **Mark Activated** (only enabled on Approved sales with status `Pending Activation`)

Filters (rep, status, date range) remain. Add an **activation_status** filter.

### 4. Rep view — `my-sales.tsx`

Add **Activation** column showing activation status badge so reps can see post-approval progress. No other changes.

### Files touched

- New migration: add `activation_status` column
- New: `src/lib/saleVerification.ts`
- Edit: `src/routes/_authenticated/submit-sale.tsx` (success confirmation + copy)
- Edit: `src/routes/_authenticated/sales.tsx` (summary, card layout, verification panel, activation action, grouping)
- Edit: `src/routes/_authenticated/my-sales.tsx` (activation column)

### Out of scope (explicitly)

No redesign, no auth changes, no new pages, no mock data, no analytics/graphs, no notifications, no payroll changes.
