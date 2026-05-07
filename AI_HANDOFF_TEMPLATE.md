# Multi-AI Handoff Workflow Ruleset

> **Setup Instructions:** When starting a new project, copy the contents of this file into two separate files at the root of your project: `CLAUDE.md` (for Claude/Cursor) and `gemini.md` (for Gemini/Antigravity). This ensures both AI agents follow the exact same rules and maintain continuous context.

## 1. Core Mandate
You are part of a multi-AI collaborative development team. You will frequently hand off work to, and pick up work from, other AI agents. Maintaining continuous, accurate context is your highest priority.

**CRITICAL RULE:** At the end of every single work session or turn, you MUST update the `## Handoff` section in both `CLAUDE.md` and `gemini.md`. Never end a session without documenting exactly what you just did and what the next AI needs to do.

## 2. Status & Architecture
- **Current phase:** [Insert Phase]
- **Tech Stack:** [Insert Tech Stack]
- **Source of Truth:** [Insert Database or State Manager]

## 3. Handoff
> *This section is rewritten at the end of every session by whichever AI is finishing.*
> *The next AI reads this first and picks up from here — no recap needed.*

- **Completed this session:** [Describe exactly what was just built/fixed]
- **Next task:** [Describe the exact next step on the critical path]
- **Blockers / Notes:** [List any missing API keys, manual steps required, etc.]
- **Session ended by:** [AI Name] — [YYYY-MM-DD]

## 4. Active Tasks
*Maintain a running checklist of the current sprint here.*
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## 5. Strict Coding Guidelines
1. **Never edit existing migrations:** Always append new SQL migrations, never edit already-run ones.
2. **No placeholder code:** Build fully functional features. If mock data is needed, explicitly document it.
3. **Consistent UI:** [Define your global design system, e.g., "Tailwind dark slate, Emerald success buttons"].
4. **Environment Variables:** Never hardcode URLs, keys, or secrets. Always use `.env` vars.
## 6. Shop Floor Philosophy (App-Specific)
> *If building a shop floor or field service application, adhere to the following:*
**Golden Rule:** If it takes more clicks than writing on paper, the techs won't use it.
- Hide time clocks behind natural physical actions. Do not use generic "Punch In" buttons.
- **CRITICAL RULE FOR AI:** Never rebuild existing functionality. Always check the `/modules` folder for pre-built components (like `IgnitionVIN`) before proposing dummy fallbacks or placeholder buttons.

## 7. Off Limits This Session
- [File or module currently being worked on by other AI]
- [Migrations already run — append only]
## 7. Compliance Guardrails (PII & HIPAA)
- **What PII we can store:** Customer Name, Phone Number, Email, Physical Address, and VIN.
- **Where we can store PII:** ONLY in designated secure database tables (e.g., `customers`).
- **Local Storage:** Never store unencrypted PII in `localStorage` or device-local scratchpads.
- **AI/External APIs:** Never send raw PII to external LLMs or unauthorized APIs. Anonymize payloads first.
- **Audit:** Audit log every data access/export event.
- **Storage:** Never suggest public cloud storage buckets for documents containing PII or PHI.