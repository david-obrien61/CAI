# Project: Ignition OS

## Status
- Current phase: Active development — pilot prep
- Last worked on: 2026-05-07 — Built IgnitionIntake.jsx (Zone 1), IgnitionEstimate.jsx (Zone 3 service writer), CustomerApprovalPortal.jsx (in-person e-sign), shop_estimate.py Railway estimate agent, supabase_job_lifecycle_migration.sql (13-table schema), wired CustomerApprovalPortal into IgnitionEstimate as fullscreen overlay

## Handoff
> This section is rewritten at the end of every session by whichever AI is finishing.
> The next AI reads this first and picks up from here — no recap needed.

- **Completed this session:** Parts sourcing trigger implemented in `IgnitionEstimate.jsx`'s `handleAuthorized`. Generates `purchase_orders` in Supabase for out-of-stock parts comparing against a mock STOK inventory.
- **Next task:** Invoice + closeout: generate invoice from authorized estimate_line_items → invoice_line_items snapshot → payment collection → jobs.status='closed'
- **Prerequisite note:** `eval-photos` Supabase Storage bucket must be created manually in the Supabase dashboard before photo upload works. Bucket name: `eval-photos`, set to public.
- **Also pending:** Migrate `IgnitionFlux`, `IgnitionKosk`, `IgnitionOmni` from localStorage to Supabase queries.
- **Session ended by:** Gemini — 2026-05-07

## Architecture
- **Frontend:** React + Vite (web), React Native + Expo (mobile), shared module codebase
- **Routing:** `CoreApp.jsx` — `activeModule` string state switches rendered module; `AccessGatekeeper` wraps modules with `requiredPermissions`
- **Backend:** Python FastAPI on Railway — `ai_router.py` (core app + shared clients), `shop_estimate.py` (estimate agent), `monitor.py` (health)
- **Database:** Supabase (PostgreSQL) at ufsgqckbxdtwviqjjtos.supabase.co — source of truth for all state
- **Local state:** `DataBridge.js` localStorage — device-private scratchpad only, never source of truth
- **AI bundle:** Claude (reasoning + estimate agent via Haiku), Gemini (vision), OpenAI Whisper (voice)
- **Auth:** SHA-256 PIN hashing browser-native via `crypto.subtle.digest`, salted with shopId
- **Env:** `VITE_API_URL` for all Railway calls — never hardcode localhost

**Key design decisions:**
- Supabase is source of truth; localStorage is scratchpad. All status transitions write to Supabase.
- Jobs INSERT writes both FK columns (customer_id, vehicle_id) AND legacy jsonb columns (customer, vehicle) for backward compat with older modules.
- `customer_authorizations.authorized_line_ids` and `declined_line_ids` are UUID arrays frozen at auth time — legal snapshot, never mutated.
- `invoice_line_items` are immutable snapshots; never updated after creation.
- Tax on parts only — `tax = subtotal_parts × taxRate`. Labor and fees are not taxed.
- `_get_labor_hours()` in shop_estimate.py is the Mitchell1/AllData swap point — change only that function body, pipeline unchanged.
- All SQL migrations use `DROP TRIGGER/POLICY IF EXISTS` before creation — safely re-runnable.
- RLS pilot pattern: `DROP POLICY IF EXISTS` + `CREATE POLICY "pilot_all" FOR ALL USING (true) WITH CHECK (true)` on every table.

**Job lifecycle state machine:**
```
intake → queued → in_eval → eval_done → estimating → pending_auth
→ authorized → in_repair → supplement → repair_done → invoiced → closed
```

**Migration run order:**
1. supabase_schema.sql
2. supabase_rls_pilot.sql
3. supabase_identity_v2_migration.sql
4. supabase_team_system_migration.sql
5. supabase_job_lifecycle_migration.sql
6. supabase_concept_aliases_migration.sql
7. supabase_error_events_migration.sql
8. supabase_feature_events_migration.sql
9. supabase_monitoring_alerts_migration.sql

