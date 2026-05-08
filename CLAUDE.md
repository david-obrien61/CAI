# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project: Ignition OS

## Status
- Current phase: Active development — pilot prep
- Last worked on: 2026-05-07 — Built IgnitionIntake.jsx (Zone 1), IgnitionEstimate.jsx (Zone 3 service writer), CustomerApprovalPortal.jsx (in-person e-sign), shop_estimate.py Railway estimate agent, supabase_job_lifecycle_migration.sql (13-table schema), wired CustomerApprovalPortal into IgnitionEstimate as fullscreen overlay

## Handoff
> This section is rewritten at the end of every session by whichever AI is finishing.
> The next AI reads this first and picks up from here — no recap needed.
> **CRITICAL:** ALWAYS update the handoff note before we lose context. I do not want to lose any effort.

# PROJECT: ignition-os
# STATUS: ACTIVE DEVELOPMENT
# CURRENT AI: Claude  ← update when you switch

- **Completed this session:** Phase 2a — PDF invoice generation. Added `GET /api/invoices/{invoice_id}/pdf` endpoint to Railway backend using `reportlab`. Pulls invoice + line items + job + shop from Supabase, builds a professional PDF. Wired "Download Invoice PDF" button in `IgnitionInvoice.jsx`. Added `reportlab>=4.0.0` to `requirements.txt`.
- **Next task:** Phase 3 — Hardware Ledger (Supabase migration + KOSK check-in/out UI).
- **Last file edited:** `modules/IgnitionInvoice.jsx`
- **Last command run:** `git push origin main`
- **Tests passing:** Manual — compiles, endpoint responds, PDF downloads
- **Session ended by:** Claude — 2026-05-08

**Prerequisite status:**
- `supabase_inventory_migration.sql` — DONE (run 2026-05-07)
- `supabase_price_override_migration.sql` — DONE (run 2026-05-07)
- `eval-photos` Supabase Storage bucket — DONE (created 2026-05-08, public)

## Dev Commands

**Start everything (recommended):**
```bash
./start.sh          # starts FastAPI :8000 + Vite :5173 + Expo mobile
./start.sh --stop   # kills all three servers
```

**Individual servers:**
```bash
npm run dev                                                        # Vite web only → http://localhost:5173
npm run build                                                      # production web build → dist/
source venv/bin/activate && uvicorn shop_estimate:app --reload --port 8000  # FastAPI only
```

**Python environment setup (first time):**
```bash
python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

**Logs:** `.logs/python.log` and `.logs/web.log` (created by `start.sh`)

**API docs (FastAPI auto-generated):** `http://localhost:8000/docs`

## Environment Variables

Create a `.env` file in the project root:
```
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
VITE_API_URL=        # Railway backend URL for production; http://localhost:8000 for local
```

The Python backend reads these via `python-dotenv`. The Vite frontend reads `VITE_*` vars at build time.

## Architecture
- **Frontend:** React + Vite (web), React Native + Expo (mobile), shared module codebase
- **Routing:** `CoreApp.jsx` — `activeModule` string state switches rendered module; `AccessGatekeeper` wraps modules with `requiredPermissions`
- **Backend:** Python FastAPI on Railway — `ai_router.py` (core app + shared clients), `shop_estimate.py` (estimate agent), `monitor.py` (health)
- **Database:** Supabase (PostgreSQL) at ufsgqckbxdtwviqjjtos.supabase.co — source of truth for all state
- **Local state:** `DataBridge.js` localStorage — device-private scratchpad only, never source of truth
- **AI bundle:** Claude (reasoning + estimate agent via Haiku), Gemini (vision), OpenAI Whisper (voice)
- **Auth:** SHA-256 PIN hashing browser-native via `crypto.subtle.digest`, salted with shopId
- **Env:** `VITE_API_URL` for all Railway calls — never hardcode localhost

**Dual-runtime file naming:**
- `ModuleName.jsx` — web (React + Vite)
- `ModuleName.native.js` — React Native / Expo mobile
- Both live in `modules/`. When editing a module, check if a `.native.js` counterpart exists and needs the same change.

**Key design decisions:**
- Supabase is source of truth; localStorage is scratchpad. All status transitions write to Supabase.
- Jobs INSERT writes both FK columns (customer_id, vehicle_id) AND legacy jsonb columns (customer, vehicle) for backward compat with older modules.
- `customer_authorizations.authorized_line_ids` and `declined_line_ids` are UUID arrays frozen at auth time — legal snapshot, never mutated.
- `invoice_line_items` are immutable snapshots; never updated after creation.
- Tax on parts only — `tax = subtotal_parts × taxRate`. Labor and fees are not taxed.
- `_get_labor_hours()` in shop_estimate.py is the Mitchell1/AllData swap point — change only that function body, pipeline unchanged.
- `_source_parts()` in shop_estimate.py is the vendor API swap point — same isolation pattern.
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
10. supabase_inventory_migration.sql
11. supabase_price_override_migration.sql

