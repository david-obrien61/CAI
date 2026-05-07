# Project: Ignition OS

## Status
- Current phase: Active development — pilot prep
- Last worked on: 2026-05-07 — Built IgnitionIntake.jsx (Zone 1 intake), IgnitionEstimate.jsx (Zone 3 service writer), CustomerApprovalPortal.jsx (in-person e-sign authorization), shop_estimate.py Railway estimate agent, supabase_job_lifecycle_migration.sql (13-table schema). All committed to main.

## Handoff
> This section is rewritten at the end of every session by whichever AI is finishing.
> Read this first — it tells you exactly where to pick up.

- **Completed this session:** Parts sourcing trigger implemented in `IgnitionEstimate.jsx`'s `handleAuthorized`. Generates `purchase_orders` in Supabase for out-of-stock parts comparing against a mock STOK inventory.
- **Next task:** Invoice + closeout: generate invoice from authorized estimate_line_items → invoice_line_items snapshot → payment → jobs.status='closed'
- **Prerequisite note for pilot:** `eval-photos` Supabase Storage bucket must be created manually in the Supabase dashboard before photo upload in `IgnitionEval.jsx` works. Bucket name: `eval-photos`, set to public.
- **Also pending:** Migrate `IgnitionFlux`, `IgnitionKosk`, `IgnitionOmni` from localStorage reads to Supabase queries.
- **Session ended by:** Gemini — 2026-05-07

**Collaboration workflow:**
1. Generate feature specs or code snippets in Gemini web session
2. Paste output into `gemini_staging_inbox.md` pending section
3. Tell Claude Code in chat: "look at the inbox and implement [feature]"
4. Claude builds it natively, checks it off in the inbox, updates this file with status changes

## Architecture
- **Frontend:** React + Vite (web), React Native + Expo (mobile), shared module codebase
- **Routing:** `CoreApp.jsx` — `activeModule` string switches rendered module; `AccessGatekeeper` wraps modules with `requiredPermissions`
- **Backend:** Python FastAPI on Railway — `ai_router.py` (core app + shared clients), `shop_estimate.py` (estimate agent), `monitor.py` (health)
- **Database:** Supabase (PostgreSQL) — source of truth for all state. Tables scoped by shop_id.
- **Local state:** `DataBridge.js` localStorage — device-private scratchpad only, never source of truth
- **AI bundle:** Claude (reasoning + estimate agent), Gemini (vision), OpenAI Whisper (voice)
- **Styling:** Tailwind CSS — dark slate palette, high-contrast shop floor UI
- **Icons:** Lucide React only

**Key design decisions (generate code that respects these):**
- Supabase is source of truth. localStorage is scratchpad only.
- Jobs always write both FK columns (customer_id, vehicle_id) AND legacy jsonb columns (customer, vehicle) — backward compat with older modules that read jsonb.
- Legal authorization snapshot (`customer_authorizations`) is immutable once written — UUID arrays frozen at auth time.
- Invoice line items are immutable snapshots. Never update after creation.
- Tax on parts only: `tax = subtotal_parts × taxRate`. Labor is not taxed.
- All SQL migrations must include `DROP TRIGGER/POLICY IF EXISTS` guards — must be re-runnable.
- Never hardcode localhost. Always use `VITE_API_URL` env var for Railway backend calls.
- RLS pilot pattern: `CREATE POLICY "pilot_all" FOR ALL USING (true) WITH CHECK (true)` on every table.

**Job lifecycle state machine:**
```
intake → queued → in_eval → eval_done → estimating → pending_auth
→ authorized → in_repair → supplement → repair_done → invoiced → closed
```

**Module build status:**
- `IgnitionIntake.jsx` ✅ — 3-phase intake form, writes customers/customer_vehicles/jobs to Supabase
- `IgnitionEstimate.jsx` ✅ — service writer queue, AI build trigger, inline editing, send flow, CustomerApprovalPortal overlay
- `CustomerApprovalPortal.jsx` ✅ — per-line approve/decline, e-sign, writes auth snapshot + updates estimate/job status
- `shop_estimate.py` ✅ — Railway estimate agent: POST /api/estimate/build
- `IgnitionFlux.jsx` — exists, reads from localStorage (not yet migrated to Supabase)
- `IgnitionKosk.jsx` — exists, reads from localStorage (not yet migrated to Supabase)
- `IgnitionOmni.jsx` — exists, reads from localStorage (not yet migrated to Supabase)
- All other modules (Cipher, STOK, PROC, PORT, HUB, Compliance, CRM, VIN, Voice) — exist, pre-migration state

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

## Active Tasks
- [x] Zone 2 — Tech eval UI: `IgnitionEval.jsx` — DTC codes, photos, work items, labor clock, submit → eval_done
- [x] Parts sourcing trigger: after authorization, split approved line items → in-stock pull vs. PO creation for out-of-stock
- [ ] Invoice + closeout: generate invoice from authorized estimate_line_items → invoice_line_items snapshot → payment → jobs.status='closed'
- [ ] Migrate FLUX, KOSK, OMNI to read job state from Supabase instead of localStorage
- [ ] Repair workflow: labor clock-in/out, repair_logs entries, supplement branch detection

**Backlog (post-pilot):**
- [ ] Slab margin pricing engine UI (MarginEngine.js exists, needs wiring into estimate flow)
- [ ] PDF invoice and DOT form generation
- [ ] Hardware ledger and tool tracking
- [ ] Velocity leaderboard in OMNI (efficiency % per tech, management toggle)
- [ ] Multi-location registry and quick-dial hub
- [ ] 14-day trial savings report (conversion hook)
- [ ] Tiered access controller (LITE/PRO/PLATINUM feature flags)
- [ ] SMS estimate delivery (vs. in-person portal only)
- [ ] Staff revocation with two-step confirm ("nuke" option)
- [ ] Multi-day job suspension with DO NOT MOVE flag

## Off Limits / Don't Touch
- `supabase.js` — client config, do not change
- `DataBridge.js` — do not remove existing keys or change the save/load API
- `AIEngine.js` — changes need full context of all three AI providers
- `MarginEngine.js` — pricing formulas, do not change without a business decision
- `dist/`, `__pycache__/`, `.vercel/` — never include in generated code or suggestions
- Already-run SQL migration files — append new migrations, never edit existing ones

## Coding Standards
- **Language:** JSX/React with hooks for frontend; Python 3 + FastAPI + Pydantic for backend
- **Styling:** Tailwind CSS dark slate palette — `bg-slate-950` screens, `bg-slate-900` cards, `border-slate-800` borders
- **Accent colors:** Blue for actions, Emerald for success, Amber for warnings, Red for errors
- **Icons:** Lucide React only
- **No emojis** in code or UI
- **No comments** unless the WHY is non-obvious
- **Naming:** PascalCase components, camelCase functions/variables
- **UI heading style:** `text-white font-black italic uppercase tracking-tighter`
- **Primary CTA buttons:** `py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]`
- **Status badges:** `text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border`
- **API calls:** always use `VITE_API_URL` env var
- **Supabase writes:** always handle errors with user-facing error state
