# SofLIA Hub — Complete Project Guide

## What is SofLIA Hub?

SofLIA Hub is an **Electron 34 desktop application** (v0.1.7) — an AI-powered business operations platform for Spanish-speaking teams. It orchestrates:

- **WhatsApp AI Agent** — Gemini-powered conversational assistant with 40+ tools (file ops, Google Workspace, IRIS, web search, desktop automation)
- **Telegram Bot** — Alternative messaging channel with workspace automation and workflow access
- **Google Workspace Integration** — Calendar, Gmail, Drive, Google Chat with OAuth2
- **Activity Monitoring** — Screenshots, OCR, window tracking, idle detection, daily summaries
- **Project Management (IRIS)** — Teams, projects, issues, sprints, statuses, priorities
- **CRM-lite** — Companies, contacts, opportunities with Jaccard deduplication
- **Meeting Ops** — 12-service meeting pipeline: passive detection, AI processing, HITL review, IRIS sync
- **Workflow Hub** — Unified orchestrator for all workflow types (presentations, meetings, workspace automation)
- **Workspace Automation** — Template-based multi-step automations with HITL approval
- **Desktop Agent** — Vision-based computer automation (Gemini Vision -> screenshot -> PowerShell P/Invoke)
- **Flow Mode** — Always-on-top voice dictation overlay with Gemini Live API + text insertion into any app
- **4-Layer Memory** — Raw persistence, rolling summaries, semantic embeddings, structured facts
- **Daily Briefing** — Automated morning briefings delivered via WhatsApp
- **Background Host + Remote Nodes** — Distributed task execution across machines
- **Dynamic Tools** — Hot-reloadable tool plugins via filesystem watch

All UI, prompts, comments, and logs are in **Spanish**.

---

## Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Desktop | Electron | 34.0.0 | Main + Renderer process |
| Frontend | React | 18.2.0 | JSX transform (no `import React`) |
| Language | TypeScript | 5.7.3 | Strict mode, bundler resolution |
| Build | Vite 7 + vite-plugin-electron | 7.0.0 / 0.29.0 | CJS output for native modules |
| CSS | Tailwind CSS v4 | 4.1.18 | PostCSS integration |
| AI | Google Gemini (`@google/generative-ai`) | 0.24.1 | 9 model aliases, JSON response mode |
| Database | 3x Supabase + better-sqlite3 (local) | 2.95.3 / 12.8.0 | Triple-instance strategy |
| WhatsApp | @whiskeysockets/baileys | 7.0.0-rc.9 | WebSocket, QR auth |
| Telegram | Custom integration | — | Bot API with workspace automation |
| Google APIs | googleapis | 171.4.0 | Calendar, Gmail, Drive, Chat |
| Microsoft | @azure/msal-node + Graph Client | 5.0.4 / 3.0.7 | Outlook Calendar |
| OCR | tesseract.js | 5.0.5 | Spanish + English |
| Image Processing | sharp | 0.34.5 | Screenshot compositing |
| Scheduling | node-cron + cron | 3.0.3 / 4.4.0 | Task scheduler |
| Documents | pptxgenjs + docx + exceljs | 4.0.1 / 8.5.0 / 4.4.0 | Presentations, Word, Excel |
| Browser Automation | playwright-core | 1.58.2 | Web agent capabilities |
| Validation | zod | 3.24.2 | Runtime type validation |
| Logging | pino | 10.3.1 | Structured logging |
| Email | Nodemailer | 6.9.13 | SMTP for notifications |
| Testing | vitest + @testing-library | 4.1.0 | Unit + component tests |
| Updates | electron-updater | 6.8.3 | Auto-update polling |
| Animation | framer-motion | 11.18.2 | UI animations |

---

## Architecture Overview

```
+-------------------------------------------------------------------------+
|                       SofLIA Hub (Electron 34.0)                         |
+-------------------------------+-----------------------------------------+
|   Renderer (React 18)         |   Main Process (Node.js)                 |
|                               |                                          |
|   src/components/ (19)        |   electron/ (82 root .ts files)          |
|   src/services/ (27)          |   electron/meetings/ (12 files)          |
|   src/adapters/ (6)           |   electron/tools/ (3 files)              |
|   src/hooks/ (7)              |   electron/services/ (4 files)           |
|   src/prompts/ (4)            |   electron/utils/ (4 files)              |
|   src/contexts/ (Auth)        |   electron/whatsapp-executors/ (4 files) |
|   src/lib/ (4 Supabase)       |   electron/computer-use/ (1 file)       |
|   src/core/ (entities+ports)  |   electron/__tests__/ (25 files)         |
|   src/shared/ (1)             |                                          |
|                               |   IPC: contextBridge + preload.ts        |
|                               |   Security: CSP + 187-channel allowlist  |
|                               |   + payload sanitization                 |
+-------------------------------+-----------------------------------------+
|                          Data Layer                                      |
|  +----------+  +----------+  +----------+  +------------------------+   |
|  |  SOFIA   |  |  Lia     |  |  IRIS    |  |  Local SQLite          |   |
|  |  Auth    |  |  Chat    |  |  Projects|  |  memory, knowledge,    |   |
|  |  Orgs    |  |  Monitor |  |  CRM     |  |  semantic index, facts |   |
|  |  Teams   |  |  Memory  |  |  Workflow|  |  thoughts, meetings    |   |
|  +----------+  +----------+  +----------+  +------------------------+   |
|                                                                          |
|  JSON Config (userData/): monitoring-config.json, proactive-config.json, |
|  daily-briefing.json, workspace-automation.json, etc.                    |
+-------------------------------------------------------------------------+
```

### IPC Pattern (strict)

Every feature follows this 4-layer pattern:

