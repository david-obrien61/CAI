# CLAUDE.md — Ignition OS
## Project context for Claude Code (persistent across sessions)

---

## What This Is

**Ignition OS** — a composable AI-powered shop management platform for diesel/auto repair shops. Version 1 beachhead. Built to expand into food service, HVAC, and field service using the same 80%+ shared codebase. The architecture is already industry-agnostic; only the tiles, prompts, and integration blocks change per vertical.

Owner/founder: Terrence / David O'Brien. Leander TX. Non-technical founder building with AI assistance. Thinks in business/product terms. Prefers strategic alignment before implementation, then fast execution. Pilot target: independent shops in Liberty Hill / Georgetown / Round Rock / North Austin TX.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (web), React Native + Expo (mobile) |
| Routing | `CoreApp.jsx` — `activeModule` state string switches rendered module |
| Persistence | Supabase (PostgreSQL) as source of truth; localStorage via `DataBridge.js` as device-private scratchpad |
| Backend | Python FastAPI on Railway (`ai_router.py`, `shop_estimate.py`, `monitor.py`) |
| AI | Claude (reasoning/estimate agent), Gemini (vision), OpenAI Whisper (voice) |
| Auth | SHA-256 PIN hashing in-browser (`crypto.subtle.digest`), salted with `shopId` |
| Env | `VITE_API_URL` env var for Railway backend URL in all frontend API calls |

---

## Database (Supabase)

**Project:** ufsgqckbxdtwviqjjtos.supabase.co

**RLS pilot pattern** — all tables use:
```sql
DROP POLICY IF EXISTS "pilot_all" ON table_name;
CREATE POLICY "pilot_all" ON table_name FOR ALL USING (true) WITH CHECK (true);
```
All migrations use `DROP TRIGGER/POLICY IF EXISTS` before creation so they are safely re-runnable.

**Migration files (run in this order):**
1. `supabase_schema.sql` — core tables: shops, users, jobs, purchase_orders, tools, pmi_schedules, ai_usage
2. `supabase_rls_pilot.sql` — pilot RLS on all core tables
3. `supabase_identity_v2_migration.sql` — teams, shop_members, member_devices
4. `supabase_team_system_migration.sql` — shop_invites, pin_resets
5. `supabase_job_lifecycle_migration.sql` — full repair order lifecycle (13 tables)
6. `supabase_concept_aliases_migration.sql`
7. `supabase_error_events_migration.sql`
8. `supabase_feature_events_migration.sql`
9. `supabase_monitoring_alerts_migration.sql`

**Job lifecycle state machine:**
```
intake → queued → in_eval → eval_done → estimating → pending_auth
→ authorized → in_repair → supplement → repair_done → invoiced → closed
```

**Key tables from `supabase_job_lifecycle_migration.sql`:**
- `customers` — CRM record (moved from localStorage)
- `customer_vehicles` — VIN history, mileage_last
- `jobs` — extended with customer_id, vehicle_id, complaint, mileage_in/out, bay_id, promised_at, waiting_status; jsonb snapshots (customer, vehicle) kept for legacy module compat
- `evaluations` — tech eval doc, status (draft/submitted/superseded), work_items jsonb
- `dtc_codes` — structured fault codes as queryable rows (not buried in jsonb)
- `eval_photos` — storage_url, photo_type, caption
- `estimates` — agent container, parent_estimate_id for supplements, full status lifecycle
- `estimate_line_items` — per-row auth_status (pending/approved/declined), item_type, labor_hours, unit_cost, unit_price, line_total
- `customer_authorizations` — `authorized_line_ids uuid[]` + `declined_line_ids uuid[]` as legal snapshot frozen at auth time
- `labor_entries` — clock in/out, partial index on open entries (WHERE clocked_out IS NULL)
- `repair_logs` — outcome, parts_used jsonb
- `invoices` — status (draft/open/paid/voided)
- `invoice_line_items` — immutable snapshot with source_line_item_id FK

---

## Backend (Railway)

**`ai_router.py`** — core FastAPI app + shared clients (`_supabase`, `_anthropic_client`, `_log_usage`, `_log_error`)