**Key tables:**

| Table | Purpose |
|---|---|
| customers | CRM records |
| customer_vehicles | VIN history per customer |
| jobs | Core repair order |
| evaluations | Tech eval doc (work_items jsonb) |
| dtc_codes | Structured fault codes — queryable rows |
| eval_photos | Photos from tech eval |
| estimates | Agent-generated estimate container |
| estimate_line_items | Per-line: item_type, labor_hours, unit_price, line_total, auth_status |
| customer_authorizations | Legal snapshot: authorized_line_ids uuid[], declined_line_ids uuid[] |
| labor_entries | Clock in/out records |
| repair_logs | Repair outcomes, parts used |
| invoices | Final invoice |
| invoice_line_items | Immutable snapshot of authorized line items |

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
- [x] Invoice + closeout: generate invoice from authorized estimate_line_items → invoice_line_items snapshot → payment collection → jobs.status='closed'
- [x] Migrate FLUX, KOSK, OMNI to read job state from Supabase instead of localStorage
- [x] Repair workflow: labor clock-in/out during repair, repair_logs entries, supplement branch detection

**Backlog (post-pilot):**
- [x] Slab margin pricing engine UI — PriceField wired into PART line items in IgnitionEstimate, Relationship Tax metadata saved to Supabase
- [x] PDF invoice generation — GET /api/invoices/{id}/pdf on Railway, reportlab server-side, download button in IgnitionInvoice
- [ ] Hardware ledger and tool tracking (STOK extension)
- [ ] Velocity leaderboard in OMNI (efficiency % per tech, management toggle)
- [ ] Multi-location registry and quick-dial hub
- [ ] 14-day trial savings report (conversion hook)
- [ ] Tiered access controller (LITE/PRO/PLATINUM feature flags)
- [ ] SMS estimate delivery (vs. in-person portal only)
- [ ] Staff revocation with two-step confirm ("nuke" option)
- [ ] Multi-day job suspension with DO NOT MOVE flag

## Off Limits / Don't Touch
- `supabase.js` — Supabase client config; do not change connection details
- `DataBridge.js` — core persistence layer; do not remove existing keys or change the save/load API
- `AIEngine.js` — AI orchestration; changes need full context of all three AI providers
- `MarginEngine.js` — pricing logic used across multiple modules; do not change calculation formulas without a business decision
- `dist/` — build output, never edit directly
- `__pycache__/` — never commit
- `.vercel/` — deployment config, never commit
- All `supabase_*_migration.sql` files that have already been run in production — append new migrations instead of editing existing ones

## Shop Floor Philosophy: The Soft-Gated Workflow
**Golden Rule:** If it takes more clicks than writing on paper, the techs won't use it.
- Hide time clocks behind natural physical actions. Do not use generic "Punch In" buttons.
- **Eval Phase:** Clock auto-starts when VIN is validated (`IgnitionVIN` gate). Clock auto-stops when Eval is submitted.
- **Repair Phase:** Clock auto-starts when parts are acknowledged ("Parts in Bay"). Clock auto-stops when QC is completed and job is slid to complete.
- **CRITICAL RULE FOR AI:** Never rebuild existing functionality. Always check the `/modules` folder for pre-built components (like `IgnitionVIN`) before proposing dummy fallbacks or placeholder buttons.

## Compliance & PII Guardrails
- **What PII we can store:** Customer Name, Phone Number, Email, Physical Address, and VIN.
- **Where we can store PII:** ONLY in the `customers` and `customer_vehicles` Supabase tables.
- **Local Storage:** Never store unencrypted PII in `DataBridge` or `localStorage`. Use UUID references instead.
- **AI/External APIs:** Never send raw PII (Name, Phone, Email) to external LLMs or unauthorized third-party APIs. Anonymize payloads before sending.
- **Audit:** Maintain strict audit logs for any bulk export or deletion of PII.

## Coding Standards
- **Language:** JSX/React with hooks for frontend; Python 3 with FastAPI + Pydantic for backend
- **Styling:** Tailwind CSS only — dark slate palette (`bg-slate-950` screens, `bg-slate-900` cards, `border-slate-800` borders)
- **Icons:** Lucide React only — no other icon libraries
- **Accent colors:** Blue for actions, Emerald for success, Amber for warnings, Red for errors
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