1. `electron/*-service.ts` — Business logic in main process (EventEmitter subclass)
2. `electron/*-handlers.ts` — `ipcMain.handle()` registrations (returns `{ success, error?, ...data }`)
3. `electron/preload.ts` — `contextBridge.exposeInMainWorld()` with **187 allowlisted channels**
4. `src/services/*-service.ts` — Typed renderer wrappers calling `window.electronAPI.invoke()`

**Security rules:**
- All IPC goes through `ALLOWED_IPC_CHANNELS` allowlist — never add channels without updating `preload.ts`
- Payload sanitization on all incoming data
- CSP injection prevents arbitrary script execution
- `whatsapp-remote-hub.ts` has blocked regex patterns for dangerous commands
- BrowserWindow: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`

### IPC Channel Namespaces (187 channels)

| Namespace | Count | Purpose |
|-----------|-------|---------|
| `computer:*` | 23 | Filesystem, shell, clipboard, email, system info |
| `whatsapp:*` | 8 | Connection, QR, status, config, send |
| `monitoring:*` | 12 | Session control, config, snapshots, summaries |
| `calendar:*` | 15 | OAuth (Google + Microsoft), events, connections, CRUD |
| `gmail:*` | 12 | Send, read, labels, trash, organization preview |
| `drive:*` | 7 | List, search, upload, download, folders |
| `gchat:*` | 5 | Spaces, messages, reactions, members |
| `desktop-agent:*` | 23 | Task execution, screenshot, mouse/keyboard/window |
| `meeting:*` | 10 | List runs, create manual, approve, sync, detection |
| `automation:*` | 7 | Templates, execute, approve, history |
| `workflow-hub:*` | 9 | Overview, case detail, approve, execute |
| `telegram:*` | 5 | Status, config, send message |
| `background-host:*` | 3 | Status, config, repair |
| `remote-node:*` | 13 | Host status, list/register nodes, execute tasks |
| `proactive:*` | 4 | Config, trigger, status |
| `memory:*` | 5 | Stats, compact, facts, search |
| `flow:*` | 4 | Message passing, text insertion, window control |
| `updater:*` | 7 | Check, download, install, progress events |
| Screen capture | 3 | capture-screen, get-screen-sources, get-desktop-sources |

---

## Supabase Instances (Triple-Instance Strategy)

| Instance | Purpose | Key Tables | Env Vars |
|----------|---------|------------|----------|
| **SOFIA** | Auth, organizations, teams, user profiles, roles | `users`, `organizations`, `organization_users`, `organization_teams` | `VITE_SOFIA_SUPABASE_URL`, `VITE_SOFIA_SUPABASE_ANON_KEY` |
| **Lia** | Conversations, messages, folders, monitoring, calendar connections, profiles | `conversations`, `messages`, `folders`, `profiles`, `monitoring_sessions`, `activity_logs`, `daily_summaries`, `calendar_connections` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **IRIS** | Projects, issues, sprints, CRM, workflows, meetings, approvals | `teams`, `projects`, `issues`, `statuses`, `priorities`, `crm_companies`, `crm_contacts`, `crm_opportunities`, `workflow_runs`, `workflow_steps`, `approvals`, `artifacts`, `meeting_runs`, `meeting_assets` | `VITE_IRIS_SUPABASE_URL`, `VITE_IRIS_SUPABASE_ANON_KEY` |

**Access patterns:**
- SOFIA: renderer only (`src/lib/sofia-client.ts`, `src/contexts/AuthContext.tsx`)
- Lia: renderer (`src/lib/supabase.ts`, `src/lib/supabase-factory.ts`) + main (`electron/memory-service.ts`, `electron/monitoring-service.ts`)
- IRIS: renderer (`src/services/iris-data.ts`) + main (`electron/iris-data-main.ts`) — each creates its own client

### Authentication System (SOFIA)

Login flow uses a custom RPC-based auth (NOT Supabase Auth):
1. `sofia-auth.ts` calls `supabase.rpc('authenticate_user', { p_identifier, p_password })`
2. `authenticate_user` uses `extensions.crypt()` (pgcrypto) for password verification
3. On success, fetches user profile, memberships, organizations, teams
4. Validates active membership exists (blocks suspended users)
5. Syncs Lia session (Supabase Auth) for conversation storage
6. Stores Lia credentials in localStorage (`lia-sync-cred`) for session recovery

**Critical: Password hashing MUST use pgcrypto `crypt()` + `gen_salt('bf', 10)` — NOT JavaScript bcrypt. See `FIX-PASSWORD-SOFLIA-LEARNING.md`.**

RPC functions available:
- `authenticate_user(p_identifier, p_password)` — Login
- `change_user_password(p_user_id, p_new_password)` — Admin/reset password change
- `change_own_password(p_user_id, p_current_password, p_new_password)` — User self-service

---

## Local SQLite Databases

| Database | Purpose | File |
|----------|---------|------|
| **Memory** | 4-layer memory (raw, rolling summaries, embeddings, facts) | `userData/memory.db` |
| **Knowledge** | OpenClaw-style `.md` file knowledge base index | `userData/knowledge.db` |
| **Thoughts** | Event stream for agent thought logging (ThoughtLogger + Orchestrator) | `userData/thoughts.db` |
| **Semantic Index** | FTS5 full-text search index of local files | `userData/semantic_index.db` |

---

## AI Models (Google Gemini)

Configured in `src/config.ts`:

| Alias | Model ID | Usage |
|-------|----------|-------|
| PRIMARY | `gemini-3-flash-preview` | Main chat, WhatsApp agent, analysis |
| FALLBACK | `gemini-2.5-flash` | Fallback when primary fails |
| PRO | `gemini-3.1-pro-preview` | Complex coding, deep analysis |
| WEB_AGENT | `gemini-3-flash-preview` | Web search grounding |
| LIVE | `gemini-2.5-flash-native-audio-preview-12-2025` | Flow Mode bidirectional audio |
| IMAGE_GENERATION | `gemini-2.5-flash-image` | Text-to-image |
| DEEP_RESEARCH | `deep-research-pro-preview-12-2025` | Deep research with web tools |
| TRANSCRIPTION | `gemini-2.5-flash` | Audio-to-text |
| MAPS | `gemini-2.5-flash` | Location/maps queries |

### Design Principles

- **No webhooks** — All external monitoring uses `setInterval` polling:
  - Calendar: 60s
  - Proactive alerts: 5min
  - Meeting passive detection: polling
  - WhatsApp queue: 5s
  - Auto-updater: 4 hours
- **HITL (Human-in-the-Loop)** — Critical workflow steps require human approval before execution. "Sin aprobacion no se ejecuta."
- **No invented data** — AI must not hallucinate. Missing data -> block and request context.
- **Idempotency** — Workflow actions use `idempotency_key` UNIQUE constraints.
- **trace_id** — End-to-end correlation UUID across all workflow tables.
- **Group safety** — Dangerous WhatsApp tools (file write, delete, shell, clipboard) are blocked in group chats.

---

## WhatsApp Agent — Tool Ecosystem (40+ tools)

The WhatsApp agent (`electron/whatsapp-agent.ts`) runs a Gemini agentic loop with function calling. Tool execution is organized via specialized executors in `electron/whatsapp-executors/`:

### Tool Categories

**File Operations:**
`list_directory`, `read_file`, `write_file`, `create_directory`, `move_item`, `copy_item`, `delete_item`, `get_file_info`, `search_files`, `organize_files`, `batch_move_files`, `list_directory_summary`

**System & Clipboard:**
`get_system_info`, `clipboard_read`, `clipboard_write`, `open_file_on_computer`, `open_url`

**Web & Search:**
`web_search`, `web_search_advanced`, `read_webpage`, `get_current_time`, `semantic_file_search`

**Google Workspace** (`whatsapp-executors/google-executors.ts`):
`gmail_send`, `gmail_read`, `gmail_trash`, `google_calendar_create`, `google_calendar_update`, `google_calendar_delete`, `google_drive_upload`, `google_drive_download`, `google_drive_search`, `gchat_send_message`, `gchat_get_members`

**IRIS** (`whatsapp-executors/iris-executors.ts`):
`iris_get_teams`, `iris_get_projects`, `iris_get_issues`, `iris_create_issue`, `iris_update_issue`, `iris_create_project`, `iris_get_statuses`, `iris_get_priorities`

**System Operations** (`whatsapp-executors/system-executors.ts`):
`execute_command`, `open_application`, `kill_process`, `lock_session`, `shutdown_computer`

**Desktop Agent:**
`desktop_agent_execute` — Delegates to DesktopAgentService for vision-based automation

**WhatsApp-Specific:**
`whatsapp_send_file`

**Blocked in Groups (safety):**
`execute_command`, `open_application`, `kill_process`, `lock_session`, `shutdown_computer`, `write_file`, `move_item`, `delete_item`, `clipboard_write`

### WhatsApp Files

| File | Purpose |
|------|---------|
| `whatsapp-service.ts` | Baileys WebSocket connection, QR auth, auto-reconnect, group support |
| `whatsapp-agent.ts` | Gemini agentic loop with 40+ tool declarations and function calling |
| `whatsapp-tools.ts` | Tool declarations and schema definitions |
| `whatsapp-tool-executor.ts` | Tool execution dispatcher |
| `whatsapp-prompts.ts` | System prompts for the WhatsApp agent |
| `whatsapp-text.ts` | Text formatting and response utilities |
| `whatsapp-audio-processor.ts` | Audio-to-text via Gemini multimodal (.ogg, .mp3, .wav) |
| `whatsapp-workflow-presentacion.ts` | Presentation state machine (-> Gamma API PDF) |
| `whatsapp-workflow-meetings.ts` | Meeting workflow adapter |
| `whatsapp-remote-hub.ts` | Zod-validated command sandbox with blocked regex patterns |
| `whatsapp-terminal.ts` | Terminal emulation for command execution |
| `whatsapp-handlers.ts` | IPC handlers for WhatsApp operations |

---

## Meeting Ops — 12-Service Pipeline

The meeting system (`electron/meetings/`) is a comprehensive pipeline for detecting, processing, reviewing, and syncing meetings:

### Pipeline Flow

```
Detection -> Source Collection -> AI Processing -> HITL Review -> IRIS Sync
```

### Service Files (`electron/meetings/`)

| File | Purpose |
|------|---------|
| `meeting-types.ts` | TypeScript interfaces for all meeting entities |
| `meeting-store.ts` | Persistent storage for meeting runs and assets |
| `meeting-source-service.ts` | Collects meeting sources (Drive transcripts, calendar events, email) |
| `meeting-ai-service.ts` | Gemini-powered extraction (summary, action items, decisions) |
| `meeting-review-service.ts` | HITL review and approval flow |
| `meeting-sync-service.ts` | Syncs approved actions to IRIS (creates issues, updates projects) |
| `meeting-workflow-service.ts` | Orchestrates the full pipeline end-to-end |
| `meeting-detection-store.ts` | Tracks which meetings have already been detected |
| `meeting-passive-detection-service.ts` | Polls Google Calendar/Drive/Gmail for new meeting artifacts |
| `meeting-context-pack.ts` | Builds context packs for AI processing |
| `meeting-assignee-service.ts` | Resolves assignees from meeting participants |
| `meeting-iris-client.ts` | Direct IRIS API client for meeting sync |

### Related Handlers
- `electron/meeting-handlers.ts` — IPC handlers for meeting operations
- `src/services/meeting-service.ts` — Renderer-side IPC wrapper

---

## Workflow Hub — Unified Orchestrator

`electron/workflow-hub-service.ts` provides a unified interface for all workflow types:

- Workspace automation workflows
- Meeting workflows
- Presentation workflows
- Custom scheduled workflows via TaskScheduler

Key features:
- Case-based tracking with unified status normalization
- HITL approval at configurable steps
- WhatsApp notification integration
- Cron-based passive workflow execution via TaskScheduler

---

## Workspace Automation

`electron/workspace-automation-service.ts` executes multi-step automations:

- Template-based (Gmail + Calendar + Drive + GChat + Desktop Agent)
- HITL approval before execution
- Step-by-step execution with rollback on failure
- Google Workspace service integration (shares CalendarService auth)

---

## Desktop Agent — Computer Automation

The Desktop Agent (`electron/desktop-agent-service.ts`) implements a **Perception-Planning-Action** loop:

1. **Perception**: Captures screenshot via `desktopCapturer`
2. **Planning**: Gemini Vision analyzes screenshot, generates JSON action plan
3. **Action**: Executes via PowerShell P/Invoke (mouse clicks, keyboard input, window management)

### Capabilities
Click, double-click, right-click, type text, key combinations, scroll, window focus/resize/minimize, drag-and-drop, wait.

### Key Files
- `electron/desktop-agent-service.ts` — Core Perception-Planning-Action loop
- `electron/desktop-agent-types.ts` — TypeScript type definitions
- `electron/desktop-agent-handlers.ts` — IPC handlers
- `electron/computer-use-handlers.ts` — Computer control primitives (mouse, keyboard, screenshot)
- `electron/computer-use/batch-file-ops.ts` — Batch file operations
- `electron/visual-debugger-service.ts` — Error zone annotation + WhatsApp reporting
- `electron/windows-uia-service.ts` — Windows UI Automation integration

---

## Flow Mode — Voice Dictation Overlay

`src/components/FlowMode.tsx` + `electron/main.ts` (flow window logic):

- **Global shortcut**: `Ctrl+M` opens/shows flow window
- **Always-on-top** transparent overlay (600x450, no frame)
- **Gemini Live API** for bidirectional audio via WebSocket
- **Text insertion**: Types transcribed text directly into the previously focused application via `desktopAgentService.keyboardType()`
- **Window tracking**: Remembers the foreground window before flow opens, restores focus after insertion

---

## Memory System — 4-Layer Architecture

`electron/memory-service.ts` implements a persistent memory system:

| Layer | Storage | Trigger | Budget |
|-------|---------|---------|--------|
| **L1: Raw Persistence** | SQLite `messages` table | Every message | Unlimited |
| **L2: Rolling Summaries** | SQLite `summaries` table | Every 50 messages | 400-token chunks, 80-token overlap |
| **L3: Semantic Embeddings** | SQLite `memory_chunks` + FTS5 | On store | Top-5, min score 0.30, 2000 tokens |
| **L4: Structured Facts** | SQLite `facts` table (key/value/category) | Extracted by AI | 1000 tokens |

**Plus:**
- **Knowledge Service** — OpenClaw-style `.md` files
- **Semantic Indexer** — FTS5 search across all project files for code-aware retrieval
- **Path Memory Service** — Proactive filesystem indexing (resolves OneDrive path rename issues)
- **Smart Search Tool** — Natural language file search wrapper

---

## Monitoring System

`electron/monitoring-service.ts` captures work activity:

- **Interval**: 30-60 seconds (configurable)
- **Captures**: Active window title, process name, URL, category
- **Idle Detection**: 120-second threshold
- **Screenshots**: Via `desktopCapturer` with optional `sharp` compositing
- **OCR**: `tesseract.js` (Spanish + English) for text extraction from screenshots
- **Storage**: In-memory buffer -> periodic flush to Lia Supabase
- **Daily Summaries**: Gemini-generated end-of-day summaries with metrics
- **Daily Digest**: PDF report generation + WhatsApp delivery
- **Calendar Integration**: Auto-start/stop monitoring based on Google Calendar work hours events

### Monitoring Tables (Lia Supabase)
- `monitoring_sessions` — Work blocks with trigger type, active/idle times, summary
- `activity_logs` — 30-second snapshots with window, idle, OCR, category
- `daily_summaries` — Aggregated daily stats with top apps/websites, projects
- `calendar_connections` — OAuth tokens for Google/Microsoft with auto-refresh

---

## Telegram Integration

`electron/telegram-service.ts` provides an alternative messaging channel:

- Bot API integration
- Access to workspace automation, workflow hub, and remote nodes
- Configuration via IPC handlers (`electron/telegram-handlers.ts`)
- Renderer wrapper (`src/services/telegram-service.ts`)

---

## Background Host + Remote Nodes

### Background Host (`electron/background-host-service.ts`)
- Manages background process lifecycle
- Status monitoring and auto-repair

### Remote Nodes (`electron/remote-node-service.ts`)
- Distributed task execution across machines
- Node registration, discovery, and health monitoring
- Task delegation to DesktopAgentService on remote machines
- 13 IPC channels for full lifecycle management

---

## Proactive Services

### Proactive Service (`electron/proactive-service.ts`)
- Calendar + task deadline alerts composed by Gemini
- Configurable polling intervals
- WhatsApp notification delivery

### Proactive System Cleanup (`electron/proactive-system-cleanup.ts`)
- Automated system maintenance and cleanup

### Proactive Process Monitor (`electron/services/proactive-process-monitor.ts`)
- Monitors running processes for anomalies

### Business Anomaly Monitor (`electron/services/business-anomaly-monitor.ts`)
- Detects business metric anomalies

---

## Additional Services

### Daily Briefing (`electron/daily-briefing-service.ts`)
- Automated morning briefings via WhatsApp
- Cron schedule: `0 8 * * 1-5` (weekdays at 8 AM)
- Configurable owner number

### Document Generation
- `electron/document-designer.ts` — Document creation
- `electron/slide-designer.ts` — Slide/presentation design
- `electron/presentation-pdf.ts` — PDF generation
- `electron/presentation-premium.ts` — Premium presentation features

### URL Summarizer (`electron/url-summarizer-workflow.ts`)
- Workflow for summarizing web content

### System Services (`electron/system-services.ts`)
- Centralized system service utilities

### LLM Task Service (`electron/llm-task-service.ts`)
- Generic LLM task execution service

### Browser Web Service (`electron/browser-web-service.ts`)
- Web browsing capabilities for agents

### Safe Browser Tool (`electron/safe-browser-tool.ts`)
- Offscreen window URL analysis for suspicious links

### App Launcher (`electron/app-launcher-tool.ts`)
- Cross-platform app launching

### Workstation Security (`electron/workstation-security.ts`)
- Security hardening for the workstation

### Neural Organizer (`electron/neural-organizer.ts`)
- Intelligent file organization with OCR + Gemini classification

### Auto-Backup (`electron/services/auto-backup-service.ts`)
- Automated backup service

### PC Alarm (`electron/services/pc-alarm-service.ts` + `electron/tools/pc-alarm-tool.ts`)
- Timer/alarm functionality

### Dynamic Tool Service (`electron/dynamic-tool-service.ts`)
- Hot-reloadable tool plugins from `tools/dynamic/`
- Filesystem watch for automatic discovery

### Built-in Tools (`electron/tools/`)
- `media-controller-tool.ts` — Media playback control
- `pc-alarm-tool.ts` — Timer/alarm tool
- `workspace-manager.ts` — Workspace management tool

---

## Service Initialization Order (`electron/main.ts`)

Services are initialized in dependency order using `runOptionalStep()` (non-fatal failures):

```
1. Imports & Instantiation
   +-- Core: WhatsApp, Memory, Knowledge, Monitoring
   +-- Google Workspace: Calendar, Gmail (shares Calendar auth), Drive (shares Calendar auth), GChat (shares Calendar auth)
   +-- Desktop: DesktopAgentService
   +-- Utilities: Updater, ClipboardAIAssistant, TaskScheduler, PathMemory
   +-- Proactive: ProactiveService
   +-- Workspace: WorkspaceAutomationService (receives all Google services + DesktopAgent)
   +-- Meetings: 8 meeting services (Store, Source, AI, Review, Sync, DetectionStore, Workflow, PassiveDetection)
   +-- Orchestration: WorkflowHubService (receives Calendar, GChat, TaskScheduler, WorkspaceAutomation, MeetingWorkflow)
   +-- Briefing: DailyBriefingService
   +-- Messaging: TelegramService
   +-- Distributed: BackgroundHostService, RemoteNodeService, DynamicToolService

