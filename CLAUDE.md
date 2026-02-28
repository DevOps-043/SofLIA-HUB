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

All AI services use `responseMimeType: 'application/json'` for structured output and include fallback logic (primary model -> fallback model).

---

## Key Policies

- **No webhooks** — All external monitoring uses `setInterval` polling. Calendar: 60s, Proactive: 5min, SLA: 60s, Transcript watcher: 2min, WhatsApp queue: 5s.
- **HITL (Human-in-the-Loop)** — Critical workflow steps require human approval before execution. "Sin aprobacion no se ejecuta."
- **No invented data** — AI must not hallucinate. Missing data -> block and request context.
- **Idempotency** — Workflow actions use `idempotency_key` UNIQUE constraints.
- **trace_id** — End-to-end correlation UUID across all workflow tables.

---

## AutoDev — Autonomous Self-Programming System

AutoDev is a multi-agent system that autonomously improves SofLIA's codebase. It has **3 trigger modes**:

### Mode 1: Scheduled (Full Run)
- **Trigger**: Cron schedule (default: `0 3 * * *` = 3 AM daily)
- **Condition**: System idle >5 minutes
- **Pipeline**: 8-agent full pipeline (5 research agents -> deep research -> analyzer -> planner -> coder -> reviewer -> tester -> commit/PR)
- **Scope**: 500+ lines, up to 30 files, full research with Google Search grounding
- **Limit**: `maxDailyRuns: 3`

### Mode 2: Manual (Full Run)
- **Trigger**: WhatsApp command (`autodev_run_now` tool) or UI button
- **Pipeline**: Same full 8-agent pipeline as scheduled
- **Spawns**: Standalone terminal process to avoid blocking Electron UI

### Mode 3: Micro-Fix (Reactive — NEW)
- **Trigger**: Automatic — when SelfLearnService detects a small error or user suggestion
- **Pipeline**: Lightweight 4-phase pipeline (analyze -> code -> build verify -> commit/PR)
- **Scope**: Max 5 files, max 200 lines changed, NO research phase
- **Limit**: `maxDailyMicroRuns: 5` (separate from full runs)
- **Debounce**: Waits 3 minutes to batch related issues before running

**Micro-Fix Flow:**
```
User says "no funciona X" on WhatsApp
  -> SelfLearnService.analyzeUserMessage() detects complaint pattern
  -> Logs to AUTODEV_ISSUES.md
  -> Classifies severity: micro-fixable vs needs-full-run
  -> Emits 'micro-fix-candidate' event
  -> AutoDevService.queueMicroFix() adds to debounce queue
  -> After 3 min debounce: executeMicroFix()
    Phase 1: Analyze trigger + read relevant source files
    Phase 2: Code the fix (reuses implementStep)
    Phase 3: Build verify (npx tsc --noEmit, 1 retry with auto-fix)
    Phase 4: Commit + Push + create PR
  -> Notify owner via WhatsApp (short summary)
```

**Auto-trigger categories (configurable):**
- `autoTriggerOnComplaint` — User complaints ("no funciona", "no sirve", etc.)
- `autoTriggerOnSuggestion` — User suggestions ("deberias poder...", "agrega...")
- `autoTriggerOnToolFailure` — Tool execution errors

**Issues too big for micro-fix (routed to full run):**
- Messages >500 chars, keywords like "refactor", "arquitectura", "desde cero"

### Config (`autodev-types.ts`)
```typescript
microFix: {
  enabled: true,
  maxDailyMicroRuns: 5,
  debounceMinutes: 3,
  maxFiles: 5,
  maxLines: 200,
  autoTriggerOnComplaint: true,
  autoTriggerOnSuggestion: true,
  autoTriggerOnToolFailure: true,
  minIdleSeconds: 0,
}
```

### Key Files
- `electron/autodev-service.ts` — Core orchestration (full + micro pipelines)
- `electron/autodev-selflearn.ts` — EventEmitter that detects failures/suggestions, classifies severity, emits `micro-fix-candidate`
- `electron/autodev-types.ts` — Config types including `MicroFixConfig`, `MicroFixTrigger`, `AutoDevRunMode`
- `electron/autodev-prompts.ts` — Agent prompts including `MICRO_FIX_ANALYZE_PROMPT`, `MICRO_FIX_SUMMARY_PROMPT`
- `electron/autodev-handlers.ts` — IPC handlers including `autodev:micro-fix-status`, `autodev:trigger-micro-fix`
- `electron/main.ts` — Wires `selfLearnService.on('micro-fix-candidate')` -> `autoDevService.queueMicroFix()`

