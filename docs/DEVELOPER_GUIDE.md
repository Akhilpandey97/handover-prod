# Handover — Developer Guide

Enterprise handover / onboarding command centre. Projects (merchants) move across teams
(Sales → Pre-Integration → Integration → Merchant Success → Live) with checklists, owners,
SLAs, transfers, reporting and an AI assistant layered on top.

---

## 1. Stack

| Layer | Tech |
| --- | --- |
| UI | React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + shadcn/ui |
| State | React Context (`AuthContext`, `ProjectContext`, `LabelsContext`) + TanStack Query |
| Backend | Lovable Cloud (Postgres, Auth, Storage, Edge Functions) |
| AI | Lovable AI Gateway (chat, insights, field mapping) |
| Voice | Web Speech API (`useVoiceAssistant`) |

Client entry: `src/main.tsx` → `src/App.tsx` (providers + routes).

Routes:
- `/` → `Index` — login screen, or Manager/Team dashboard by role
- `/projects/:projectId` → `ProjectWorkspace`
- `*` → `NotFound`

---

## 2. Design system (2026 refresh)

All colour, gradient and shadow values live as HSL tokens in `src/index.css` and are exposed
through `tailwind.config.ts`. **Never** hardcode `text-white`, `bg-black` or hex values in components.

Key tokens:

- Palette "Ocean Deep": `--primary` (deep navy-blue), `--primary-glow` (teal), `--teal`
- Surfaces: `--background` (crisp white), `--surface`, `--surface-2`, `--card`
- Semantics: `--success`, `--warning`, `--info`, `--pending`, `--destructive`
- Dark navy shell: `--sidebar-*`, `--hero`, `--hero-foreground`
- Effects: `--gradient-primary`, `--gradient-hero`, `--shadow-soft`, `--shadow-lift`

Utilities in `src/index.css`: `.surface-card`, `.enterprise-panel`, `.enterprise-shadow`,
`.gradient-primary`, `.gradient-hero`, `.enterprise-grid`, `.scrollbar-thin`.

Typography: `Outfit` (display/headings), `Figtree` (body), `JetBrains Mono` (code/IDs).

Layout conventions:
- Dark navy sidebar shell + white content canvas
- Sticky, blurred page headers (`sticky top-0 backdrop-blur-md`)
- High-density boxy tables, rounded row strips with vertical gaps
- Skeleton loaders (`src/components/skeletons/*`), never spinners for page loads

---

## 3. Data model (Cloud / Postgres)

Core tables (all tenant-scoped with RLS on `tenant_id`):

- `projects` — merchant, MID, platform, ARR, stage, current owner team, assigned owner,
  pending acceptance, expected go-live, transfer history
- `checklist_items` — per project tasks, responsibility (internal vs merchant), completion, timestamps
- `checklist_comments` — threaded comments per checklist item
- `profiles` / `user_roles` — user identity and role (`team_role` enum: mint, integration, ms, manager, super_admin)
- `tenants` + `tenant_settings` — workspace isolation, labels, theme, logo
- `custom_fields`, `checklist_forms` — per-tenant schema extension
- `workflow_rules` — trigger/action automation stored as JSON logic
- `activity_log` — audit of app actions and API calls
- `parsed_emails` — inbound email → project intake

Rules when adding tables: `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → policies.
Roles are always stored in `user_roles`, never on profiles.

---

## 4. Edge functions (`supabase/functions`)

| Function | Purpose |
| --- | --- |
| `ai-chat` | Chatbot with tool-calling over projects/checklists |
| `ai-project-insights` | Risk, health and forecast insights |
| `ai-field-mapping` | Maps CSV columns to project fields on import |
| `bootstrap-user`, `create-user`, `update-user`, `delete-user`, `set-password` | Admin user lifecycle |
| `poll-emails` | Pulls inbound mail, creates projects |
| `send-notification`, `send-scheduled-report` | Outbound email |
| `workflow-events` + `_shared/workflow-engine.ts` | Evaluates workflow rules and executes actions |

---

## 5. Frontend map

```
src/
  pages/          Index, ProjectWorkspace, NotFound
  components/
    LoginScreen, TeamDashboard, ManagerDashboard
    ProjectCardNew, KanbanBoard/KanbanCard, ProjectCalendar
    AiChatBot, AiSmartAlerts
    project-workspace/  Checklist panel, activity timeline, metric cards, sections
    reports/            Executive dashboard, operational, tactical, builder, scheduler
    settings/           General+workflow, custom fields, checklist forms, activity log, secrets, themes
    skeletons/          Dashboard + workspace loading states
  contexts/       Auth, Project, Labels
  hooks/          useProjects, useChecklistForms, useCustomFields, useVoiceAssistant, …
  utils/          aiHealthScore, aiInsights, exports (CSV), workflow events, notifications
  data/           projectsData (types + time calculations), teams (labels/colours)
```

Conventions:
- Business logic in `contexts/` + `hooks/`; components stay presentational
- Table/column preferences persisted in `localStorage` (list view column order)
- Settings use draft state + sticky save bar — no auto-save

---

## 6. Use cases we solve today

**Handover & ownership**
1. Sales closes a merchant → project created (manual, CSV bulk import, or inbound email parsing)
2. Owner assignment per team; recipient must accept or reject a transfer with a reason
3. Full transfer history and audit trail per project

**Execution**
4. Stage-wise checklists with internal vs merchant responsibility split
5. Threaded comments on each checklist item
6. TAT / time-split tracking (time spent internally vs waiting on merchant)
7. Custom fields and custom checklist forms per tenant

**Visibility**
8. Kanban board by stage, list view with drag-to-reorder columns, calendar of go-lives
9. Manager dashboard: workloads, pipeline, ARR-weighted views
10. Executive, operational and tactical reports + report builder + scheduled email reports
11. CSV export of projects, reports and form data

**Automation & AI**
12. Workflow rules — triggers (stage change, SLA breach, field update) → actions (assign, notify, update)
13. AI chatbot with tool-calling: query projects, risks, workloads, forecasts, handoff analysis
14. AI health score (0–100) and Smart Alerts for stale, overdue or unassigned high-ARR projects
15. AI field mapping on CSV upload
16. Voice assistant (speech-to-command, female TTS readback) inside the chatbot

**Governance**
17. Multi-tenant isolation with auto-provisioning by email domain
18. Role-based access (mint / integration / MS / manager / super admin)
19. Central activity log for app and API actions

---

## 7. Local development

```bash
npm i           # or bun install
npm run dev     # Vite on :8080
npx vitest run  # tests
```

Cloud credentials come from `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) —
auto-generated, do not edit. Client import is always:

```ts
import { supabase } from "@/integrations/supabase/client";
```

Never edit `src/integrations/supabase/client.ts`, `types.ts`, or `supabase/config.toml` by hand.

---

## 8. Adding a feature — checklist

1. Migration first (table + GRANT + RLS + policies), regenerate types
2. Hook in `src/hooks/` for data access; expose via context if global
3. UI with semantic tokens only; add skeleton loading state
4. Wire audit logging (`activity_log`) for any mutating action
5. If it should be automatable, add a trigger/action to the workflow engine
6. If it should be conversational, add a tool to `ai-chat`