2. Event Wiring
   +-- MeetingPassiveDetection 'meeting-detected' -> UI notification
   +-- TaskScheduler 'task-triggered' -> WorkflowHub or WhatsApp prompt injection
   +-- Calendar 'work-start/end' -> Monitoring auto-start/stop
   +-- Calendar 'connected' -> MeetingPassiveDetection scan
   +-- Monitoring 'session-ended' -> Generate summary via Gemini

3. Handler Registration (after app.whenReady())
   +-- MenuManager.setup()
   +-- registerFlowShortcut() (Ctrl+M)
   +-- registerComputerUseHandlers()
   +-- registerBackgroundHostHandlers()
   +-- registerRemoteNodeHandlers()
   +-- registerMonitoringHandlers()
   +-- registerCalendarHandlers()
   +-- registerGmailHandlers()
   +-- registerDriveHandlers()
   +-- registerGChatHandlers()
   +-- registerDesktopAgentHandlers()
   +-- registerMemoryHandlers()
   +-- registerUpdaterHandlers()
   +-- registerMeetingHandlers()
   +-- registerWorkspaceAutomationHandlers()
   +-- registerWorkflowHubHandlers()
   +-- registerTelegramHandlers()

4. Service Initialization (sequential, non-fatal)
   +-- memoryService.init()
   +-- knowledgeService.init()
   +-- meetingWorkflowService.init()
   +-- workspaceAutomationService.init()
   +-- workflowHubService.init()
   +-- meetingPassiveDetectionService.init()
   +-- pathMemoryService.init() + start()
   +-- updaterService.init()
   +-- taskScheduler.init()
   +-- clipboardAssistant.init()
   +-- dailyBriefingService.init()
   +-- backgroundHostService.init()
   +-- remoteNodeService.init()
   +-- telegramService.init()
   +-- dynamicToolService.init()