---

## Directory Structure

### `electron/` — Main Process Services (43+ files)

**Core:**
- `main.ts` — Entry point, initializes all services, tray, lifecycle
- `preload.ts` — Security bridge, CSP, contextBridge APIs

**WhatsApp:**
- `whatsapp-service.ts` — Baileys connection, QR auth, send/receive
- `whatsapp-agent.ts` — Gemini agentic loop with tool calling
- `whatsapp-workflow-presentacion.ts` — Presentation workflow (state machine)
- `whatsapp-workflow-reunion.ts` — Meeting workflow adapter (WhatsApp <-> WorkflowEngine)

**Google Workspace:**
- `calendar-service.ts` — Google Calendar + Microsoft Outlook, OAuth hub (`getGoogleAuth()`)
- `gmail-service.ts` — Gmail API (send, read, labels)
- `drive-service.ts` — Drive API (list, upload, download, folders)
- `drive-transcript-watcher.ts` — Auto-detect transcripts in Drive (Meet, Plaud Note, manual)
- `gchat-service.ts` — Google Chat API (spaces, messages)

**Workflow + CRM:**
- `workflow-engine.ts` — Generic BPM-lite state machine
- `workflow-ai-service.ts` — AI extraction + artifact generation
- `workflow-handlers.ts` — IPC handlers for workflow + CRM + transcript watcher
- `crm-service.ts` — CRM-lite (companies, contacts, opportunities, Jaccard deduplication)

**AutoDev:**
- `autodev-service.ts` — Multi-agent system (full + micro pipelines)
- `autodev-selflearn.ts` — Failure detection, user feedback, micro-fix classification
- `autodev-git.ts`, `autodev-sandbox.ts`, `autodev-prompts.ts`, `autodev-web.ts`, `autodev-types.ts`

**Memory + Knowledge:**
- `memory-service.ts` — 4-layer memory (raw SQLite, rolling summaries, embeddings, facts)
- `knowledge-service.ts` — OpenClaw-style `.md` file knowledge base

**Monitoring:**
- `monitoring-service.ts` — Activity tracking (screenshots, window, idle, OCR)
- `proactive-service.ts` — Calendar reminders + deadline alerts

### `src/` — Renderer (React)

**Components (18):** App, Auth, FlowMode, ProductivityDashboard, ProjectHub, ApprovalInbox, ArtifactReviewModal, WorkflowTimeline, MeetingWorkflowTrigger, WhatsAppSetup, SettingsModal, AutoDevPanel, ConfirmActionModal, ScreenViewer, UserManagementModal, ToolLibrary, ToolEditorModal, FolderModals

**Services (19):** chat-service, flow-service, folder-service, gemini-chat, gemini-tools, live-api, sofia-auth, iris-data, workflow-renderer-service, crm-renderer-service, monitoring-service, gmail-service, drive-service, api-keys, settings-service, org-service, tools-service, image-generation

### `sql/` — Database Schemas
- `workflow-crm-tables.sql` — CRM + Workflow tables (IRIS Supabase)
- `monitoring-tables.sql` — Monitoring tables (Lia Supabase)

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

## Development Commands

```bash
npm run dev        # Start dev server (Vite + Electron)
npm run build      # Production build
npm run lint       # ESLint (strict, no warnings)
npx tsc --noEmit   # TypeScript check
npm run autodev    # Run AutoDev standalone (outside Electron)
```

---

## Conventions

- **Language:** All UI text, prompts, comments, and logs in Spanish
- **File naming:** kebab-case for all files
- **IPC naming:** `namespace:action` (e.g., `workflow:start-run`, `crm:get-company`, `autodev:micro-fix-status`)
- **Service pattern:** `EventEmitter` subclass with `init()`, `start()`, `stop()`, `getConfig()`, `getStatus()`
- **Error handling:** All IPC handlers return `{ success: boolean, error?: string, ...data }`
- **Config persistence:** JSON files in `app.getPath('userData')`
- **No webhooks:** Use `setInterval` polling for all external data
- **Imports:** Use `type` imports for type-only usage (`import type { ... }`)
- **React 18:** No need to `import React` — JSX transform is automatic
