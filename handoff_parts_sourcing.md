# Handoff: AI-Driven Parts Sourcing Pipeline
**For:** Antigravity (Gemini)
**Date:** 2026-05-07
**Priority:** High — this is the composable AI core, not a UI feature

---

## The Principle (Don't Lose This)

The entire premise of Ignition OS is **composable AI that eliminates manual work**. The service writer should never have to call a vendor for availability or price. The system does it. This handoff is about wiring that up.

---

## What Already Exists — DO NOT REBUILD

Before writing a single line of code, read these files:

| File | What it does |
|---|---|
| `MarginEngine.js` | Slab pricing engine — fully built. `calculateRetail(cost)` applies configurable multipliers (e.g. $0–50 = 4× markup). Has tier discounts: FLEET 10%, LEGACY 20%, FF 5%. |
| `IgnitionProt.jsx` | Admin UI for configuring margin slabs — fully built. |
| `IgnitionProcure.jsx` | Tech enters part number + wholesale cost → MarginEngine auto-calculates retail. Already wired. |
| `IgnitionProc.jsx` | Vendor directory UI — add/manage vendors. Uses `DataBridge.getVendors()`. |
| `IgnitionPort.jsx` lines 69–91 | **Auto-generates POs by vendor on customer approval.** Groups parts by vendor, writes to `DataBridge.db.purchaseOrders`. This is the model for what we need to move into the backend. |
| `DataBridge.getVendors()` | Returns vendor list from localStorage/Supabase. Default vendors: AutoZone Commercial, NAPA Auto Parts, FleetPride. |
| `DataBridge.db.purchaseOrders.save(po)` | Upserts PO to Supabase `purchase_orders` table. Already wired. |
| `ai_router.py → invoice_scan` | Gemini OCR on vendor invoices → extracts line items with unit costs. Already built. |
| `ai_router.py → parts_nlp` | OpenAI extracts parts list from voice transcripts. Already built. |
| `AIEngine.js → part_photo_id` | Gemini identifies a part from a photo. Already built. |

**Do not propose a margin slider in IgnitionEstimate.jsx. IgnitionProcure already handles cost entry + margin. Rebuilding it there is redundant and manual — the opposite of the goal.**

---

## The Actual Gap

`shop_estimate.py → _get_labor_hours()` generates PART line items with an AI-estimated `unit_cost_estimate`. It **never checks real inventory or queries preferred vendors.** It invents costs.

The composable sourcing chain that was always the intent:

```
Estimate agent generates PART line items
        ↓
_source_parts() — for each PART item:
        ↓
1. Check Supabase `tools` / inventory table for this part
   → In stock?  source = 'INVENTORY', use shop cost, no PO needed
   → Not in stock? → continue
        ↓
2. Query preferred vendors in priority order
   (vendor_directory sorted by `priority` integer field)
        ↓
3. Set source, supplier, unit_cost on the line item from real data
        ↓
4. After authorization → auto-generate POs grouped by vendor
   (mirror the logic already in IgnitionPort.jsx lines 69–91,
    but run it server-side in shop_estimate.py or a new endpoint)
```

---

## Task 1 — Add `priority` to Vendor Directory

The vendor directory needs a priority ordering field so the agent knows which vendor to try first (owner-set preference — could be relationship, price, proximity, or any unstated reason).

**In `DataBridge.js` → `getVendors()`**, update the default vendor objects to include:
```javascript
{ id, name, address, phone, weblink, accountNum, priority: 1 }
// priority: 1 = first choice, 2 = second, etc. Lower = higher priority.
```

**In `IgnitionProc.jsx`**, add a priority input field to the vendor onboarding form and vendor cards.

**In Supabase `purchase_orders` table schema** (already exists) — no change needed, vendor is already a string field.

---

## Task 2 — Build `_source_parts()` in `shop_estimate.py`

This is a new function in `shop_estimate.py`, called after `_get_labor_hours()` returns its line items.

