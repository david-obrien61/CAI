# Ignition OS — Product Plan & Pricing Schema

## Product Overview
**Ignition OS** is a modular shop management platform for diesel and automotive repair shops.
Web (manager command center) + Mobile (tech kiosk), shared codebase.

---

## The Bigger Story — Composable AI Platform for SMBs

> Ignition OS is Version 1 of a composable AI platform for small businesses. We proved it in the hardest vertical — diesel repair. The same architecture deploys to any SMB vertical in 60 days. Auto shops are the beachhead.

Most small businesses are being left behind by the AI revolution. Enterprise software is too expensive, too complex, and built for companies 10x their size. Ignition OS is the proof of principle that a **modular, composable AI** — affordable base + purchasable capability blocks — works in the real world.

### The Two-Level Pitch

| Audience | The Story |
|---|---|
| **Pilot shop owner** | "Stop losing margin on parts, tools, and labor. 14 days free." |
| **Investor / acquirer** | "We built a composable AI platform and proved it in the highest-friction SMB vertical. The architecture re-skins to any industry in 60 days." |

### What Makes It Composable

The architecture is already industry-agnostic at its core:

| Layer | Component | Reusable As-Is? |
|---|---|---|
| Data layer | DataBridge + Supabase | Yes — multi-tenant, any vertical |
| AI router | AIEngine (Gemini / Claude / OpenAI) | Yes — task-routed, provider-agnostic |
| Module registry | Tile system + tier gating | Yes — add/remove tiles per vertical |
| Auth & access | PIN → Supabase Auth | Yes — shop_id scopes all data |
| Backend | FastAPI on Railway | Yes — add routes per vertical |

### Vertical Expansion Roadmap (post-pilot)

| Vertical | Beachhead Hook | Key Blocks to Swap |
|---|---|---|
| **Auto Repair** (V1 — now) | Margin leaks, tool PMI, fleet dispatch | Cipher, VIN Decode, DOT Forms |
| **Food Service** (V2) | Recipe costing, waste, scheduling | Invoice OCR → recipe cost, smart scheduling |
| **Retail / Boutique** (V3) | Inventory turns, clienteling, returns | POS sync, VIP CRM, dynamic merchandising |
| **HVAC / Field Service** (V4) | Dispatch, parts van inventory, compliance | HUB map, van tools PMI, job costing |

Each expansion vertical reuses 80%+ of the existing codebase. Only the tiles, AI prompts, and integration blocks change.

### The Composable Block Model (Revenue)

Ignition OS modules = the "learning blocks" Gemini described:

| Block Type | Ignition OS Example | Composable Platform Equivalent |
|---|---|---|
| **Data integration** | PROC (vendor APIs), QuickBooks | Inventory Sync Block, POS Block |
| **Agentic / action** | Auto PO generation, customer e-sign | Automated Reorder Block |
| **Industry knowledge** | Cipher (DTC codes), DOT forms | Diagnostic Copilot Block |
| **AI capability** | Scribe AI, VIN Decode, Predictive | Voice Block, Vision Block |

---

## The 3 Core Value Hooks
1. **Parts Leaks** — Slab margin engine + override audit. Stop giving away margin you don't know you're giving.
2. **Tool Accountability** — Chain of custody, PMI schedules, missing tool alerts.
3. **Multi-Day Labor** — Job suspension, shift handoff notes, DO NOT MOVE flags.

**Trial-to-Paid Hook:**
> "In 2 weeks, Ignition OS flagged $[X] in recoverable margin. Unlock the full version to stop the leak."

---

## Pricing Tiers

### 14-Day Trial
- Full PREMIER access, no card required
- Day 12: savings report triggered ("$X flagged this week, trial ends in 2 days")
- Day 15: tiles visible, data blurred, functionality grayed
- Day 30: data archived (restored on subscribe)

---

### STARTER — $149/mo
*For the independent shop getting off paper.*
| Module | Included |
|---|---|
| Intake (job creation) | ✓ |
| Queue / Tech Kiosk | ✓ |
| Estimates (manual) | ✓ |
| Customer Portal / E-sign | ✓ |
| Tools (basic checklist) | ✓ |
| Admin | ✓ |
| AI | None |
| Users | Up to 3 |

---