**`shop_estimate.py`** — estimate agent, imported from `ai_router`:
- `POST /api/estimate/build` — 9-step pipeline: load estimate → load eval → load DTC codes → load job/vehicle → call `_get_labor_hours()` (Claude Haiku) → apply margin engine → INSERT estimate_line_items → UPDATE estimates → UPDATE jobs
- `_get_labor_hours()` is isolated: documented as Mitchell1/AllData swap point — change function body only, pipeline unchanged
- Margin engine: PART `unit_price = unit_cost × (1 + markup/100)`, LABOR `line_total = hours × labor_rate`, tax on parts only (most US states don't tax labor)

**`monitor.py`** — health monitoring, included in Railway Dockerfile COPY

---

## Frontend Modules (current build status)

### Zone 1 — Intake
- **`modules/IgnitionIntake.jsx`** ✅ COMPLETE
  - 3-phase web form: Customer → Vehicle → Job Details
  - Debounced Supabase customer search (300ms, ilike on phone/last_name/first_name)
  - Phase 2: load customer vehicles from Supabase, tap-to-select or create new
  - Submit: INSERT customers (if new) → INSERT/UPDATE customer_vehicles → INSERT jobs with status='intake'
  - WO number: `RO-{year}-{random4digits}`
  - `onJobCreated(job)` callback → CoreApp routes to FLUX

### Zone 3 — Service Writer / Estimate
- **`modules/IgnitionEstimate.jsx`** ✅ COMPLETE
  - Views: QUEUE → REVIEW → SENT → AUTHORIZED
  - QUEUE: loads jobs in (eval_done, estimating, ready, pending_auth), color-coded badges
  - REVIEW: job summary card, AI build trigger, inline-editable line items (`EditableCell`), manual add row, totals block
  - `buildEstimate()`: creates estimate row if missing, DELETEs existing items if rebuilding, POSTs to `/api/estimate/build`
  - `sendToCustomer()`: UPDATE estimates.status='sent', UPDATE jobs.status='pending_auth'
  - "Open Customer Authorization Portal" button appears when estimate is sent/pending_auth
  - `handleAuthorized()`: re-fetches estimate + job, navigates to AUTHORIZED view
  - Portal renders as `fixed inset-0 z-50` overlay

- **`modules/CustomerApprovalPortal.jsx`** ✅ COMPLETE
  - Props: `{ estimateId, jobId, shopId, onAuthorized, onClose }`
  - Loads estimate + line_items + job from Supabase on mount
  - Default: all items approved; per-line green check / red X toggle
  - Running totals update live as decisions change; tax on parts only
  - `react-signature-canvas` signature field + consent checkbox
  - Authorize button disabled until: hasSignature && consent && approvedItems.length > 0
  - On authorize: UPDATE each estimate_line_items.auth_status → INSERT customer_authorizations (UUID array snapshot) → UPDATE estimates.status='authorized' → UPDATE jobs.status='authorized'
  - AuthorizedScreen component (auto-calls onAuthorized after 2.2s)

### Other Existing Modules
- `IgnitionFlux.jsx` — job flow / bay assignment
- `IgnitionKosk.jsx` — tech kiosk (clock in/out, labor log, parts scan)
- `IgnitionOmni.jsx` / `IgnitionOmniDashboard.jsx` — owner analytics
- `IgnitionCipher.jsx` — DTC decode
- `IgnitionStok.jsx` — inventory
- `IgnitionProc.jsx` / `IgnitionProcure.jsx` — procurement
- `IgnitionPort.jsx` — customer portal (legacy; CustomerApprovalPortal.jsx is the new in-person auth version)
- `IgnitionHub.jsx` — dispatch / GPS
- `IgnitionCompliance.jsx` — DOT/PMI forms
- `IgnitionCRM.jsx` — customer records
- `IgnitionVIN.jsx` — VIN decode
- `IgnitionVoice.jsx` — voice command
- `AdminSubscription.jsx` — subscription/marketplace
- `OnboardingWizard.jsx` — shop setup

### Core Infrastructure
- **`CoreApp.jsx`** — main shell, `activeModule` router, `AccessGatekeeper` permission wrapper, bottom nav
- **`DataBridge.js`** — localStorage persistence layer, `smartSync` for offline queue
- **`AIEngine.js`** — frontend AI call orchestration
- **`MarginEngine.js`** — slab pricing logic
- **`supabase.js`** — Supabase client
- **`EnrollmentCatch.jsx`** — PIN setup flow
- **`IgnitionCore.js`** — session guard, routing

---

## Key Architectural Decisions (don't change without reason)

1. **Supabase is source of truth.** localStorage is device-private scratchpad only. All state transitions write to Supabase.
2. **Jobs INSERT writes both FK columns AND legacy jsonb columns** (`customer`, `vehicle` jsonb) so old modules that read from jsonb continue to work.
3. **Legal authorization snapshot is immutable.** `customer_authorizations.authorized_line_ids` and `declined_line_ids` are UUID arrays frozen at auth time — survive future edits to estimate_line_items.
4. **Invoice line items are immutable snapshots.** Never updated after creation; `source_line_item_id` FK traces back.
5. **Tax on parts only.** Most US states don't tax labor. Tax = `subtotal_parts × taxRate`.
6. **`_get_labor_hours()` is the Mitchell1 swap point.** Change only that function body to integrate real labor time data. Pipeline unchanged.
7. **AccessGatekeeper wraps all sensitive modules** with `requiredPermissions` check.
8. **`VITE_API_URL` env var**, never hardcode localhost in production code.

---

## What's Next (build queue)

### Immediate
- [ ] Zone 2 tech eval extension: structured DTC capture, photo upload, labor clock-in/out → writes to evaluations, dtc_codes, eval_photos, labor_entries
- [ ] Parts sourcing trigger: after authorization, split approved items into in-stock (pull from inventory) vs. order (create PO)

### After That
- [ ] Repair workflow: labor clock, repair_logs entries, supplement branch detection
- [ ] Invoice + payment + closeout: derive invoice from authorized estimate_line_items → invoice_line_items snapshot → collect payment → close job

### Backlog (from Gemini inbox)
- Slab margin pricing engine UI (MarginEngine.js exists, needs wiring into estimate flow)
- Velocity leaderboard (OMNI) with management toggle
- Hardware ledger & tool tracking (STOK extension)
- Multi-location registry & quick-dial hub
- Voice command (WebSpeechAPI)
- PDF manifest generation for invoices and DOT forms
- Trial-to-paid conversion hook (14-day savings report)
- Tiered access controller (LITE/PRO/PLATINUM module gating)

---

## Pricing Tiers (for context)
- STARTER $149/mo — 3 users, no AI
- PROFESSIONAL $299/mo — 8 users, AI bundle
- PREMIER $499/mo — unlimited users, everything
- 14-day trial = full PREMIER. Day 12 savings report. Day 15 data blurs.