**Module build status:**
- `IgnitionIntake.jsx` ✅ — 3-phase intake form, writes customers/customer_vehicles/jobs to Supabase
- `IgnitionEstimate.jsx` ✅ — service writer queue, AI build trigger, inline editing, send flow, CustomerApprovalPortal overlay
- `CustomerApprovalPortal.jsx` ✅ — per-line approve/decline, e-sign, writes auth snapshot + updates estimate/job status
- `shop_estimate.py` ✅ — Railway estimate agent: POST /api/estimate/build
- `IgnitionFlux.jsx` — exists, reads from localStorage (not yet migrated to Supabase)
- `IgnitionKosk.jsx` — exists, reads from localStorage (not yet migrated to Supabase)
- `IgnitionOmni.jsx` — exists, reads from localStorage (not yet migrated to Supabase)
- All other modules (Cipher, STOK, PROC, PORT, HUB, Compliance, CRM, VIN, Voice) — exist, pre-migration state

## Active Tasks
- [x] Zone 2 — Tech eval UI: `IgnitionEval.jsx` — DTC codes, photos, work items, labor clock, submit → eval_done
- [x] Parts sourcing trigger: after authorization split approved line items → in-stock pull vs. PO creation for out-of-stock
- [ ] Invoice + closeout: generate invoice from authorized estimate_line_items → invoice_line_items snapshot → payment collection → jobs.status='closed'
- [ ] Migrate FLUX, KOSK, OMNI to read job state from Supabase instead of localStorage
- [ ] Repair workflow: labor clock-in/out during repair, repair_logs entries, supplement branch detection

**Backlog (post-pilot):**
- [ ] Slab margin pricing engine UI (MarginEngine.js exists, needs wiring into estimate flow)
- [ ] PDF invoice and DOT form generation
- [ ] Hardware ledger and tool tracking (STOK extension)
- [ ] Velocity leaderboard in OMNI (efficiency % per tech, management toggle)
- [ ] Multi-location registry and quick-dial hub
- [ ] 14-day trial savings report (conversion hook)
- [ ] Tiered access controller (LITE/PRO/PLATINUM feature flags)
- [ ] SMS estimate delivery (vs. in-person portal only)

## Off Limits / Don't Touch
- `supabase.js` — Supabase client config; do not change connection details
- `DataBridge.js` — core persistence layer; do not remove existing keys or change the save/load API
- `AIEngine.js` — AI orchestration; changes need full context of all three AI providers
- `MarginEngine.js` — pricing logic used across multiple modules; do not change calculation formulas without a business decision
- `dist/` — build output, never edit directly
- `__pycache__/` — never commit
- `.vercel/` — deployment config, never commit
- All `supabase_*_migration.sql` files that have already been run in production — append new migrations instead of editing existing ones

## Coding Standards
- **Language:** JSX/React with hooks for frontend; Python 3 with FastAPI + Pydantic for backend
- **Styling:** Tailwind CSS only — dark slate palette (`bg-slate-950` screens, `bg-slate-900` cards, `border-slate-800` borders)
- **Icons:** Lucide React only — no other icon libraries
- **No emojis** in code, UI, or file content unless explicitly requested
- **No comments** unless the WHY is non-obvious — no docblocks, no "this function does X" comments
- **Naming:** PascalCase for components, camelCase for functions/variables, SCREAMING_SNAKE for constants
- **Heading style:** `text-white font-black italic uppercase tracking-tighter` — this is the brand voice in UI
- **Button style (primary CTA):** `py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]`
- **Badge style:** `text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border`
- **API calls:** always use `VITE_API_URL` env var, never hardcode localhost
- **Supabase writes:** always handle errors; show user-facing error state; never silently swallow failures
- **No backwards-compat shims** — if something is fully replaced, delete the old version
- **New SQL migrations:** must include `DROP TRIGGER/POLICY IF EXISTS` guards; must be re-runnable