### PROFESSIONAL — $299/mo
*For the shop that wants AI doing the heavy lifting.*
Everything in Starter, plus:
| Module | Included |
|---|---|
| VIN Decode (Gemini vision) | ✓ |
| Scribe AI — voice to notes (Whisper) | ✓ |
| DTC Cipher — fault code decode (Claude) | ✓ |
| Parts / Manifest | ✓ |
| Procurement (PROC) | ✓ |
| Stock AI / Inventory AI | ✓ |
| CRM | ✓ |
| OMNI — daily/weekly summary | ✓ |
| AI Bundle | Gemini + Claude + Whisper |
| Users | Up to 8 |

---

### PREMIER — $499/mo
*For fleet operations, multi-location, owners who run on data.*
Everything in Professional, plus:
| Module | Included |
|---|---|
| Full OMNI — all analytics, leaderboard, margin audit | ✓ |
| HUB — dispatch + live vendor/driver tracking | ✓ |
| Fleet compliance / DOT forms (auto-populated) | ✓ |
| Tools + PMI module (full barcode lifecycle) | ✓ |
| Predictive Maintenance AI | ✓ |
| Multi-location support | ✓ |
| Trial savings report (white-label) | ✓ |
| AI Bundle | All three providers, full usage |
| Users | Unlimited |

---

### À La Carte Add-Ons
| Add-on | Price |
|---|---|
| Extra location | +$99/mo |
| Extra user block (5 users) | +$49/mo |
| SMS / Twilio integration | +$29/mo |
| API access (fleet integrations) | +$99/mo |

---

### Tile Pricing (à la carte, for shops that want one module only)
| Module | Monthly |
|---|---|
| Intake | $49 |
| Queue | $29 |
| VIN Decode | $99 |
| Scribe AI (Voice) | $149 |
| Estimates | $49 |
| Manifest (Parts) | $79 |
| Procurement | $129 |
| Tools | $19 |
| CRM | $49 |
| Fleet / HUB | $199 |
| Stock AI | $89 |
| Admin | Free |
| Kiosk | Free |

---

## AI Provider Routing
| Task | Provider | Model |
|---|---|---|
| VIN decode, invoice scan, label read | Gemini | gemini-2.0-flash |
| DTC decode, estimates, PMI suggest | Claude | claude-haiku |
| Complex analytics, savings report | Claude | claude-sonnet |
| Voice transcription | OpenAI | whisper-1 |
| Parts NLP, intent classification | OpenAI | gpt-4o-mini |

---

## Tech Stack
- **Frontend:** React (Vite) + React Native (Expo) — shared codebase
- **Backend:** Python FastAPI (Railway)
- **Database:** Supabase (PostgreSQL)
- **AI:** Gemini + Anthropic Claude + OpenAI

---

## Module Status
| Module | Web | Mobile | Status |
|---|---|---|---|
| Intake | ✓ | ✓ | Built |
| Queue / Kiosk | ✓ | ✓ | Built |
| VIN Decode | — | ✓ | Built |
| Cipher (DTC) | ✓ | — | Built |
| Estimates | ✓ | ✓ | Built |
| Customer Portal | ✓ | ✓ | Built |
| Parts / Manifest | ✓ | ✓ | Built |
| Procurement | ✓ | ✓ | Built |
| OMNI Analytics | ✓ | — | Built |
| HUB Dispatch | ✓ | — | Built (mock map) |
| Tools / PMI | ✓ | ✓ | Built (web live, migration pending) |
| Scribe AI | ✓ | ✓ | Stub (needs wiring) |
| CRM | ✓ | — | Built |
| Fleet Compliance | ✓ | ✓ | Built |

---

## Pilot Target
- **Region:** Leander / North Austin, TX
- **Pitch:** Leander Pilot — regional special pricing
- **Target:** Independent diesel/auto shops, 2–8 bays

---

## Competitive Moat

1. **Switching cost by design** — once tools are barcoded, PMI schedules are running, and job history is in Supabase, leaving means losing all of it
2. **Physical presence** — magnetic charger on the toolbox, barcode printer in the shop, voice cheat sheet on the wall. Competitors are just software
3. **AI routing advantage** — three providers, best model for each task. Not locked into one AI that might fall behind
4. **Composable architecture** — every new vertical is a re-skin, not a rewrite. Competitors would have to rebuild from scratch

---

## Platform IP Summary (for investor conversations)
- Multi-tenant SaaS architecture (Supabase RLS, shop_id scoping)
- Unified AI router across 3 providers (AIEngine.js + ai_router.py)
- Modular tile system with tier gating (composable blocks)
- Local-first + cloud sync (works offline in a shop with spotty WiFi)
- Physical GTM moat (hardware kit creates habit before first invoice)
