# Antigravity — Gemini Context File
## Ignition OS: Project Status & Stack for AI Collaboration

*This file is the handshake between Gemini (Antigravity) and Claude Code sessions.
Read this at the start of every session. When you generate code or feature specs, paste output into `gemini_staging_inbox.md` for Claude to implement.*

---

## What We're Building

**Ignition OS** — composable AI shop management SaaS. Version 1 is skinned for diesel/auto repair. The underlying architecture (DataBridge, module registry, Supabase multi-tenant, AI routing) is industry-agnostic. Auto shops are the beachhead. Post-pilot: food service → HVAC → field service.

**Owner:** Terrence / David O'Brien. Leander TX. Targeting a regional pilot in Liberty Hill / Georgetown / Round Rock / North Austin TX.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web Frontend | React + Vite |
| Mobile Frontend | React Native + Expo |
| Backend | Python FastAPI on Railway |
| Database | Supabase (PostgreSQL) |
| AI — Reasoning | Anthropic Claude (claude-haiku-4-5 for fast tasks, claude-sonnet-4-6 for complex) |
| AI — Vision | Google Gemini |
| AI — Voice | OpenAI Whisper |
| State / Persistence | Supabase = source of truth; localStorage via DataBridge.js = device scratchpad |
| Styling | Tailwind CSS (dark mode, slate palette, high-contrast shop floor UI) |

---

## Codebase Layout

```
/CAI
├── CoreApp.jsx              # Main shell — activeModule string routes between modules
├── DataBridge.js            # localStorage persistence + offline sync queue
├── AIEngine.js              # Frontend AI call orchestration
├── MarginEngine.js          # Slab pricing engine
├── supabase.js              # Supabase client
├── EnrollmentCatch.jsx      # PIN setup / biometric login
├── IgnitionCore.js          # Session guard, routing logic
├── ai_router.py             # FastAPI app + shared AI clients (Railway)
├── shop_estimate.py         # Estimate agent — POST /api/estimate/build
├── monitor.py               # Health monitoring
├── modules/
│   ├── IgnitionIntake.jsx       ✅ Zone 1 — new repair order intake form
│   ├── IgnitionFlux.jsx         ✅ Job flow / bay assignment
│   ├── IgnitionKosk.jsx         ✅ Tech kiosk (clock in/out, labor, parts scan)
│   ├── IgnitionEstimate.jsx     ✅ Zone 3 — service writer estimate station
│   ├── CustomerApprovalPortal.jsx ✅ In-person customer authorization with e-sign
│   ├── IgnitionOmni.jsx         ✅ Owner analytics dashboard
│   ├── IgnitionCipher.jsx       ✅ DTC fault code decoder
│   ├── IgnitionStok.jsx         ✅ Inventory
│   ├── IgnitionProc.jsx         ✅ Procurement / vendor management
│   ├── IgnitionPort.jsx         ✅ Customer portal (legacy)
│   ├── IgnitionHub.jsx          ✅ Dispatch / GPS map
│   ├── IgnitionCompliance.jsx   ✅ DOT / PMI inspection forms
│   ├── IgnitionCRM.jsx          ✅ Customer records
│   ├── IgnitionVIN.jsx          ✅ VIN decode
│   ├── IgnitionVoice.jsx        ✅ Voice command interface
│   ├── AdminSubscription.jsx    ✅ Subscription marketplace
│   └── [30+ more modules]
└── supabase_*.sql           # All migrations (9 files, all re-runnable)
```

---

## Database Schema — Key Tables

**Job lifecycle state machine:**
```
intake → queued → in_eval → eval_done → estimating → pending_auth
→ authorized → in_repair → supplement → repair_done → invoiced → closed
```

| Table | Purpose |
|---|---|
| `shops` | Multi-tenant root |
| `shop_members` | Staff with roles (owner/service_writer/tech/staff) |
| `customers` | CRM records |
| `customer_vehicles` | VIN history per customer |
| `jobs` | Core repair order, links to customer + vehicle |
| `evaluations` | Tech eval document (work_items jsonb, status: draft/submitted) |
| `dtc_codes` | Structured fault codes — queryable rows |
| `eval_photos` | Photos from tech eval |
| `estimates` | Agent-generated estimate container |
| `estimate_line_items` | Per-line: item_type, labor_hours, unit_price, line_total, auth_status |
| `customer_authorizations` | Legal snapshot: authorized_line_ids uuid[], declined_line_ids uuid[] |
| `labor_entries` | Clock in/out records |
| `repair_logs` | Repair outcomes, parts used |
| `invoices` | Final invoice (draft/open/paid/voided) |
| `invoice_line_items` | Immutable snapshot of authorized line items |

**RLS:** All tables use pilot open-access policy (`USING (true)`). Production will add `shop_id` scoping.

---

## What's BUILT and WORKING

### Zone 1 — Customer & Vehicle Intake
**`modules/IgnitionIntake.jsx`**
- 3-phase form: Customer search/create → Vehicle select/create → Job details
- Debounced Supabase search on phone, first name, last name
- Creates: customers row (if new), customer_vehicles row (if new), jobs row (status='intake')
- WO number format: `RO-2026-XXXX`
- Callback: `onJobCreated(job)` → CoreApp routes to FLUX

