# CLAUDE.md — Ignition OS
> **For Claude Code only.** Gemini/Antigravity reads GEMINI.md (identical rules, separate file).
> Read this file top to bottom before writing a single line of code.

---

# PROJECT: Ignition OS
# STATUS: 🟢 ACTIVE DEVELOPMENT — Pilot Prep
# CURRENT AI: Claude ← update when you switch

---

## 0. Pilot Definition
> Pilot = single shop, single location, real customers, real repair orders.

Pilot is NOT complete until:
- [ ] All job lifecycle states work end-to-end: intake → closed
- [ ] IgnitionFlux and IgnitionOmni read from Supabase (not localStorage)
- [ ] `supabase_hardware_ledger_migration.sql` run in production
- [ ] At least one real RO processed start to finish without intervention
- [ ] No module reads from localStorage as source of truth

---

## 1. Handoff
> Rewritten at the end of every session. Read this first — no recap needed.
> **CRITICAL:** Update BOTH `CLAUDE.md` AND `GEMINI.md` before ending any session.

- **Session ended by:** Claude — 2026-05-08
- **Completed this session:** Phase 3 Hardware Ledger — created `supabase_hardware_ledger_migration.sql` (extends tools table + new tool_signout_log). Built `modules/IgnitionTools.jsx`: tool registry, PMI status badges, add tool form, bay custody toggle, manager bypass log viewer. Modified `modules/IgnitionKosk.jsx`: gated tool acknowledgment before SlideToComplete (active only when enable_bay_custody=ON), inline manager bypass form writes to tool_signout_log with is_manager_bypass=true. Wired TOOLS into `CoreApp.jsx` (import, route, dashboard grid).
- **Next task:** Velocity leaderboard in OMNI (efficiency % per tech, management toggle) OR migrate IgnitionFlux + IgnitionOmni from localStorage to Supabase.
- **Last file edited:** `CoreApp.jsx`
- **Last command run:** `git push origin main` (commit 7d011511)
- **Tests passing:** Manual compile only — migration NOT yet run in Supabase
- **⚠️ Pending manual step:** Run `supabase_hardware_ledger_migration.sql` in Supabase Dashboard before tools UI will work

**Migration prerequisite status:**
| Migration | Status |
|---|---|
| supabase_schema.sql | ✅ Run |
| supabase_rls_pilot.sql | ✅ Run |
| supabase_identity_v2_migration.sql | ✅ Run |
| supabase_team_system_migration.sql | ✅ Run |
| supabase_job_lifecycle_migration.sql | ✅ Run |
| supabase_concept_aliases_migration.sql | ✅ Run |
| supabase_error_events_migration.sql | ✅ Run |
| supabase_feature_events_migration.sql | ✅ Run |
| supabase_monitoring_alerts_migration.sql | ✅ Run |
| supabase_inventory_migration.sql | ✅ Run (2026-05-07) |
| supabase_price_override_migration.sql | ✅ Run (2026-05-07) |
| supabase_hardware_ledger_migration.sql | ⚠️ NEEDS TO BE RUN |

---

## 2. Architecture

- **Frontend:** React + Vite (web), React Native + Expo (mobile), shared module codebase
- **Routing:** `CoreApp.jsx` — `activeModule` string state switches rendered module; `AccessGatekeeper` wraps modules with `requiredPermissions`
- **Backend:** Python FastAPI on Railway — `ai_router.py` (core app + shared clients), `shop_estimate.py` (estimate agent), `monitor.py` (health)
- **Database:** Supabase (PostgreSQL) at ufsgqckbxdtwviqjjtos.supabase.co — **source of truth for all state**
- **Local state:** `DataBridge.js` localStorage — device-private scratchpad only, **never source of truth**
- **AI bundle:** Claude (reasoning + estimate agent via Haiku), Gemini (vision), OpenAI Whisper (voice)
- **Auth:** SHA-256 PIN hashing browser-native via `crypto.subtle.digest`, salted with shopId
- **Env:** `VITE_API_URL` for all Railway calls — never hardcode localhost

**Dual-runtime file naming:**
- `ModuleName.jsx` — web (React + Vite)
- `ModuleName.native.js` — React Native / Expo mobile
- Both live in `modules/`. When editing a module, check if a `.native.js` counterpart exists and needs the same change.

**Key design decisions:**
- Supabase is source of truth; localStorage is scratchpad only. All status transitions write to Supabase.
- Jobs INSERT writes both FK columns (customer_id, vehicle_id) AND legacy jsonb columns (customer, vehicle) for backward compat.
- `customer_authorizations.authorized_line_ids` and `declined_line_ids` are UUID arrays frozen at auth time — legal snapshot, never mutated.
- `invoice_line_items` are immutable snapshots; never updated after creation.
- Tax on parts only — `tax = subtotal_parts × taxRate`. Labor and fees are not taxed.
- `_get_labor_hours()` in shop_estimate.py is the Mitchell1/AllData swap point — change only that function body.
- `_source_parts()` in shop_estimate.py is the vendor API swap point — same isolation pattern.
- All SQL migrations use `DROP TRIGGER/POLICY IF EXISTS` before creation — safely re-runnable.
- RLS pilot pattern: `DROP POLICY IF EXISTS` + `CREATE POLICY "pilot_all" FOR ALL USING (true) WITH CHECK (true)`.