5. Window + Tray
   +-- createWindow()
   +-- createTray()

6. WhatsApp
   +-- initWhatsAppAgent() (if API key available)
   +-- waService.init()
   +-- calendarService.init()
   +-- meetingPassiveDetectionService.startPolling()
   +-- waService.connect() (if auto-connect enabled)
```

---

## Directory Structure

### `electron/` — Main Process (82 root .ts files + subdirectories)

**Core:**
- `main.ts` — Entry point, bootstraps all services, creates tray/windows, lifecycle management
- `minimal-main.ts` — Minimal entry point for testing
- `preload.ts` — Security bridge, CSP injection, contextBridge with 187 allowlisted channels
- `menu-manager.ts` — Application menu management

**WhatsApp (12 files):**
- `whatsapp-service.ts` — Baileys WebSocket connection, QR auth, auto-reconnect
- `whatsapp-agent.ts` — Gemini agentic loop with 40+ tools
- `whatsapp-tools.ts` — Tool declarations and schemas
- `whatsapp-tool-executor.ts` — Tool execution dispatcher
- `whatsapp-prompts.ts` — System prompts
- `whatsapp-text.ts` — Text formatting utilities
- `whatsapp-audio-processor.ts` — Audio-to-text via Gemini multimodal
- `whatsapp-workflow-presentacion.ts` — Presentation workflow state machine
- `whatsapp-workflow-meetings.ts` — Meeting workflow adapter
- `whatsapp-remote-hub.ts` — Zod-validated command sandbox
- `whatsapp-terminal.ts` — Terminal emulation
- `whatsapp-handlers.ts` — IPC handlers

**WhatsApp Executors (`electron/whatsapp-executors/`):**
- `google-executors.ts` — Google Workspace tool handlers
- `iris-executors.ts` — IRIS tool handlers
- `system-executors.ts` — System operation handlers
- `types.ts` — Shared executor types

**Google Workspace (8 files):**
- `calendar-service.ts` — Google Calendar + Microsoft Outlook, OAuth hub (`getGoogleAuth()`)
- `calendar-handlers.ts` — IPC: connect, disconnect, get events, create/update/delete
- `gmail-service.ts` — Gmail API (send, read, modify labels, trash)
- `gmail-handlers.ts` — IPC: email operations
- `drive-service.ts` — Drive API (list, search, upload, download, create folder, delete)
- `drive-handlers.ts` — IPC: Drive operations
- `gchat-service.ts` — Google Chat API (spaces, messages, reactions, members)
- `gchat-handlers.ts` — IPC: Chat operations

**Meetings (`electron/meetings/` — 12 files):**
- `meeting-types.ts` — TypeScript interfaces
- `meeting-store.ts` — Persistent meeting storage
- `meeting-source-service.ts` — Source collection (Drive, Calendar, Email)
- `meeting-ai-service.ts` — AI-powered extraction and analysis
- `meeting-review-service.ts` — HITL review flow
- `meeting-sync-service.ts` — IRIS synchronization
- `meeting-workflow-service.ts` — End-to-end orchestration
- `meeting-detection-store.ts` — Detection tracking
- `meeting-passive-detection-service.ts` — Polling-based detection
- `meeting-context-pack.ts` — Context building for AI
- `meeting-assignee-service.ts` — Participant resolution
- `meeting-iris-client.ts` — Direct IRIS API client
- Plus: `meeting-handlers.ts` (in electron/ root)

**Workflow + Automation (5 files):**
- `workflow-hub-service.ts` — Unified workflow orchestrator
- `workflow-hub-handlers.ts` — IPC handlers
- `workspace-automation-service.ts` — Template-based multi-step automations
- `workspace-automation-handlers.ts` — IPC handlers
- `url-summarizer-workflow.ts` — URL summarization workflow

**Memory + Knowledge (6 files):**
- `memory-service.ts` — 4-layer memory (raw SQLite, summaries, embeddings, facts)
- `memory-handlers.ts` — IPC handlers
- `knowledge-service.ts` — OpenClaw-style `.md` knowledge base
- `semantic-indexer.ts` — FTS5 semantic search across project files
- `smart-search-tool.ts` — Natural language file search wrapper
- `path-memory-service.ts` — Proactive filesystem indexing

**Monitoring + Summaries (5 files):**
- `monitoring-service.ts` — Activity tracking (screenshots, window, idle, OCR)
- `monitoring-handlers.ts` — IPC handlers
- `ocr-service.ts` — Tesseract.js lazy-initialized worker (Spanish + English)
- `summary-generator.ts` — Gemini end-of-day summaries
- `daily-digest-generator.ts` — PDF report generation + WhatsApp delivery

**Desktop Agent (6 files):**
- `desktop-agent-service.ts` — Perception-Planning-Action loop
- `desktop-agent-types.ts` — Type definitions
- `desktop-agent-handlers.ts` — IPC handlers
- `computer-use-handlers.ts` — Low-level IPC: filesystem, shell, system info
- `computer-use/batch-file-ops.ts` — Batch file operations
- `visual-debugger-service.ts` — Error zone annotation + WhatsApp reporting

**Telegram (2 files):**
- `telegram-service.ts` — Bot API integration
- `telegram-handlers.ts` — IPC handlers

**Distributed (4 files):**
- `background-host-service.ts` — Background process lifecycle
- `background-host-handlers.ts` — IPC handlers
- `remote-node-service.ts` — Multi-machine task execution
- `remote-node-handlers.ts` — IPC handlers

**Documents + Presentations (4 files):**
- `document-designer.ts` — Document creation
- `slide-designer.ts` — Slide design
- `presentation-pdf.ts` — PDF generation
- `presentation-premium.ts` — Premium presentations

**Proactive + Notifications (2 files):**
- `proactive-service.ts` — Calendar + task deadline alerts
- `proactive-system-cleanup.ts` — System cleanup

**Daily Briefing:**
- `daily-briefing-service.ts` — Morning briefings via WhatsApp

**Utilities (12 files):**
- `clipboard-ai-assistant.ts` — Clipboard history polling with Gemini analysis
- `clipboard-manager.ts` — Bidirectional clipboard sync
- `task-scheduler.ts` — Cron-based task scheduling
- `scheduled-tasks.ts` — Persistent task storage
- `thought-logger.ts` — SQLite thought logging
- `neural-organizer.ts` — Intelligent file organization
- `safe-browser-tool.ts` — URL analysis
- `app-launcher-tool.ts` — Cross-platform app launching
- `dynamic-tool-service.ts` — Hot-reloadable tool plugins
- `browser-web-service.ts` — Web browsing for agents
- `llm-task-service.ts` — Generic LLM task execution
- `system-services.ts` — System service utilities

**Security:**
- `workstation-security.ts` — Workstation security hardening
- `windows-uia-service.ts` — Windows UI Automation

**Updater (2 files):**
- `updater-service.ts` — electron-updater integration
- `updater-handlers.ts` — IPC handlers

**Other:**
- `iris-data-main.ts` — Direct IRIS Supabase access from main process
- `agent-task-queue.ts` — Resilient task queue with exponential backoff
- `mcp-manager.ts` — Legacy dynamic tool loading (replaced by dynamic-tool-service)
- `focus-mode-service.ts` — Focus mode functionality

**Utility Subdirectories:**
- `electron/utils/api-rate-limiter.ts` — API call rate limiting
- `electron/utils/concurrency.ts` — Concurrency control utilities
- `electron/utils/file-utils.ts` — File operation helpers
- `electron/utils/ipc-helpers.ts` — IPC utility functions

**Built-in Tools (`electron/tools/`):**
- `media-controller-tool.ts` — Media playback control
- `pc-alarm-tool.ts` — Timer/alarm
- `workspace-manager.ts` — Workspace management

**Services (`electron/services/`):**
- `auto-backup-service.ts` — Automated backups
- `business-anomaly-monitor.ts` — Business metric anomaly detection
- `pc-alarm-service.ts` — Alarm management
- `proactive-process-monitor.ts` — Process monitoring

**Tests (`electron/__tests__/`):**
- 25 test files covering services and handlers

### `src/` — Renderer (React 18)

**Components (19):**

| Component | File | Purpose |
|-----------|------|---------|
| Auth | `Auth.tsx` | SOFIA login with animated gradient |
| ConnectionsPanel | `ConnectionsPanel.tsx` | Unified connections management (WhatsApp, Google, Telegram) |
| FlowMode | `FlowMode.tsx` | Voice dictation overlay with Gemini Live API |
| ProductivityDashboard | `ProductivityDashboard.tsx` | Monitoring visualization, calendar, timeline |
| ProjectHub | `ProjectHub.tsx` | IRIS teams/projects/issues tree view |
| ScreenViewer | `ScreenViewer.tsx` | Real-time desktop capture with source picker |
| Sidebar | `Sidebar.tsx` | Main navigation sidebar |
| UnifiedSettingsModal | `UnifiedSettingsModal.tsx` | Multi-tab settings (AI, workspace, integrations) |
| SettingsModal | `SettingsModal.tsx` | Legacy settings modal |
| WhatsAppSetup | `WhatsAppSetup.tsx` | WhatsApp QR + connection flow |
| ToolLibrary | `ToolLibrary.tsx` | Dynamic tool browser |
| ToolEditorModal | `ToolEditorModal.tsx` | Tool editor (create/modify ToolSchema) |
| UserManagementModal | `UserManagementModal.tsx` | User/team management |
| ConfirmActionModal | `ConfirmActionModal.tsx` | Confirmation prompts |
| FolderModals | `FolderModals.tsx` | Create/rename/move folder modals |
| ShareModal | `ShareModal.tsx` | Sharing dialog |
| SourcesPanel | `SourcesPanel.tsx` | Research source attribution panel |
| UpdateNotification | `UpdateNotification.tsx` | Auto-updater notification |
| UpdatePanel | `UpdatePanel.tsx` | Update progress panel |

**Adapters (`src/adapters/` — 6 files):**

| Adapter | Purpose |
|---------|---------|
| `desktop_ui/ChatUI.tsx` | Chat interface with conversation sidebar |
| `desktop_ui/TrackingToggle.tsx` | Monitoring toggle component |
| `gemini_service/GeminiService.ts` | Gemini API adapter |
| `os_automation/NodeOSAutomation.ts` | OS automation adapter |
| `tools/FileSystemTools.ts` | Filesystem tool adapter |
| `tracking/SupabaseTrackingRepository.ts` | Supabase tracking adapter |

**Hooks (`src/hooks/` — 7 files):**

| Hook | Purpose |
|------|---------|
| `useChatManager.ts` | Chat state and conversation management |
| `useChatProcessor.ts` | Message processing and AI interaction |
| `useFolderManager.ts` | Folder CRUD operations |
| `useIrisData.ts` | IRIS data fetching and caching |
| `useLiveApi.ts` | Gemini Live API WebSocket connection |
| `useModelSelector.ts` | AI model selection |
| `useTheme.ts` | Theme management |

**Prompts (`src/prompts/` — 4 files):**

| File | Purpose |
|------|---------|
| `chat.ts` | Main chat system prompts |
| `flow.ts` | Flow mode prompts |
| `prompt-optimizer.ts` | Dynamic prompt optimization |
| `utils.ts` | Prompt utility functions |

**Services (27):**

| Service | Purpose |
|---------|---------|
| `chat-service.ts` | Supabase conversation CRUD |
| `folder-service.ts` | Folder management |
| `flow-service.ts` | Flow mode Gemini processing + grounding |
| `gemini-chat.ts` | Primary chat with tool orchestration |
| `gemini-tools.ts` | Tool declarations and handlers for renderer |
| `live-api.ts` | Gemini Live API (bidirectional audio WebSocket) |
| `image-generation.ts` | Text-to-image via Gemini |
| `computer-use-service.ts` | Renderer-side computer-use IPC wrapper |
| `iris-data.ts` | IRIS read operations (teams, projects, issues) |
| `sofia-auth.ts` | SOFIA authentication (RPC-based, pgcrypto) |
| `org-service.ts` | Organization/team management |
| `settings-service.ts` | User AI preferences (model, temperature, system prompt) |
| `api-keys.ts` | API key management with caching |
| `gmail-service.ts` | Renderer-side Gmail IPC wrapper |
| `drive-service.ts` | Renderer-side Drive IPC wrapper |
| `gchat-service.ts` | Renderer-side GChat IPC wrapper |
| `monitoring-service.ts` | Renderer-side monitoring IPC wrapper |
| `meeting-service.ts` | Renderer-side meeting IPC wrapper |
| `telegram-service.ts` | Renderer-side Telegram IPC wrapper |
| `remote-node-service.ts` | Renderer-side remote node IPC wrapper |
| `background-host-service.ts` | Renderer-side background host IPC wrapper |
| `automation-service.ts` | Renderer-side workspace automation IPC wrapper |
| `workflow-hub-service.ts` | Renderer-side workflow hub IPC wrapper |
| `updater-service.ts` | Renderer-side updater IPC wrapper |
| `tools-service.ts` | Dynamic tool management |
| `share-service.ts` | Sharing functionality |
| `workspace-sources.ts` | Workspace source management |

**Core Architecture (`src/core/`):**
- `entities/ActivityLog.ts` — TypeScript interfaces for activity logging
- `entities/User.ts` — User domain entity
- `ports/AIAssistant.ts` — AI assistant port interface
- `ports/OSAutomation.ts` — OS automation port interface
- `ports/TrackingRepository.ts` — Tracking repository port interface

**Shared:**
- `src/shared/iris-resolution.ts` — IRIS data resolution utilities

**Contexts:**
- `AuthContext.tsx` — Global auth state, SOFIA session management, Lia sync, organization/team selection

**Library Clients:**
- `lib/supabase.ts` — Lia Supabase client
- `lib/supabase-factory.ts` — Supabase client factory
- `lib/iris-client.ts` — IRIS Supabase client with TypeScript types
- `lib/sofia-client.ts` — SOFIA Supabase client

**Tests (`src/__tests__/` — 8 files):**
- Components: Auth, Sidebar
- Contexts: AuthContext
- Lib: supabase
- Services: chat-service, computer-use-service, gemini-chat, iris-data

### `sql/` — Database Schemas
- `Schema-Database.sql` — Main database schema
- `meeting-ops-tables.sql` — Meeting operations tables (IRIS Supabase)
- `monitoring-tables.sql` — Monitoring tables (Lia Supabase)

### `scripts/` — Build & CLI
- `dev-clean.ps1` — PowerShell script for clean dev restart
- `generate-bitmaps.js` — Icon/bitmap generation for electron-builder
- `generate-installer-images.js` — Installer image generation

### `tools/dynamic/` — Runtime Tools
- Watched by DynamicToolService for hot-reloadable tool plugins
- Currently empty — tools are created dynamically or manually

---

## Environment Variables

```bash
# Google AI
VITE_GEMINI_API_KEY=              # Google Gemini API key (all AI features)

