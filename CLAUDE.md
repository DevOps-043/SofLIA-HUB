# SofLIA Hub — Project Guide

## What is SofLIA Hub?

SofLIA Hub is an **Electron desktop application** that serves as an AI-powered business operations platform. It combines a WhatsApp agent, Google Workspace integration, activity monitoring, project management (IRIS), CRM-lite, and a BPM workflow engine — all orchestrated by Google Gemini AI. The app is built for a Spanish-speaking audience (all UI and prompts are in Spanish).

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop | Electron | 30.5.1 |
| Frontend | React | 18.2.0 |
| Language | TypeScript | 5.7.3 |
| Build | Vite + vite-plugin-electron | 5.4.21 |
| CSS | Tailwind CSS v4 | 4.1.18 |
| AI | Google Gemini (`@google/generative-ai`) | 0.24.1 |
| Database | 3x Supabase + better-sqlite3 (local) | — |
| WhatsApp | @whiskeysockets/baileys | 7.0.0-rc.9 |
| Google APIs | googleapis (Calendar, Gmail, Drive, Chat) | 171.4.0 |
| OCR | tesseract.js | 5.1.0 |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                  SofLIA Hub (Electron 30.5)                      │
├─────────────────────────┬────────────────────────────────────────┤
│  Renderer (React 18)    │  Main Process (Node.js)                │
│                         │                                        │
│  src/components/ (18)   │  electron/ (43 .ts files)              │
│  src/services/ (19)     │  IPC via contextBridge + preload.ts    │
│  src/lib/ (Supabase)    │  Security: CSP + channel allowlist     │
│  src/contexts/          │                                        │
├─────────────────────────┴────────────────────────────────────────┤
│  3 Supabase Instances    │  Local SQLite (memory, knowledge)     │
│  SOFIA · Lia · IRIS     │  JSON config files (userData/)         │
└──────────────────────────────────────────────────────────────────┘
```

### IPC Pattern (strict)

1. `electron/*-service.ts` — Business logic in main process
2. `electron/*-handlers.ts` — `ipcMain.handle()` registrations
3. `electron/preload.ts` — `contextBridge.exposeInMainWorld()` with allowlisted channels
4. `src/services/*-service.ts` or `src/services/*-renderer-service.ts` — Typed wrappers for renderer

**Security:** All IPC goes through `ALLOWED_IPC_CHANNELS` allowlist + payload sanitization + CSP injection. Never add channels without also adding them to the allowlist array in `preload.ts`.

---

## Supabase Instances

| Instance | Purpose | Env Vars |
|----------|---------|----------|
| **SOFIA** | Authentication, organizations, teams, user profiles | `VITE_SOFIA_SUPABASE_URL`, `VITE_SOFIA_SUPABASE_ANON_KEY` |
| **Lia** | Conversations, messages, folders, monitoring sessions, daily summaries | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **IRIS** | Projects, issues, sprints, CRM (companies/contacts/opportunities), workflows, artifacts, approvals | `VITE_IRIS_SUPABASE_URL`, `VITE_IRIS_SUPABASE_ANON_KEY` |

IRIS is accessed from both renderer (`src/services/iris-data.ts`) and main process (`electron/iris-data-main.ts`) — each creates its own Supabase client.

---

## AI Models (Google Gemini)

Configured in `src/config.ts`:

| Alias | Model ID | Usage |
|-------|----------|-------|
| PRIMARY | `gemini-3-flash-preview` | Chat, WhatsApp agent, workflow extraction |
| PRO | `gemini-3-pro-preview` | Complex generation (proposals, deep analysis) |
| FALLBACK | `gemini-2.5-flash` | Fallback when primary/pro fails |
| LIVE | `gemini-2.5-flash-native-audio-preview` | Bidirectional audio (Live API) |
| IMAGE | `gemini-2.5-flash-image` | Image generation |
| DEEP_RESEARCH | `deep-research-pro-preview` | Deep research |

All AI services use `responseMimeType: 'application/json'` for structured output and include fallback logic (primary model → fallback model).

---

## Key Policies

- **No webhooks** — All external monitoring uses `setInterval` polling. Calendar: 60s, Proactive: 5min, SLA: 60s, Transcript watcher: 2min, WhatsApp queue: 5s.
- **HITL (Human-in-the-Loop)** — Critical workflow steps require human approval before execution. "Sin aprobacion no se ejecuta."
- **No invented data** — AI must not hallucinate. Missing data → block and request context.
- **Idempotency** — Workflow actions use `idempotency_key` UNIQUE constraints.
- **trace_id** — End-to-end correlation UUID across all workflow tables.

---

## Directory Structure

### `electron/` — Main Process Services (43 files)

**Core:**
- `main.ts` — Entry point, initializes all services, tray, lifecycle
- `preload.ts` — Security bridge, CSP, contextBridge APIs

**WhatsApp:**
- `whatsapp-service.ts` — Baileys connection, QR auth, send/receive
- `whatsapp-agent.ts` — Gemini agentic loop with tool calling
- `whatsapp-workflow-presentacion.ts` — Presentation workflow (state machine)
- `whatsapp-workflow-reunion.ts` — Meeting workflow adapter (WhatsApp ↔ WorkflowEngine)
- `whatsapp-terminal.ts` — Terminal emulation over WhatsApp

**Google Workspace:**
- `calendar-service.ts` — Google Calendar + Microsoft Outlook, OAuth hub (`getGoogleAuth()`)
- `gmail-service.ts` — Gmail API (send, read, labels)
- `drive-service.ts` — Drive API (list, upload, download, folders)
- `drive-transcript-watcher.ts` — Auto-detect transcripts in Drive (Meet, Plaud Note, manual)
- `gchat-service.ts` — Google Chat API (spaces, messages)
- `*-handlers.ts` — IPC handlers for each service

**Workflow + CRM (Business Logic):**
- `workflow-engine.ts` — Generic BPM-lite state machine (startRun, advance, approve, SLA)
- `workflow-ai-service.ts` — AI extraction + artifact generation (email, WhatsApp, tasks, agenda, proposal)
- `workflow-handlers.ts` — IPC handlers for workflow + CRM + transcript watcher
- `crm-service.ts` — CRM-lite (companies, contacts, opportunities, deduplication via Jaccard similarity)

**AutoDev (Autonomous Programming):**
- `autodev-service.ts` — Multi-agent system (Security, Deps, Quality, Coder, Reviewer, Tester)
- `autodev-git.ts`, `autodev-sandbox.ts`, `autodev-selflearn.ts`, `autodev-prompts.ts`, `autodev-web.ts`, `autodev-types.ts`

**Memory + Knowledge:**
- `memory-service.ts` — 4-layer memory (raw SQLite, rolling summaries, embeddings, facts)
- `knowledge-service.ts` — OpenClaw-style `.md` file knowledge base

**Monitoring:**
- `monitoring-service.ts` — Activity tracking (screenshots, window, idle, OCR)
- `ocr-service.ts` — Tesseract.js worker
- `proactive-service.ts` — Calendar reminders + deadline alerts

**Infrastructure:**
- `computer-use-handlers.ts` — File/terminal/clipboard/screenshot tools
- `summary-generator.ts` — End-of-day productivity summaries
- `system-guardian.ts` — CPU/RAM/disk watchdog
- `iris-data-main.ts` — IRIS Supabase client for main process
- `mcp-manager.ts` — Model Context Protocol handler
- `neural-organizer.ts` — File organization with OCR + AI
- `semantic-indexer.ts` — SQLite full-text + semantic search
- `thought-logger.ts` — Task persistence

### `src/` — Renderer (React)

**Components (18):**
- `App.tsx` — Root container, sidebar, views routing
- `Auth.tsx` — Login form
- `FlowMode.tsx` — Multi-turn chat with tool execution
- `ProductivityDashboard.tsx` — Activity stats
- `ProjectHub.tsx` — IRIS project management
- `ApprovalInbox.tsx` — HITL approval queue (30s polling)
- `ArtifactReviewModal.tsx` — Review AI-generated artifacts
- `WorkflowTimeline.tsx` — Visual workflow execution timeline
- `MeetingWorkflowTrigger.tsx` — Manual meeting trigger form
- `WhatsAppSetup.tsx` — QR code, session management
- `SettingsModal.tsx` — API keys, integrations config
- `AutoDevPanel.tsx` — AutoDev control panel
- `ConfirmActionModal.tsx` — Generic confirmation dialog
- `ScreenViewer.tsx` — Desktop capture viewer
- `UserManagementModal.tsx` — Team members
- `ToolLibrary.tsx`, `ToolEditorModal.tsx` — AI tool management
- `FolderModals.tsx` — Folder CRUD

**Services (19):**
- `chat-service.ts`, `flow-service.ts`, `folder-service.ts` — Conversation management
- `gemini-chat.ts`, `gemini-tools.ts` — Gemini streaming + tools
- `live-api.ts` — WebSocket bidirectional audio
- `sofia-auth.ts` — SOFIA authentication
- `iris-data.ts` — IRIS Supabase client
- `workflow-renderer-service.ts` — `window.workflow.*` wrapper
- `crm-renderer-service.ts` — `window.crm.*` wrapper
- `monitoring-service.ts`, `gmail-service.ts`, `drive-service.ts` — IPC wrappers
- `api-keys.ts`, `settings-service.ts`, `org-service.ts`, `tools-service.ts`
- `image-generation.ts` — Image generation

**Config:**
- `src/config.ts` — Supabase URLs, model IDs, Live API URL
- `src/lib/supabase.ts` — Lia client
- `src/lib/supabase-sofia.ts` — SOFIA client
- `src/lib/supabase-iris.ts` — IRIS client

### `sql/` — Database Schemas

- `workflow-crm-tables.sql` — CRM + Workflow tables (execute in IRIS Supabase)
  - `crm_companies`, `crm_contacts`, `crm_opportunities`, `crm_interactions`
  - `workflow_definitions`, `workflow_runs`, `workflow_step_runs`, `workflow_artifacts`, `workflow_approvals`
- `monitoring-tables.sql` — Monitoring tables (execute in Lia Supabase)

---

## Environment Variables

```bash
VITE_GEMINI_API_KEY=           # Google Gemini API key
VITE_SUPABASE_URL=             # Lia Supabase URL
VITE_SUPABASE_ANON_KEY=        # Lia anon key
VITE_SOFIA_SUPABASE_URL=       # SOFIA Supabase URL
VITE_SOFIA_SUPABASE_ANON_KEY=  # SOFIA anon key
VITE_IRIS_SUPABASE_URL=        # IRIS Supabase URL
VITE_IRIS_SUPABASE_ANON_KEY=   # IRIS anon key
VITE_GOOGLE_OAUTH_CLIENT_ID=   # Google OAuth client ID
VITE_GOOGLE_OAUTH_CLIENT_SECRET= # Google OAuth client secret
```

---

## Workflow System (Meeting Follow-up)

The meeting workflow is the primary business process:

```
Trigger (WhatsApp/Drive/Manual)
  → Step 1: extract (AI entity extraction + HITL approval)
  → Step 2: create_crm (Company + Contact + Opportunity)
  → Steps 3-7 (parallel): gen_email, gen_whatsapp, gen_tasks, gen_agenda, gen_proposal
  → Step 8: route_team (assign owners + SLA)
  → Step 9: close_cycle (update stage + lessons learned)
```

**Trigger sources:**
- WhatsApp: `/reunion` command or natural language ("tuve una reunion con...")
- Drive auto-detection: Google Meet transcripts, Plaud Note exports, manual uploads to "SofLIA Transcripts" folder
- Manual: MeetingWorkflowTrigger component in UI

**Approval flow:** AI v1 → human review (approve/edit/reject/request context) → v2 → execution

**Artifact types:** `entity_extraction`, `email_draft`, `whatsapp_message`, `iris_task`, `meeting_agenda`, `proposal_brief`

---

## Development Commands

```bash
npm run dev        # Start dev server (Vite + Electron)
npm run build      # Production build
npm run lint       # ESLint (strict, no warnings)
npx tsc --noEmit   # TypeScript check
```

---

## Conventions

- **Language:** All UI text, prompts, comments, and logs in Spanish
- **File naming:** kebab-case for all files
- **IPC naming:** `namespace:action` (e.g., `workflow:start-run`, `crm:get-company`, `transcript:force-scan`)
- **Service pattern:** `EventEmitter` subclass with `init()`, `start()`, `stop()`, `getConfig()`, `getStatus()`
- **Error handling:** All IPC handlers return `{ success: boolean, error?: string, ...data }`
- **Config persistence:** JSON files in `app.getPath('userData')`
- **No webhooks:** Use `setInterval` polling for all external data
- **Imports:** Use `type` imports for type-only usage (`import type { ... }`)
- **React 18:** No need to `import React` — JSX transform is automatic