**Job lifecycle state machine:**
```
intake → queued → in_eval → eval_done → estimating → pending_auth
→ authorized → in_repair → supplement → repair_done → invoiced → closed
```

---

## 3. Module Map

> When a feature request comes in, check this map FIRST before proposing where it belongs.
> Adding a new module requires 3 touch points in CoreApp.jsx: import, route case, dashboard grid entry.

| Module | Purpose | Status |
|---|---|---|
| IgnitionIntake.jsx | New RO creation, customer/vehicle intake | ✅ Live |
| IgnitionEval.jsx | Tech evaluation, DTC codes, photos, labor clock | ✅ Live |
| IgnitionEstimate.jsx | Service writer queue, AI estimate build, auth portal | ✅ Live |
| CustomerApprovalPortal.jsx | Per-line approve/decline, e-sign, auth snapshot | ✅ Live |
| IgnitionKosk.jsx | Tech floor interface, repair workflow, tool custody gate | ✅ Live |
| IgnitionTools.jsx | Tool registry, PMI tracking, bay custody toggle, bypass log | ✅ Live (migration pending) |
| IgnitionInvoice.jsx | Invoice generation, payment collection, job close | ✅ Live |
| IgnitionFlux.jsx | Job board / dispatch view | ⚠️ localStorage only — needs Supabase migration |
| IgnitionOmni.jsx | Management dashboard, reporting, leaderboard | ⚠️ localStorage only — needs Supabase migration |
| IgnitionProc.jsx | Vendor procurement, PO management, parts-run vehicle sign-out | 🔲 Pre-migration |
| IgnitionHub.jsx | Dispatch, service calls, wrecker/after-hours vehicle sign-out | 🔲 Pre-migration |
| IgnitionCipher.jsx | Auth, PIN management, role permissions | 🔲 Pre-migration |
| IgnitionCRM.jsx | Customer relationship management | 🔲 Pre-migration |
| IgnitionSTOK.jsx | Inventory management | 🔲 Pre-migration |
| IgnitionVIN.jsx | VIN decode gate (shared component) | ✅ Live — check here before building VIN fallbacks |

**Vehicle sign-out architecture decision (locked):**
- Parts run (short, internal, tied to PO) → belongs in **IgnitionProc**
- Wrecker / after-hours service call (customer-facing, billable, mileage) → belongs in **IgnitionHub**
- Do NOT create a standalone vehicle module

---

## 4. Known Fragile Points

> These are landmines. Know them before touching related code.

- **IgnitionFlux + IgnitionOmni** still read from localStorage — any feature touching job state will silently fail in these modules until migrated
- **CoreApp.jsx routing** — 3 touch points required for every new module (import, route case, dashboard grid). Missing any one breaks navigation silently
- **shop_estimate.py `_get_labor_hours()`** — currently a stub. Real Mitchell1/AllData not wired. Don't build features that depend on accurate labor hour data yet
- **`supabase_hardware_ledger_migration.sql`** — not yet run in production. IgnitionTools.jsx will fail until this is executed
- **CustomerApprovalPortal** — fullscreen z-index overlay; mobile viewport conflicts possible on small screens
- **DataBridge.js** — other modules still depend on its localStorage keys. Do not remove keys or change the save/load API shape

---

## 5. Key Tables

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
| tools | Shop equipment registry with PMI tracking |
| tool_signout_log | Tool custody audit trail — CHECKED_OUT/CHECKED_IN/ACKNOWLEDGED, manager bypass recorded |

---

## 6. Active Tasks

**Current sprint:**
- [ ] Velocity leaderboard in OMNI (efficiency % per tech, management toggle)
- [ ] Migrate IgnitionFlux to read job state from Supabase
- [ ] Migrate IgnitionOmni to read from Supabase

**Backlog (post-pilot):**
- [ ] Multi-location registry and quick-dial hub
- [ ] 14-day trial savings report (conversion hook)
- [ ] Tiered access controller (LITE/PRO/PLATINUM feature flags)
- [ ] SMS estimate delivery (vs. in-person portal only)
- [ ] Staff revocation with two-step confirm ("nuke" option)
- [ ] Multi-day job suspension with DO NOT MOVE flag
- [ ] Vehicle sign-out in IgnitionProc (parts run)
- [ ] Vehicle sign-out in IgnitionHub (wrecker/service call)