# Supabase - Lia (conversations, monitoring)
VITE_SUPABASE_URL=                # Lia instance URL
VITE_SUPABASE_ANON_KEY=           # Lia anon key

# Supabase - SOFIA (auth, organizations)
VITE_SOFIA_SUPABASE_URL=          # SOFIA instance URL
VITE_SOFIA_SUPABASE_ANON_KEY=     # SOFIA anon key

# Supabase - IRIS (projects, CRM, workflows)
VITE_IRIS_SUPABASE_URL=           # IRIS instance URL
VITE_IRIS_SUPABASE_ANON_KEY=      # IRIS anon key

# Google OAuth (Calendar, Gmail, Drive, Chat)
VITE_GOOGLE_OAUTH_CLIENT_ID=      # Google OAuth client ID
VITE_GOOGLE_OAUTH_CLIENT_SECRET=  # Google OAuth client secret

# Microsoft OAuth (Outlook Calendar)
VITE_MICROSOFT_CLIENT_ID=         # Microsoft app client ID

# Optional
VITE_GAMMA_API_KEY=               # Gamma API key (presentation generation)
```

---

## Development Commands

```bash
npm run dev          # Start Vite dev server + Electron (hot-reload)
npm run dev:clean    # Clean dev restart (PowerShell script)
npm run dev:fresh    # Clean + dev in one step
npm run build        # Production: tsc -> vite build -> generate-bitmaps -> electron-builder
npm run lint         # ESLint strict mode (zero warnings allowed)
npx tsc --noEmit     # TypeScript type check only
npm run test         # Run all tests with vitest
npm run test:watch   # Watch mode testing
npm run test:coverage # Tests with coverage report
npm run test:main    # Main process tests only
npm run test:renderer # Renderer tests only
```

---

## Conventions

### Code Style
- **Language:** All UI text, prompts, comments, and logs in **Spanish**
- **File naming:** `kebab-case` for all files (e.g., `whatsapp-agent.ts`, `memory-service.ts`)
- **IPC naming:** `namespace:action` (e.g., `workflow-hub:get-overview`, `meeting:list-runs`)
- **Imports:** Use `import type { ... }` for type-only imports
- **React 18:** No `import React` needed — JSX transform is automatic

### Service Pattern
All main-process services follow this pattern:
```typescript
class MyService extends EventEmitter {
  init(): Promise<void>     // Initialize resources
  start(): void             // Begin polling/watching
  stop(): void              // Cleanup
  getConfig(): Config       // Current configuration
  getStatus(): Status       // Current state
}
```

### IPC Handler Pattern
All IPC handlers return a consistent shape:
```typescript
{ success: boolean, error?: string, ...data }
```

### Bootstrap Pattern
`main.ts` uses `runOptionalStep()` wrapper — service failures are logged but don't crash the app:
```typescript
await runOptionalStep('serviceName.init', () => service.init())
```

### Error Handling
- IPC handlers: always wrap in try/catch, return `{ success: false, error: message }`
- AI calls: fallback chain (primary model -> fallback model)
- Services: EventEmitter `'error'` events
- Bootstrap: `runOptionalStep()` catches and logs, returns undefined

### Config Persistence
- Runtime configs stored as JSON in `app.getPath('userData')/`
- Examples: `monitoring-config.json`, `proactive-config.json`, `daily-briefing.json`

### Git Conventions
- Never commit directly to `main`/`master`
- Feature branches for new work
- PRs via GitHub

### Build Configuration
- Vite 7 with `vite-plugin-electron/simple`
- Main process outputs CJS format (not ESM) to avoid Node 20+ issues with native modules
- Externalized: all deps except `@whiskeysockets/baileys`
- Excluded from optimization: `mammoth`, `pptxgenjs`, `archiver`, `better-sqlite3`, `sharp`, `exceljs`, `docx`
- Environment variables injected at build time via vite-plugin-electron

### Known Issues
- `app.enableSandbox()` disabled because BrowserWindow creation has been unstable on Windows
- Password hashing incompatibility between JS bcrypt and pgcrypto — see `FIX-PASSWORD-SOFLIA-LEARNING.md`
