# SofLIA Hub — Complete Project Guide

## What is SofLIA Hub?

SofLIA Hub is an **Electron 30.5 desktop application** — an AI-powered business operations platform for Spanish-speaking teams. It orchestrates:

- **WhatsApp AI Agent** — Gemini-powered conversational assistant with 40+ tools (file ops, Google Workspace, IRIS, web search, desktop automation)
- **Google Workspace Integration** — Calendar, Gmail, Drive, Google Chat with OAuth2
- **Activity Monitoring** — Screenshots, OCR, window tracking, idle detection, daily summaries
- **Project Management (IRIS)** — Teams, projects, issues, sprints, statuses, priorities
- **CRM-lite** — Companies, contacts, opportunities with Jaccard deduplication
- **BPM Workflow Engine** — State-machine workflows (presentations, meetings) with HITL approval
- **AutoDev** — Autonomous self-programming multi-agent system with strategic memory
- **Desktop Agent** — Vision-based computer automation (Gemini Vision → screenshot → PowerShell P/Invoke)
- **4-Layer Memory** — Raw persistence, rolling summaries, semantic embeddings, structured facts

All UI, prompts, comments, and logs are in **Spanish**.

---

## Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Desktop | Electron | 30.5.1 | Main + Renderer process |
| Frontend | React | 18.2.0 | JSX transform (no `import React`) |
| Language | TypeScript | 5.7.3 | Strict mode, bundler resolution |
| Build | Vite + vite-plugin-electron | 5.4.21 | Externals for native modules |
| CSS | Tailwind CSS v4 | 4.1.18 | |
| AI | Google Gemini (`@google/generative-ai`) | 0.24.1 | 9 model aliases, JSON response mode |
| Database | 3x Supabase + better-sqlite3 (local) | 2.95.3 / 11.8.1 | Triple-instance strategy |
| WhatsApp | @whiskeysockets/baileys | 7.0.0-rc.9 | WebSocket, QR auth |
| Google APIs | googleapis | 171.4.0 | Calendar, Gmail, Drive, Chat |
| OCR | tesseract.js | 5.0.5 | Spanish + English |
| Image Processing | sharp | 0.34.5 | Screenshot compositing |
| Scheduling | node-cron + cron | 3.0.3 / 4.4.0 | AutoDev + task scheduler |
| Presentations | Gamma API | — | PDF generation via external API |
| Email | Nodemailer | — | SMTP for computer-use agent |
| Updates | electron-updater | — | 4-hour polling |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       SofLIA Hub (Electron 30.5)                        │
├──────────────────────────────┬──────────────────────────────────────────┤
│   Renderer (React 18)        │   Main Process (Node.js)                 │
│                              │                                          │
│   src/components/ (27)       │   electron/ (58 .ts files)               │
│   src/services/ (22)         │   IPC: contextBridge + preload.ts        │
│   src/contexts/ (Auth)       │   Security: CSP + 167-channel allowlist  │
│   src/lib/ (3 Supabase)      │   + payload sanitization                 │
│   src/core/ (entities+ports) │                                          │
├──────────────────────────────┴──────────────────────────────────────────┤
│                          Data Layer                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐  │
│  │  SOFIA    │  │  Lia     │  │  IRIS    │  │  Local SQLite          │  │
│  │  Auth     │  │  Chat    │  │  Projects│  │  memory, knowledge,    │  │
│  │  Orgs     │  │  Monitor │  │  CRM     │  │  semantic index, facts │  │
│  │  Teams    │  │  Memory  │  │  Workflow │  │  scheduled tasks       │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────────────┘  │
│                                                                          │
│  JSON Config (userData/):  autodev-config.json, autodev-strategic-      │
│  memory.json, monitoring-config.json, proactive-config.json, etc.       │
└─────────────────────────────────────────────────────────────────────────┘
```

### IPC Pattern (strict)

Every feature follows this 4-layer pattern:

1. `electron/*-service.ts` — Business logic in main process (EventEmitter subclass)
2. `electron/*-handlers.ts` — `ipcMain.handle()` registrations (returns `{ success, error?, ...data }`)
3. `electron/preload.ts` — `contextBridge.exposeInMainWorld()` with **167 allowlisted channels**
4. `src/services/*-service.ts` — Typed renderer wrappers calling `window.electronAPI.invoke()`

**Security rules:**
- All IPC goes through `ALLOWED_IPC_CHANNELS` allowlist — never add channels without updating `preload.ts`
- Payload sanitization on all incoming data
- CSP injection prevents arbitrary script execution
- `whatsapp-remote-hub.ts` has blocked regex patterns for dangerous commands

### IPC Channel Namespaces (167 channels)

| Namespace | Count | Purpose |
|-----------|-------|---------|
| `computer:*` | 21 | Filesystem, shell, clipboard, email, system info |
| `whatsapp:*` | 9 | Connection, QR, status, config, send |
| `monitoring:*` | 11 | Session control, config, snapshots, summaries |
| `calendar:*` | 10 | OAuth, events, connections, CRUD |
| `gmail:*` | 6 | Send, read, labels, trash |
| `drive:*` | 7 | List, search, upload, download, folders |
| `gchat:*` | 6 | Spaces, messages, reactions, members |
| `autodev:*` | 11 | Config, run control, status, history, micro-fix |
| `desktop-agent:*` | 17 | Task execution, screenshot, mouse/keyboard/window |
| `proactive:*` | 4 | Config, trigger, status |
| `memory:*` | 6 | Stats, compact, facts, search |
| `flow:*` | 3 | Message passing, window control |
| `updater:*` | 7 | Check, download, install, progress events |

---

## Supabase Instances (Triple-Instance Strategy)

| Instance | Purpose | Tables | Env Vars |
|----------|---------|--------|----------|
| **SOFIA** | Auth, organizations, teams, user profiles, roles | `users`, `organizations`, `teams`, `org_members` | `VITE_SOFIA_SUPABASE_URL`, `VITE_SOFIA_SUPABASE_ANON_KEY` |
| **Lia** | Conversations, messages, folders, monitoring sessions, daily summaries, calendar connections | `conversations`, `messages`, `folders`, `monitoring_sessions`, `activity_logs`, `daily_summaries`, `calendar_connections` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **IRIS** | Projects, issues, sprints, statuses, priorities, CRM (companies/contacts/opportunities), workflows, artifacts, approvals | `teams`, `projects`, `issues`, `statuses`, `priorities`, `crm_companies`, `crm_contacts`, `crm_opportunities`, `workflow_runs`, `workflow_steps`, `approvals`, `artifacts` | `VITE_IRIS_SUPABASE_URL`, `VITE_IRIS_SUPABASE_ANON_KEY` |

**Access patterns:**
- SOFIA: renderer only (`src/lib/sofia-client.ts`, `src/contexts/AuthContext.tsx`)
- Lia: renderer (`src/lib/supabase.ts`) + main (`electron/memory-service.ts`, `electron/monitoring-service.ts`)
- IRIS: renderer (`src/services/iris-data.ts`) + main (`electron/iris-data-main.ts`) — each creates its own client

---

## AI Models (Google Gemini)

Configured in `src/config.ts`:

| Alias | Model ID | Usage |
|-------|----------|-------|
| `PRIMARY` | `gemini-3-flash-preview` | Chat, WhatsApp agent, workflow extraction, research |
| `PRO` | `gemini-3.1-pro-preview` | Complex generation, deep analysis, AutoDev coder |
| `FALLBACK` | `gemini-2.5-flash` | Fallback when primary/pro fails, transcription, maps |
| `WEB_AGENT` | `gemini-3-flash-preview` | Web search grounding |
| `LIVE` | `gemini-2.5-flash-native-audio-preview-12-2025` | Bidirectional audio (Flow Mode) |
| `IMAGE_GENERATION` | `gemini-2.5-flash-image` | Text-to-image |
| `DEEP_RESEARCH` | `deep-research-pro-preview-12-2025` | AutoDev deep research |
| `TRANSCRIPTION` | `gemini-2.5-flash` | Audio-to-text (WhatsApp voice) |
| `MAPS` | `gemini-2.5-flash` | Location/mapping |

**AI patterns used across the codebase:**
- `responseMimeType: 'application/json'` — All structured AI calls return parsed JSON
- **Fallback chain:** primary → fallback model on any error
- **Tool calling (function calling):** WhatsApp agent, AutoDev research, desktop agent
- **Grounding:** Google Search grounding for AutoDev research agents
- **Multimodal:** Screenshot analysis (desktop agent), audio transcription (WhatsApp), image generation
- **Live API:** WebSocket bidirectional streaming for Flow Mode audio

---

## Key Policies

- **No webhooks** — All external monitoring uses `setInterval` polling:
  - Calendar: 60s
  - Proactive alerts: 5min
  - SLA checks: 60s
  - Transcript watcher: 2min
  - WhatsApp queue: 5s
  - Auto-updater: 4 hours
- **HITL (Human-in-the-Loop)** — Critical workflow steps require human approval before execution. "Sin aprobacion no se ejecuta."
- **No invented data** — AI must not hallucinate. Missing data → block and request context.
- **Idempotency** — Workflow actions use `idempotency_key` UNIQUE constraints.
- **trace_id** — End-to-end correlation UUID across all workflow tables.
- **Group safety** — Dangerous WhatsApp tools (file write, delete, shell, clipboard) are blocked in group chats.
- **Standalone compatibility** — AutoDev and some services run outside Electron via `npx tsx`. All `electron` imports must use dynamic `require()` with try/catch.

---

## WhatsApp Agent — Tool Ecosystem (40+ tools)

The WhatsApp agent (`electron/whatsapp-agent.ts`) runs a Gemini agentic loop with function calling. Tools are organized by category:

### File Operations
`list_directory`, `read_file`, `write_file`, `create_directory`, `move_item`, `copy_item`, `delete_item`, `get_file_info`, `search_files`, `organize_files`, `batch_move_files`, `list_directory_summary`

### System & Clipboard
`get_system_info`, `clipboard_read`, `clipboard_write`, `open_file_on_computer`, `open_url`

### Web & Search
`web_search`, `web_search_advanced`, `read_webpage`, `get_current_time`, `semantic_file_search`

### Google Workspace
`gmail_send`, `gmail_read`, `gmail_trash`, `google_calendar_create`, `google_calendar_update`, `google_calendar_delete`, `google_drive_upload`, `google_drive_download`, `google_drive_search`, `gchat_send_message`, `gchat_get_members`

### IRIS (Project Management)
`iris_get_teams`, `iris_get_projects`, `iris_get_issues`, `iris_create_issue`, `iris_update_issue`, `iris_create_project`, `iris_get_statuses`, `iris_get_priorities`

### AutoDev
`autodev_run_now`, `autodev_status`, `autodev_trigger_micro_fix`

### WhatsApp-Specific
`whatsapp_send_file`

### Blocked in Groups (safety)
`execute_command`, `open_application`, `kill_process`, `lock_session`, `shutdown_computer`, `write_file`, `move_item`, `delete_item`, `clipboard_write`

---

## Desktop Agent — Computer Automation

The desktop agent (`electron/desktop-agent-service.ts`) implements a **Perception-Planning-Action** loop:

1. **Perception**: Captures screenshot via `desktopCapturer`
2. **Planning**: Gemini Vision analyzes screenshot, generates JSON action plan
3. **Action**: Executes via PowerShell P/Invoke (mouse clicks, keyboard input, window management)

Capabilities: click, double-click, right-click, type text, key combinations, scroll, window focus/resize/minimize, drag-and-drop, wait.

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
- **Hierarchical Markdown** — Human-readable memory cards in `memory/` directory
- **Knowledge Service** — OpenClaw-style `.md` files: `MEMORY.md`, `users/{phone}.md`, `memory/YYYY-MM-DD.md`
- **Semantic Indexer** — FTS5 search across all project files for code-aware retrieval
- **Path Memory Service** — Proactive filesystem indexing (resolves OneDrive path rename issues)

---

## Monitoring System

`electron/monitoring-service.ts` captures work activity:

- **Interval**: 30-60 seconds (configurable)
- **Captures**: Active window title, process name, URL, category
- **Idle Detection**: 120-second threshold
- **Screenshots**: Via `desktopCapturer` with optional `sharp` compositing
- **OCR**: `tesseract.js` (Spanish + English) for text extraction from screenshots
- **Storage**: In-memory buffer → periodic flush to Lia Supabase
- **Daily Summaries**: Gemini-generated end-of-day summaries with metrics
- **Daily Digest**: PDF report generation + WhatsApp delivery
- **Calendar Integration**: Auto-start/stop monitoring based on Google Calendar work hours events

### Monitoring Tables (Lia Supabase)
- `monitoring_sessions` — Work blocks with trigger type, active/idle times, summary
- `activity_logs` — 30-second snapshots with window, idle, OCR, category
- `daily_summaries` — Aggregated daily stats with top apps/websites, projects
- `calendar_connections` — OAuth tokens for Google/Microsoft with auto-refresh

---

## Workflow Engine — BPM-lite State Machines

Workflows are inline state machines per workflow type:

### Presentation Workflow (`whatsapp-workflow-presentacion.ts`)
```
AWAITING_DATA → PROCESSING_PROPOSAL → AWAITING_APPROVAL → GENERATING_PRESENTATION → COMPLETED
```
- Extracts client company + email from user input
- Generates proposal via Gemini
- Requires HITL approval before generating PDF via Gamma API

### Meeting Workflow (`whatsapp-workflow-reunion.ts`)
- Adapter between WhatsApp commands and WorkflowEngine
- Manages meeting scheduling, agenda, follow-ups

### CRM (`electron/crm-service.ts`)
- Companies, contacts, opportunities
- Jaccard similarity deduplication on company names
- IRIS Supabase storage

---

## Proactive Services

### Proactive Service (`electron/proactive-service.ts`)
- Calendar + task deadline alerts composed by Gemini
- Configurable polling intervals
- WhatsApp notification delivery

### Proactive Guardian (`electron/proactive-guardian.ts`)
- CPU/RAM threshold monitoring
- Auto-healing actions when thresholds exceeded

### System Guardian (`electron/system-guardian.ts`)
- Watchdog for CPU, RAM, disk usage
- Emits alerts via WhatsApp when critical

---

## AutoDev — Autonomous Self-Programming System

AutoDev is a multi-agent system with **strategic memory** that autonomously improves SofLIA's codebase. It has **3 trigger modes** and a **7-phase pipeline** with self-evaluation.

### Trigger Modes

| Mode | Trigger | Pipeline | Scope | Daily Limit |
|------|---------|----------|-------|-------------|
| **Scheduled (Full)** | Cron `0 3 * * *` (3 AM), idle >5min | 7-phase strategic | 500+ lines, 30 files, full research | `maxDailyRuns: 3` |
| **Manual (Full)** | WhatsApp `autodev_run_now` or UI button | Same 7-phase | Same as scheduled | Same counter |
| **Micro-Fix (Reactive)** | SelfLearnService detects error/suggestion | 4-phase lightweight | 5 files, 200 lines, NO research | `maxDailyMicroRuns: 5` |

### Full Run Pipeline (7 Phases)

```
Phase 0: Strategic Awareness
  ├─ StrategicMemoryService loads persistent memory (JSON file)
  ├─ Selects strategy based on: retrospectives, user patterns, capability gaps, roadmap
  ├─ 6 strategies: innovation | deep-improvement | user-driven | gap-filling | integration | resilience
  └─ Injects {STRATEGIC_CONTEXT} and {STRATEGY_DIRECTIVE} into ALL agent prompts

Phase 1: Parallel Research (5 agents + npm audit)
  ├─ SecurityAgent — CVEs, OWASP, vulnerability patterns
  ├─ DependenciesAgent — Changelog analysis, breaking changes
  ├─ FeaturesAgent — Best practices, new patterns for the stack
  ├─ QualityAgent — Code quality patterns, performance
  ├─ NpmAudit — `npm audit --json` + `npm outdated --json`
  └─ All use Google Search grounding via Gemini function calling

Phase 1.5: Deep Agentic Research
  ├─ Gemini Deep Research model with web_search + read_webpage tools
  ├─ Capability Gap Analysis — discovers missing/broken capabilities
  └─ Registers gaps as strategic roadmap goals

Phase 2: Analysis + Planning
  ├─ SafetyFilter — blocks major version bumps
  ├─ QualityGate — strips dependency-dominated lists (>50% deps → remove all)
  ├─ PlanGate — enforces >70% feature/quality steps
  ├─ Integration Gate — auto-adds main.ts integration step when plan creates new files
  └─ {STRATEGIC_CONTEXT} injected into analysis + plan prompts

Phase 3: Parallel Coding (2 coder agents on file batches)
  ├─ Safety guards:
  │   ├─ Phantom import detector (imports of non-existent modules)
  │   ├─ Truncated code detector (unbalanced braces, trailing `...`)
  │   ├─ Destructive rewrite blocker (files shrinking >60%)
  │   └─ Blocked files: package.json, package-lock.json, tsconfig.json, vite.config.ts
  └─ {STRATEGY_DIRECTIVE} injected into code prompts

Phase 4: Review + Build (up to 4 retries with auto-fix)
  ├─ Build: `npx tsc --noEmit`
  ├─ Integration check: detects orphan files (multi-pattern grep)
  │   ├─ Respects tools/dynamic/ (validates ToolSchema instead of imports)
  │   └─ Uses `git diff target_branch...HEAD` + untracked files
  ├─ FixAgent: receives main.ts context (first 200 lines) for integration fixes
  └─ Merge conflict detection: auto-cleans `<<<<<<<` markers after branch switch

Phase 5: Commit + Push + PR
  ├─ Git: branch creation, commit, push
  ├─ GitHub: PR creation via REST API
  ├─ getRealImprovements() — honest counts excluding deleted files
  └─ WhatsApp notification with summary

Phase 6: Retrospective
  ├─ Gemini evaluates its own work (impact score 1-5)
  ├─ Records: lessons learned, mistakes made, suggested goals
  └─ Updates: roadmap priorities, capabilities inventory, next run strategy
```

### Strategic Memory System (`electron/autodev-strategic-memory.ts`)

Persistent JSON file (`autodev-strategic-memory.json` in userData/) that survives between runs:

| Component | Contents | Purpose |
|-----------|----------|---------|
| **Roadmap** | Goals with priority (critical/high/medium/low), status, created/completed dates | What to work on next |
| **Capabilities Inventory** | Feature → status (functional/partial/broken/missing) | Know what exists and what's broken |
| **Retrospectives** | Per-run: impact score 1-5, lessons, mistakes, files touched | Learn from past performance |
| **User Patterns** | Recurring complaints/suggestions with frequency | Prioritize user needs |
| **Rejected Ideas** | Ideas that failed + reason | Avoid repeating mistakes |
| **Hotspots** | Files touched too frequently across runs | Detect instability |

**Strategy Selection Logic (priority order):**
1. User has unresolved complaints → `user-driven`
2. Missing/broken capabilities detected → `gap-filling`
3. Recent runs had low impact (<2.5/5) → rotate to unused strategy
4. High-priority goals pending → `deep-improvement`
5. Default → rotate between strategies for diversity

### Micro-Fix Flow
```
User says "no funciona X" on WhatsApp
  → SelfLearnService.analyzeUserMessage() detects complaint pattern
  → Logs to AUTODEV_ISSUES.md
  → Classifies severity: micro-fixable vs needs-full-run
     (>500 chars or keywords like "refactor", "arquitectura" → full run)
  → Emits 'micro-fix-candidate' event
  → AutoDevService.queueMicroFix() adds to debounce queue
  → After 3 min debounce: executeMicroFix()
    Phase 1: Analyze trigger + read relevant source files
    Phase 2: Code the fix (reuses implementStep with same safety guards)
    Phase 3: Build verify (npx tsc --noEmit, 1 retry with auto-fix)
    Phase 4: Commit + Push + create PR
  → Notify owner via WhatsApp (short summary)
```

**Auto-trigger categories (configurable in `autodev-types.ts`):**
- `autoTriggerOnComplaint` — User complaints ("no funciona", "no sirve", etc.)
- `autoTriggerOnSuggestion` — User suggestions ("deberias poder...", "agrega...")
- `autoTriggerOnToolFailure` — Tool execution errors

### Safety Guards

| Guard | What it prevents | Location |
|-------|-----------------|----------|
| **Package.json protection** | Direct modification of package.json, package-lock.json, tsconfig.json, vite.config.ts | `implementStep()` |
| **Major version blocker** | Any major version bump in dependencies | Phase 2 SafetyFilter |
| **Dependency domination filter** | Plans with >50% dependency steps get all dep steps removed | Phase 2 QualityGate |
| **Feature ratio gate** | Plans must have >70% feature/quality steps | Phase 2 PlanGate |
| **Integration gate** | Plans creating new files must include main.ts integration step | `generatePlan()` |
| **Phantom import detector** | Imports of modules that don't exist in the project | `implementStep()` |
| **Truncation detector** | Code with unbalanced braces or trailing `...` | `implementStep()` |
| **Destructive rewrite blocker** | Files shrinking >60% in size | `implementStep()` |
| **Merge conflict cleaner** | Detects and removes `<<<<<<<` markers after branch operations | Git branch switch |
| **Orphan file detector** | New files not imported anywhere (except `tools/dynamic/`) | Phase 4 Review |
| **Dynamic tool validator** | `tools/dynamic/` files must export valid ToolSchema | Phase 4 Review |
| **Git safety** | Never commits to main/master directly; uses work branches | `autodev-git.ts` |

### AutoDev Prompts (`electron/autodev-prompts.ts`)

| Prompt | Purpose | Placeholders |
|--------|---------|-------------|
| `PRODUCT_VISION` | Strategic context — no trivial refactors, focus on user-facing features | — |
| `QUALITY_EXEMPLARS` | Code quality reference with complete tool examples | — |
| `RESEARCH_GROUNDING_PROMPT` | Research agent instructions (security, deps, quality) | `{CATEGORY}`, `{CODEBASE_CONTEXT}` |
| `ANALYZE_PROMPT` | File analysis and improvement identification | `{STRATEGIC_CONTEXT}`, `{RESEARCH_FINDINGS}` |
| `PLAN_PROMPT` | Multi-step implementation planning | `{STRATEGIC_CONTEXT}`, `{ANALYSIS}` |
| `CODE_PROMPT` | Actual code generation with safety rules | `{STRATEGY_DIRECTIVE}`, `{STEP}`, `{FILE_CONTENT}` |
| `REVIEW_PROMPT` | Self-review of generated diffs | `{DIFFS}` |
| `SUMMARY_PROMPT` | WhatsApp notification composition | `{RUN_RESULTS}` |
| `MICRO_FIX_ANALYZE_PROMPT` | Quick analysis for micro-fix debounce window | `{TRIGGER}`, `{FILES}` |
| `MICRO_FIX_SUMMARY_PROMPT` | Brief WhatsApp update for micro-fixes | `{FIX_RESULTS}` |

### AutoDev Config (`autodev-types.ts`)
```typescript
{
  enabled: false,
  cronSchedule: '0 3 * * *',
  adaptiveThinking: false,
  agents: {
    researcher:    { model: 'gemini-3-flash-preview',                  role: 'research',     concurrency: 3 },
    coder:         { model: 'gemini-3.1-pro-preview-customtools',      role: 'coding',       concurrency: 2 },
    reviewer:      { model: 'gemini-3-flash-preview',                  role: 'review',       concurrency: 1 },
    security:      { model: 'gemini-3-flash-preview',                  role: 'security',     concurrency: 1 },
    dependencies:  { model: 'gemini-3-flash-preview',                  role: 'dependencies', concurrency: 1 },
    tester:        { model: 'gemini-3-flash-preview',                  role: 'testing',      concurrency: 1 },
  },
  maxFilesPerRun: 30,
  maxDailyRuns: 3,
  maxLinesChanged: 2000,
  maxResearchQueries: 30,
  maxParallelAgents: 2,
  targetBranch: 'main',
  workBranchPrefix: 'autodev/',
  autoMerge: false,
  requireBuildPass: true,
  categories: ['features', 'security', 'quality', 'performance', 'dependencies', 'tests'],
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
  },
}
```

### Dynamic Tools (`tools/dynamic/`)
- Files in `tools/dynamic/` are loaded dynamically by `MCPManager` (`electron/mcp-manager.ts`) via `fs.watch` + `import()`
- They do NOT need static imports — MCPManager discovers them at runtime
- Each file must export a valid `ToolSchema`:
  ```typescript
  {
    name: string,
    description: string,
    inputSchema: { type: 'object', properties: Record<string, any>, required?: string[] },
    handler?: (args: any) => Promise<any>
  }
  ```
- Supports `.json`, `.js`, `.ts` files
- Cache-busting via `?t=Date.now()` query param on dynamic imports
- AutoDev's integration check validates ToolSchema instead of checking imports for these files

---

## Service Initialization Order (`electron/main.ts`)

Services are initialized in dependency order:

```
1. Memory & Knowledge
   ├─ MemoryService (SQLite init, 4-layer memory)
   ├─ KnowledgeService (markdown knowledge base)
   └─ PathMemoryService (filesystem indexing)

2. Monitoring
   └─ MonitoringService (screenshots, OCR, activity tracking)

3. Google Workspace
   ├─ CalendarService (OAuth hub — other services share its auth)
   ├─ GmailService (shares CalendarService auth)
   ├─ DriveService (shares CalendarService auth)
   └─ GChatService (shares CalendarService auth)

4. WhatsApp
   ├─ WhatsAppService (Baileys connection, QR)
   └─ WhatsAppAgent (Gemini agentic loop, 40+ tools)

5. Proactive
   ├─ ProactiveService (calendar + deadline alerts)
   └─ ProactiveGuardianService (CPU/RAM threshold monitoring)

6. AutoDev
   ├─ AutoDevService (multi-agent orchestrator)
   └─ SelfLearnService (failure detection, micro-fix classification)

7. Desktop Agent
   └─ DesktopAgentService (vision-based computer automation)

8. Utilities
   ├─ UpdaterService (electron-updater, 4-hour polling)
   ├─ ClipboardAIAssistant (clipboard history + Gemini analysis)
   ├─ TaskScheduler (cron-based WhatsApp prompt injection)
   ├─ SystemGuardian (watchdog: CPU, RAM, disk alerts)
   └─ NeuralOrganizerService (intelligent file organization with OCR)

9. Event Wiring
   ├─ SelfLearn 'micro-fix-candidate' → AutoDev.queueMicroFix()
   ├─ Calendar work-start/end → Monitoring auto-start/stop
   └─ TaskScheduler → WhatsApp prompt injection
```

---

## Directory Structure

### `electron/` — Main Process (58 .ts files)

**Core:**
- `main.ts` — Entry point, initializes all services, creates tray/windows, lifecycle management
- `preload.ts` — Security bridge, CSP injection, contextBridge with 167 allowlisted channels

**WhatsApp:**
- `whatsapp-service.ts` — Baileys WebSocket connection, QR auth, auto-reconnect, group support
- `whatsapp-agent.ts` — Gemini agentic loop with 40+ tool declarations and function calling
- `whatsapp-audio-processor.ts` — Audio-to-text via Gemini multimodal (.ogg, .mp3, .wav)
- `whatsapp-workflow-presentacion.ts` — Presentation state machine (→ Gamma API PDF)
- `whatsapp-workflow-reunion.ts` — Meeting workflow adapter (WhatsApp ↔ WorkflowEngine)
- `whatsapp-remote-hub.ts` — Zod-validated command sandbox with blocked regex patterns

**Google Workspace:**
- `calendar-service.ts` — Google Calendar + Microsoft Outlook, OAuth hub (`getGoogleAuth()`)
- `calendar-handlers.ts` — IPC: connect, disconnect, get events, create/update/delete
- `gmail-service.ts` — Gmail API (send, read, modify labels, trash)
- `gmail-handlers.ts` — IPC: email operations
- `drive-service.ts` — Drive API (list, search, upload, download, create folder, delete)
- `drive-handlers.ts` — IPC: Drive operations
- `drive-transcript-watcher.ts` — Auto-detect transcripts in Drive (Meet, Plaud Note, manual)
- `gchat-service.ts` — Google Chat API (spaces, messages, reactions, members)
- `gchat-handlers.ts` — IPC: Chat operations

**Workflow + CRM:**
- `workflow-engine.ts` — Generic BPM-lite state machine
- `workflow-ai-service.ts` — AI extraction + artifact generation
- `workflow-handlers.ts` — IPC: workflow + CRM + transcript watcher
- `crm-service.ts` — CRM-lite (companies, contacts, opportunities, Jaccard deduplication)

**AutoDev (10 files):**
- `autodev-service.ts` — Core orchestration: 7-phase full pipeline + 4-phase micro-fix
- `autodev-strategic-memory.ts` — Persistent strategic memory (roadmap, capabilities, retrospectives)
- `autodev-selflearn.ts` — EventEmitter: failure detection, user feedback, micro-fix classification
- `autodev-prompts.ts` — 10 specialized prompts with `{STRATEGIC_CONTEXT}` / `{STRATEGY_DIRECTIVE}` placeholders
- `autodev-types.ts` — Config types, `MicroFixConfig`, `MicroFixTrigger`, `AutoDevRunMode`
- `autodev-git.ts` — Git operations with safety guards (no commits to main/master)
- `autodev-github.ts` — GitHub REST API for PR creation
- `autodev-web.ts` — Web search, webpage reading, npm audit/outdated
- `autodev-sandbox.ts` — Sandboxed command execution, package verification
- `autodev-handlers.ts` — IPC: config, run-now, abort, status, history, micro-fix

**Memory + Knowledge:**
- `memory-service.ts` — 4-layer memory (raw SQLite, summaries, embeddings, facts)
- `memory-handlers.ts` — IPC: stats, compact, facts, search
- `knowledge-service.ts` — OpenClaw-style `.md` knowledge base
- `semantic-indexer.ts` — FTS5 semantic search across project files
- `smart-search-tool.ts` — Natural language file search wrapper
- `path-memory-service.ts` — Proactive filesystem indexing (OneDrive path resolution)

**Monitoring + Summaries:**
- `monitoring-service.ts` — Activity tracking (screenshots, window, idle, OCR at 30s intervals)
- `monitoring-handlers.ts` — IPC: session control, config, snapshots
- `ocr-service.ts` — Tesseract.js lazy-initialized worker (Spanish + English)
- `summary-generator.ts` — Gemini end-of-day summaries from activity logs
- `daily-digest-generator.ts` — PDF report generation + WhatsApp delivery

**Desktop Agent:**
- `desktop-agent-service.ts` — Perception-Planning-Action loop (Gemini Vision → PowerShell P/Invoke)
- `desktop-agent-handlers.ts` — IPC: task execution, screenshot, mouse/keyboard/window
- `computer-use-handlers.ts` — Low-level IPC: filesystem, shell, system info, email, security filters

**Proactive + Notifications:**
- `proactive-service.ts` — Calendar + task deadline alerts with Gemini composition
- `proactive-guardian.ts` — CPU/RAM threshold monitoring with auto-healing
- `system-guardian.ts` — Watchdog for CPU, RAM, disk; WhatsApp alerts

**Utilities:**
- `clipboard-ai-assistant.ts` — Clipboard history polling with Gemini analysis
- `clipboard-manager.ts` — Bidirectional clipboard sync with history
- `task-scheduler.ts` — Cron-based WhatsApp prompt injection
- `scheduled-tasks.ts` — Persistent task storage with cron scheduling
- `thought-logger.ts` — SQLite task orchestrator with worker restart callbacks
- `neural-organizer.ts` — Intelligent file organization with OCR + Gemini classification
- `safe-browser-tool.ts` — Offscreen window URL analysis for suspicious links
- `app-launcher-tool.ts` — Cross-platform app launching
- `updater-service.ts` — electron-updater integration with 4-hour polling
- `updater-handlers.ts` — IPC: auto-update management
- `mcp-manager.ts` — Dynamic tool loading from `tools/dynamic/` via `fs.watch`
- `agent-task-queue.ts` — Resilient task queue with exponential backoff + AbortSignal
- `iris-data-main.ts` — Direct IRIS Supabase access from main process

### `src/` — Renderer (React 18)

**Components (27):**

| Component | File | Purpose |
|-----------|------|---------|
| App | `App.tsx` | Main routing: chat, screen, project, productivity views |
| Auth | `Auth.tsx` | SOFIA login with animated gradient |
| ChatUI | `adapters/desktop_ui/ChatUI.tsx` | Chat interface with conversation sidebar |
| FlowMode | `FlowMode.tsx` | Minimalist overlay with Gemini Live API + grounding |
| ProductivityDashboard | `ProductivityDashboard.tsx` | Monitoring visualization, calendar, timeline |
| ProjectHub | `ProjectHub.tsx` | IRIS teams/projects/issues tree view |
| ScreenViewer | `ScreenViewer.tsx` | Real-time desktop capture with source picker |
| AutoDevPanel | `AutoDevPanel.tsx` | AutoDev run control, config, history, status |
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
| MonitoringControls | `monitoring/MonitoringControls.tsx` | Session start/stop |
| CalendarPanel | `monitoring/CalendarPanel.tsx` | Connected calendars + auto-trigger |
| DailyTimeline | `monitoring/DailyTimeline.tsx` | Activity timeline visualization |
| AppUsageChart | `monitoring/AppUsageChart.tsx` | Bar/pie charts for app usage |
| SummaryCard | `monitoring/SummaryCard.tsx` | Daily summary with metrics |

**Services (22):**

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
| `sofia-auth.ts` | SOFIA authentication wrapper |
| `org-service.ts` | Organization/team management |
| `settings-service.ts` | User AI preferences (model, temperature, system prompt) |
| `api-keys.ts` | API key management with caching |
| `gmail-service.ts` | Renderer-side Gmail IPC wrapper |
| `drive-service.ts` | Renderer-side Drive IPC wrapper |
| `monitoring-service.ts` | Renderer-side monitoring IPC wrapper |
| `updater-service.ts` | Renderer-side updater IPC wrapper |
| `tools-service.ts` | Dynamic tool management |
| `workflow-renderer-service.ts` | Renderer-side workflow IPC wrapper |
| `crm-renderer-service.ts` | Renderer-side CRM IPC wrapper |

**Core Architecture (`src/core/`):**
- `entities/ActivityLog.ts` — TypeScript interfaces for activity logging
- `entities/User.ts` — User domain entity
- `ports/AIAssistant.ts` — AI assistant port interface
- `ports/OSAutomation.ts` — OS automation port interface
- `ports/TrackingRepository.ts` — Tracking repository port interface
- `ports/Tool.ts` — Tool port interface
- `use_cases/productivity_tracking/` — Use case implementations

**Contexts:**
- `AuthContext.tsx` — Global auth state, SOFIA session management, organization/team selection

**Library Clients:**
- `lib/supabase.ts` — Lia Supabase client
- `lib/iris-client.ts` — IRIS Supabase client with TypeScript types
- `lib/sofia-client.ts` — SOFIA Supabase client

### `sql/` — Database Schemas
- `workflow-crm-tables.sql` — CRM + Workflow tables (IRIS Supabase)
- `monitoring-tables.sql` — Monitoring tables (Lia Supabase): sessions, activity_logs, daily_summaries, calendar_connections

### `scripts/` — Build & CLI
- `autodev.ts` — Standalone AutoDev CLI runner (`npx tsx scripts/autodev.ts`)
- `generate-bitmaps.js` — Icon/bitmap generation for electron-builder
- `generate-installer-images.js` — Installer image generation

### `tools/dynamic/` — Runtime Tools
- Watched by MCPManager for hot-reloadable tool plugins
- Currently empty — tools are created by AutoDev or manually

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

# Optional
VITE_GAMMA_API_KEY=               # Gamma API key (presentation generation)
```

---

## Development Commands

```bash
npm run dev        # Start Vite dev server + Electron (hot-reload)
npm run build      # Production: tsc → vite build → generate-bitmaps → electron-builder
npm run lint       # ESLint strict mode (zero warnings allowed)
npx tsc --noEmit   # TypeScript type check only
npm run autodev    # Run AutoDev standalone (npx tsx scripts/autodev.ts)
```

---

## Conventions

### Code Style
- **Language:** All UI text, prompts, comments, and logs in **Spanish**
- **File naming:** `kebab-case` for all files (e.g., `whatsapp-agent.ts`, `memory-service.ts`)
- **IPC naming:** `namespace:action` (e.g., `workflow:start-run`, `crm:get-company`, `autodev:micro-fix-status`)
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

### Error Handling
- IPC handlers: always wrap in try/catch, return `{ success: false, error: message }`
- AI calls: fallback chain (primary model → fallback model)
- AutoDev: exponential backoff via `agent-task-queue.ts`
- Services: EventEmitter `'error'` events

### Config Persistence
- Runtime configs stored as JSON in `app.getPath('userData')/`
- Examples: `autodev-config.json`, `autodev-strategic-memory.json`, `monitoring-config.json`, `proactive-config.json`
- Strategic memory: `autodev-strategic-memory.json` (roadmap, capabilities, retrospectives)

### Standalone Compatibility (Critical)
AutoDev and some services run outside Electron via `npx tsx`. **All `electron` imports must use dynamic `require()` with try/catch:**
```typescript
// CORRECT — works in both Electron and standalone
let app: { getPath: (name: string) => string } | undefined;
try {
  const electron = require('electron');
  app = electron.app;
} catch {
  // Running outside Electron (standalone CLI mode)
}

// WRONG — crashes immediately in standalone mode
import { app } from 'electron';
```

### Git Conventions
- AutoDev work branches: `autodev/{description}` prefix
- Never commit directly to `main`/`master`
- PRs created via GitHub REST API (`autodev-github.ts`)
- Merge conflict markers auto-detected and cleaned after branch operations