### Zone 3 — Estimate & Authorization
**`modules/IgnitionEstimate.jsx`**
- Service writer station: QUEUE → REVIEW → SENT → AUTHORIZED
- QUEUE: Shows jobs in eval_done/estimating/ready/pending_auth states
- REVIEW: Builds AI estimate via Railway agent, inline-editable line items, send to customer
- When sent: "Open Customer Authorization Portal" button appears
- AUTHORIZED: Confirmation screen after customer signs

**`modules/CustomerApprovalPortal.jsx`**
- In-person customer authorization (runs on shop tablet/kiosk)
- Shows all line items with approve/decline toggles (default: all approved)
- Running totals update live as customer toggles items
- Signature canvas + consent checkbox
- On authorize: writes auth_status to each line item, creates customer_authorizations legal snapshot, updates estimates and jobs to 'authorized'
- Auth disabled until: has signature + consent + at least 1 approved item

### Estimate Agent (Railway Backend)
**`shop_estimate.py` → POST /api/estimate/build`**
- Reads evaluations, DTC codes, vehicle info from Supabase
- Calls Claude Haiku to generate line items (labor hours, parts, pricing)
- Applies margin engine: PART markup, LABOR = hours × rate, tax on parts only
- Writes estimate_line_items, updates estimates and jobs status
- `_get_labor_hours()` is isolated → documented Mitchell1/AllData swap point

---

## What's NOT BUILT YET (Active Build Queue)

### Next Up — Zone 2 Tech Eval Extension
The evaluations, dtc_codes, eval_photos, and labor_entries tables exist in Supabase but no UI writes to them yet. Tech currently submits evals without structured DTC capture or photo upload.

Needed:
- Structured DTC code entry form (writes to `dtc_codes` table)
- Photo upload from device camera (writes to `eval_photos` with Supabase Storage)
- Labor clock-in/out (writes to `labor_entries`)
- "Submit Evaluation" action sets evaluations.status='submitted', jobs.status='eval_done'

### After Tech Eval
- **Parts sourcing trigger:** After authorization, split approved line items → in-stock (pull from inventory) vs. out-of-stock (create PO)
- **Repair workflow:** Labor clock-in during repair, repair_logs entries, supplement branch detection
- **Invoice + closeout:** Generate invoice from authorized line items → invoice_line_items snapshot → collect payment → close job

### Backlog Features (from staging inbox)
- Slab margin pricing engine UI (MarginEngine.js exists, not wired into estimate flow)
- Velocity leaderboard in OMNI (efficiency % per tech, management toggle)
- Hardware ledger & tool tracking (STOK extension)
- Multi-location registry & quick-dial hub
- Voice command system (WebSpeechAPI)
- PDF invoice and DOT form generation
- 14-day trial savings report (conversion hook)
- Tiered access controller (LITE/PRO/PLATINUM module gating with feature flags)
- Staff revocation "nuke" with two-step confirm
- Multi-day job suspension ("DO NOT MOVE" flag)

---

## Key Technical Rules (don't generate code that violates these)

1. **Supabase is source of truth.** localStorage is scratchpad only. All status transitions write to Supabase.
2. **Jobs always write both FK columns and legacy jsonb** (`customer`, `vehicle` jsonb) for backward compat with older modules.
3. **Legal authorization snapshot is immutable.** `customer_authorizations.authorized_line_ids` and `declined_line_ids` are UUID arrays frozen at auth time.
4. **Tax on parts only.** `tax = subtotal_parts × taxRate`. Labor and fees are not taxed.
5. **Never hardcode localhost.** Always use `VITE_API_URL` env var for Railway backend calls.
6. **RLS pilot pattern:** `DROP POLICY IF EXISTS` before every `CREATE POLICY`. All migrations must be re-runnable.
7. **No SHA-256 PIN in plaintext.** Browser-native: `crypto.subtle.digest('SHA-256', ...)` salted with shopId.
8. **Module access gated by `AccessGatekeeper`** with `requiredPermissions` array.

---

## Styling Conventions

- **Background:** `bg-slate-950` (screens), `bg-slate-900` (cards)
- **Borders:** `border-slate-800` standard, `border-blue-500/30` for active/focus states
- **Text:** `text-white font-black italic uppercase tracking-tighter` for headings
- **Accent:** Blue for actions, Emerald for success/confirm, Amber for warnings, Red for errors
- **Badges:** tiny, `text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border`
- **Buttons:** `py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]` for primary CTAs
- **Icons:** Lucide React only
- **No emojis in code or UI**

---

## How We Collaborate

1. You (Gemini/Antigravity) generate feature specs, code snippets, or architectural ideas in the web session
2. Paste output into `gemini_staging_inbox.md` pending section
3. Tell Claude Code in chat: "look at the inbox and implement [feature]"
4. Claude reads the file, builds it natively, checks it off in the inbox
5. Claude updates this file (`antigravity_gemini.md`) and `CLAUDE.md` with status changes

---

## Pricing Reference

| Tier | Price | Users | AI |
|---|---|---|---|
| STARTER | $149/mo | 3 | No |
| PROFESSIONAL | $299/mo | 8 | Claude + Gemini + Whisper |
| PREMIER | $499/mo | Unlimited | Everything + HUB + Predictive |

14-day trial = full PREMIER. No card required. Day 12: savings report. Day 15: data blurs.

**CAC:** ~$40–50/shop (hardware kit + trial AI costs). Payback < 1 month at PRO.

**Hardware kit (~$38/shop):** RAM Mounts magnetic base, Anker USB-C cable, laminated voice command cheat sheet, branded sticker.