**Function signature:**
```python
def _source_parts(line_items: list, shop_id: str, job_id: str) -> list:
    """
    For each PART line item:
    1. Check Supabase inventory for a match (by part_number or description keyword)
    2. If found in stock: set source='INVENTORY', unit_cost from inventory, no PO flag
    3. If not in stock: set source='VENDOR', supplier = highest-priority vendor from vendor_directory
    4. Apply MarginEngine equivalent: unit_price = unit_cost * (1 + markup/100)
    Returns enriched line_items list with source, supplier, unit_cost populated.
    """
```

**Inventory check logic:**
- Query Supabase `tools` table (or whichever inventory table is canonical — check schema)
- Match on `part_number` exact, or fallback to `name` ilike search
- If `qty > 0` → in stock

**Vendor selection logic:**
- Load vendor directory from Supabase (or DataBridge equivalent on backend)
- Sort by `priority` ascending (1 = preferred)
- Assign `supplier` = first vendor name
- In future: swap this for real vendor API calls (NAPA, AutoZone, FleetPride APIs)
  - **This is the Mitchell1 pattern — isolate the vendor query so swapping to a real API is one function body change**

**Where to call it:**
In `POST /api/estimate/build`, after step 5 (`_get_labor_hours()`) and before step 6 (margin engine):
```python
# Step 5b — source parts from inventory or preferred vendor
line_items = _source_parts(line_items, shop_id=req.shop_id, job_id=job_id)
```

---

## Task 3 — Auto-PO Generation After Authorization

Currently `IgnitionPort.jsx` (frontend) generates POs when a customer approves. This is fragile — it depends on the service writer's browser session.

**Move this logic to a new backend endpoint:**
```
POST /api/jobs/{job_id}/generate-pos
```

**Logic (mirror IgnitionPort.jsx lines 69–91):**
1. Load `estimate_line_items` for the job where `auth_status = 'approved'` and `item_type = 'PART'` and `source = 'VENDOR'`
2. Group by `supplier`
3. For each vendor group → INSERT `purchase_orders` row:
   ```
   { job_id, shop_id, vendor (supplier), parts (jsonb array), status: 'ORDERED', created_at }
   ```
4. UPDATE `jobs.status = 'in_repair'` (parts are on order, repair can begin)

**Trigger:** Call this endpoint from `handleAuthorized()` in `modules/IgnitionEstimate.jsx` (already the callback after customer signs — just add one fetch call).

---

## Files to Touch (and only these)

| File | Change |
|---|---|
| `shop_estimate.py` | Add `_source_parts()` function, call it in the estimate build pipeline |
| `shop_estimate.py` | Add `POST /api/jobs/{job_id}/generate-pos` endpoint |
| `DataBridge.js` | Add `priority` field to default vendors in `getVendors()` |
| `modules/IgnitionProc.jsx` | Add priority field to vendor onboarding form |
| `modules/IgnitionEstimate.jsx` | In `handleAuthorized()`, call `POST /api/jobs/{job_id}/generate-pos` |

**Do not touch:** MarginEngine.js, IgnitionProcure.jsx, IgnitionPort.jsx PO logic (it's the reference model, not the target), IgnitionProt.jsx, supabase.js, DataBridge.js save/load API.

---

## Key Technical Constraints

- All Supabase writes use `shop_id` scoping
- `purchase_orders` table already exists in Supabase (created in `supabase_schema.sql`)
- Backend uses `_supabase` client from `ai_router.py` — import it: `from ai_router import _supabase`
- Vendor priority is owner-set preference — no business logic on WHY, just respect the order
- The `_source_parts()` function body is the **vendor API swap point** (same pattern as `_get_labor_hours()` for Mitchell1). Keep it isolated.
- Never send customer PII (name, phone) to external vendor APIs — use job_id and part_number only

---

## Definition of Done

- [ ] `_source_parts()` enriches PART line items with `source`, `supplier`, `unit_cost` from real inventory or preferred vendor
- [ ] `POST /api/jobs/{job_id}/generate-pos` creates PO rows in Supabase grouped by vendor
- [ ] `handleAuthorized()` in IgnitionEstimate calls the PO endpoint
- [ ] Vendor directory has `priority` field, editable in IgnitionProc
- [ ] No manual vendor calls required from service writer