**Completed (reference only):**
- [x] Zone 1 — IgnitionIntake.jsx
- [x] Zone 3 — IgnitionEstimate.jsx + CustomerApprovalPortal.jsx
- [x] shop_estimate.py Railway estimate agent
- [x] supabase_job_lifecycle_migration.sql (13-table schema)
- [x] Zone 2 — IgnitionEval.jsx (DTC, photos, labor clock)
- [x] Parts sourcing trigger (authorized lines → in-stock pull vs. PO)
- [x] Invoice + closeout (IgnitionInvoice.jsx)
- [x] Repair workflow (labor clock, repair_logs, supplement branch)
- [x] Slab margin pricing engine (PriceField in IgnitionEstimate)
- [x] PDF invoice generation (Railway reportlab endpoint)
- [x] Phase 3 — Hardware ledger (IgnitionTools.jsx + KOSK gate)

---

## 7. Off Limits — Do Not Touch

- `supabase.js` — Supabase client config; do not change connection details
- `DataBridge.js` — core persistence layer; do not remove existing keys or change the save/load API
- `AIEngine.js` — AI orchestration; changes need full context of all three AI providers
- `MarginEngine.js` — pricing logic used across multiple modules; do not change calculation formulas without a business decision
- `dist/` — build output, never edit directly
- `__pycache__/` — never commit
- `.vercel/` — deployment config, never commit
- **All `supabase_*_migration.sql` files already run** — append new migrations, never edit existing ones

---

## 8. Dev Commands

**Start everything (recommended):**
```bash
./start.sh          # starts FastAPI :8000 + Vite :5173 + Expo mobile
./start.sh --stop   # kills all three servers
```

**Individual servers:**
```bash
npm run dev                                                                    # Vite web → http://localhost:5173
npm run build                                                                  # production build → dist/
source venv/bin/activate && uvicorn shop_estimate:app --reload --port 8000    # FastAPI only
```

**Python environment (first time only):**
```bash
python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

**Logs:** `.logs/python.log` and `.logs/web.log` (created by `start.sh`)
**API docs:** `http://localhost:8000/docs`

---

## 9. Environment Variables

```
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
VITE_API_URL=        # Railway URL for production; http://localhost:8000 for local
```

Python backend reads via `python-dotenv`. Vite frontend reads `VITE_*` at build time.

---

## 10. Shop Floor Philosophy
> **Golden Rule:** If it takes more clicks than writing on paper, the techs won't use it.

- Features are **owner-optional** — enforcement features are opt-in toggles, OFF by default
- Default state is **trust** — zero added friction until a toggle is explicitly enabled
- Hide time clocks behind natural physical actions. No generic "Punch In" buttons.
- **Eval phase:** Clock auto-starts when VIN is validated. Clock auto-stops when eval submitted.
- **Repair phase:** Clock auto-starts when parts are acknowledged ("Parts in Bay"). Clock auto-stops when QC complete and job slid to complete.
- **CRITICAL:** Never rebuild existing functionality. Always check `/modules` for pre-built components (like `IgnitionVIN`) before proposing fallbacks or placeholder buttons.

---

## 11. Compliance & PII Guardrails

- **Storable PII:** Customer Name, Phone, Email, Address, VIN only
- **Storage location:** ONLY in `customers` and `customer_vehicles` Supabase tables
- **localStorage:** Never store unencrypted PII in DataBridge. Use UUID references instead
- **External APIs:** Never send raw PII (Name, Phone, Email) to LLMs or third-party APIs. Anonymize payloads before sending
- **Audit:** Maintain strict audit logs for any bulk export or deletion of PII

---

## 12. Coding Standards

- **Language:** JSX/React with hooks (frontend); Python 3 + FastAPI + Pydantic (backend)
- **Styling:** Tailwind CSS only — dark slate palette (`bg-slate-950` screens, `bg-slate-900` cards, `border-slate-800` borders)
- **Icons:** Lucide React only — no other icon libraries
- **Accent colors:** Blue = actions, Emerald = success, Amber = warnings, Red = errors
- **No emojis** in code, UI, or file content unless explicitly requested
- **No comments** unless the WHY is non-obvious — no docblocks, no "this function does X" comments
- **Naming:** PascalCase components, camelCase functions/variables, SCREAMING_SNAKE constants
- **Heading style:** `text-white font-black italic uppercase tracking-tighter`
- **Button style (primary CTA):** `py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]`
- **Badge style:** `text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border`
- **API calls:** always use `VITE_API_URL` env var, never hardcode localhost
- **Supabase writes:** always handle errors; show user-facing error state; never silently swallow failures
- **No backwards-compat shims** — if something is fully replaced, delete the old version
- **New SQL migrations:** must include `DROP TRIGGER/POLICY IF EXISTS` guards; must be re-runnable

---

## 13. End-of-Session Protocol
> Run this checklist before ending every session.

1. Update the `## 1. Handoff` section in **both** `CLAUDE.md` and `GEMINI.md`
2. Update `## 3. Module Map` if any module status changed
3. Update `## 6. Active Tasks` — check off completed items, add new ones
4. Update `## 1. Handoff` migration table if any migrations were run
5. Confirm no hardcoded secrets, URLs, or localhost references in new code
6. Confirm no placeholder/mock code left undocumented
7. Confirm `.env.example` updated if new variables were added
8. Output a plain English summary of the session for human review
