<p align="center">
  <img src="public/assets/icono.ico" alt="SofLIA Hub" width="80" />
</p>

<h1 align="center">SofLIA Hub — Desktop AI Agent</h1>

<p align="center">
  <b>Asistente de productividad omnipotente que integra IA, WhatsApp, Google Workspace, CRM y automatización de flujos comerciales.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-30.5-47848F?logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Gemini_3-Flash_&_Pro-4285F4?logo=google&logoColor=white" alt="Gemini" />
  <img src="https://img.shields.io/badge/Supabase-3_instancias-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Platform-Windows_|_Mac_|_Linux-lightgrey" alt="Platform" />
</p>

---

## 📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Arquitectura](#-arquitectura)
- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológico](#-stack-tecnológico)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Configuración](#-configuración)
- [Ejecución](#-ejecución)
- [Empaquetado](#-empaquetado)
- [Seguridad](#-seguridad)
- [Modelos de IA](#-modelos-de-ia)

---

## 🧠 Descripción

**SofLIA Hub** es una aplicación de escritorio multiplataforma (Electron) que funciona como un agente de IA autónomo con control total del computador del usuario. Combina:

- **Agente de WhatsApp** con control omnipotente de la PC
- **Integración con Google Workspace** (Calendar, Gmail, Drive, Chat)
- **Gestión de proyectos con IRIS** (Project Hub)
- **CRM-lite** con prospección inteligente
- **Motor de Workflows** (BPM-lite) con aprobaciones HITL
- **AutoDev** — sistema de auto-programación con arquitectura multi-agente
- **Monitoreo de productividad** con visión computacional
- **Sistema de memoria infinita** con 3 capas (raw, summaries, semantic)
- **Knowledge Base** persistente estilo OpenClaw

Utiliza los modelos más avanzados de Google Gemini (3 Flash/Pro) para ofrecer una experiencia fluida, multimodal y altamente autónoma.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    SofLIA Hub Desktop                    │
├──────────────────────┬──────────────────────────────────┤
│   Renderer (React)   │       Main Process (Electron)     │
│                      │                                   │
│  • Chat UI           │  • WhatsApp Agent (Baileys)       │
│  • Settings Modal    │  • Computer Use Handlers          │
│  • AutoDev Panel     │  • Monitoring Service             │
│  • Tool Library      │  • Calendar / Gmail / Drive       │
│  • Workflow Timeline │  • Google Chat Service            │
│  • Productivity Dash │  • Workflow Engine (BPM-lite)     │
│  • Approval Inbox    │  • CRM Service                   │
│  • Screen Viewer     │  • AutoDev Service (Multi-agent)  │
│  • Flow Mode         │  • Memory Service (SQLite)        │
│  • User Management   │  • Knowledge Service (.md files)  │
│  • Meeting Workflow  │  • Proactive Service              │
│                      │  • Drive Transcript Watcher       │
│                      │  • MCP Manager                    │
│                      │  • Semantic Indexer               │
│                      │  • Summary Generator              │
│                      │  • System Guardian                │
│                      │  • Thought Logger                 │
├──────────────────────┴──────────────────────────────────┤
│                   Supabase (3 instancias)                │
│  SOFIA (Auth) │ Lia (Datos App) │ IRIS (Proyectos+CRM)  │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Funcionalidades

### 📱 Agente de WhatsApp

Controla tu computadora desde cualquier lugar enviando mensajes de WhatsApp.

- **Principio Omnipotente**: El agente puede realizar cualquier acción que un usuario haría sentado frente a su PC.
- **Detección Automática**: Identifica a los usuarios por su número de teléfono vinculado a su perfil de SofLIA Learning.
- **Multimodal**: Procesa y analiza imágenes, documentos (PDF, Word, Excel) y mensajes de voz enviados por chat.
- **40+ herramientas** disponibles: gestión de archivos, terminal, email, calendario, CRM, knowledge base, computer use, y más.

### 🏗️ Integración con IRIS (Project Hub)

Gestión completa de tareas y proyectos directamente desde WhatsApp:

- **Lectura**: Consulta tus tareas asignadas, lista de proyectos y equipos.
- **Escritura**: Crea nuevos proyectos y tareas (issues) mediante comandos de voz o texto.
- **Actualización**: Cambia el estado (Backlog, To Do, Done) o la prioridad de cualquier tarea sobre la marcha.
- **Contexto Inteligente**: El agente verifica estados y prioridades disponibles por equipo para asegurar cambios válidos.

### 💻 Control de Escritorio & Computer Use

- **Visión Computacional**: Navega visualmente por la pantalla, hace clicks, escribe y usa aplicaciones GUI.
- **AXTree (Accessibility Tree)**: Extrae estructura semántica de la UI para análisis eficiente.
- **Gestión de Archivos**: Busca, lee, crea, mueve y envía archivos a través de WhatsApp.
- **Terminal y Código**: Ejecuta comandos seguros y lanza sesiones de desarrollo autónomo.
- **Automatización de Documentos**: Genera archivos Word (.docx) y Excel (.xlsx) profesionales basados en búsquedas web o datos de usuario.
- **OCR**: Extracción de texto de capturas de pantalla con Tesseract.js.

### 📧 Google Workspace Completo

| Servicio        | Funcionalidades                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Calendar**    | Consultar, crear, actualizar, eliminar eventos. Auto-detección de horario laboral. Soporte Google + Microsoft Outlook. |
| **Gmail**       | Enviar emails (con adjuntos), leer bandeja, gestionar etiquetas, mover a papelera.                                     |
| **Drive**       | Listar archivos, subir/descargar, crear carpetas, buscar, eliminar.                                                    |
| **Google Chat** | Listar spaces, enviar mensajes, leer conversaciones, agregar reacciones.                                               |

### 🔄 Motor de Workflows (BPM-lite)

Motor de flujos genérico para procesos comerciales/operativos:

- **Definiciones reutilizables** con pasos configurables (IA, aprobación humana, ejecución, enrutamiento).
- **Aprobaciones HITL** (Human-in-the-Loop) con ledger auditable.
- **Artefactos versionados**: el sistema genera borradores con IA → el humano revisa, edita y aprueba.
- **SLA con escalamiento**: cada paso puede tener un tiempo límite configurable.
- **Workflow de ejemplo**: `meeting_followup` — Desde reunión hasta seguimiento comercial completo.

### 📊 CRM-lite

Gestión de prospectos y oportunidades integrada:

- **Empresas**: CRUD con deduplicación fuzzy por nombre/dominio.
- **Contactos**: Vinculación a empresas, búsqueda inteligente.
- **Oportunidades**: Pipeline con etapas (lead → qualified → proposal → negotiation → won/lost).
- **Interacciones**: Registro de reuniones, llamadas, emails, WhatsApp con resúmenes de IA.

### 🤖 AutoDev — Auto-Programación Multi-Agente

Sistema de desarrollo autónomo que puede programarse a sí mismo:

- **Arquitectura multi-agente**: Researcher → Coder → Reviewer → Tester
- **Ejecución paralela**: Los agentes trabajan en paralelo donde es posible.
- **Sandbox segura**: Ejecución de código en entorno controlado.
- **Git integrado**: Crea branches, commits, push y Pull Requests automáticamente.
- **Error Memory**: Aprende de errores de build pasados para no repetirlos.
- **Self-learning**: Mejora continuamente basado en feedback.
- **Issues tracking**: Documenta limitaciones y errores en `AUTODEV_ISSUES.md`.

### 🧠 Sistema de Memoria Infinita

Arquitectura de 3 capas para contexto ilimitado:

| Capa                      | Descripción                                 | Almacenamiento             |
| ------------------------- | ------------------------------------------- | -------------------------- |
| **L1: Raw Messages**      | Persistencia completa de todos los mensajes | SQLite                     |
| **L2: Rolling Summaries** | Resúmenes periódicos de conversaciones      | SQLite + Gemini            |
| **L3: Semantic Search**   | Chunks embeddings para búsqueda semántica   | SQLite + Cosine Similarity |

Además incluye:

- **Facts**: Datos duraderos extraídos por IA (preferencias, nombres, decisiones).
- **Soul/Identity**: Perfil de personalidad del usuario para respuestas personalizadas.
- **Token budgets**: Control de presupuesto de tokens por sección.

### 📚 Knowledge Base (OpenClaw-style)

Sistema persistente de conocimiento basado en archivos `.md`:

- **MEMORY.md**: Memoria curada de largo plazo (siempre inyectada en prompt).
- **Perfiles de usuario**: Un archivo `.md` por número de teléfono con contexto personalizado.
- **Daily logs**: Registro diario de interacciones importantes.
- **Búsqueda cross-file**: Búsqueda textual a través de todos los archivos de conocimiento.
- **Bootstrap context**: Inyección automática de contexto relevante en cada conversación.

### 📈 Monitoreo de Productividad

- **Captura de ventana activa**: Detecta la aplicación y título en uso.
- **Estado de inactividad**: Detecta cuando el usuario está idle.
- **Screenshots programados**: Captura de pantalla en intervalos configurables.
- **OCR sobre screenshots**: Extrae texto de las capturas para análisis.
- **Semantic snapshots**: Genera AXTree + screenshot para análisis multimodal.
- **Dashboard en UI**: Gráficos de uso de apps, timeline diario, resúmenes con IA.
- **Integración con Calendar**: Inicia monitoreo automáticamente en horas de trabajo.

### 🔔 Notificaciones Proactivas

- Revisa Calendar, IRIS y estado del sistema periódicamente.
- Compone mensajes naturales con Gemini para notificar vía WhatsApp.
- Configuración de horarios, tipos de alertas y frecuencia.
- Alertas de sistema: CPU alta, memoria alta, procesos críticos.

### 📄 Detección Automática de Transcripciones

- **Drive Transcript Watcher**: Monitorea carpetas de Google Drive en busca de nuevas transcripciones.
- Soporta: Google Meet (Gemini transcripts), PLAUD (grabaciones), archivos manuales.
- Extrae texto de Google Docs, `.txt`, `.md`, `.docx`, `.csv`.
- Auto-trigger de workflows de seguimiento al detectar nuevas transcripciones.

### 💬 Chat con IA (UI Desktop)

- **Streaming con Gemini**: Respuestas en tiempo real con chunks progresivos.
- **Markdown Renderer**: Headers, code blocks, listas, bold, inline code.
- **Google Search Grounding**: Respuestas basadas en búsquedas web.
- **Historial de conversaciones**: Persistencia en Supabase con auto-save.
- **Sistema de carpetas/proyectos**: Organización de chats en carpetas.
- **Prompt Optimizer**: Mejora automática de prompts con IA.
- **Flow Mode**: Modo de flujo para sesiones de trabajo enfocadas.
- **Generación de imágenes**: Modelo `gemini-2.5-flash-image`.

---

## 🛡️ Seguridad

### En Grupos de WhatsApp

- **Activación estricta**: Solo responde cuando se menciona como _"soflia"_, se etiqueta, se responde a sus mensajes o se usa el prefijo `/soflia`.
- **Herramientas bloqueadas**: Acciones destructivas o de control físico (apagar PC, terminal, visión computacional) desactivadas para usuarios en grupos.
- **Historial de grupo**: Mantiene búfer de contexto para entender conversaciones previas en modo pasivo.

### Computer Use

- **Validación de Indirect Prompt Injection**: El sistema valida capturas de pantalla antes de procesarlas con IA para detectar inyecciones maliciosas.

### Confirmación de Acciones

- **Herramientas peligrosas con confirmación**: Acciones como reboot, shutdown, delete, formateo requieren confirmación explícita del usuario.

---

## ⚙️ Configuración

El proyecto requiere un archivo `.env` en la raíz con las siguientes variables:

```env
# ─── Gemini API Key ──────────────────────────────────────
VITE_GEMINI_API_KEY=tu_api_key_aqui

# ─── Supabase — Lia (conversaciones, meetings, settings) ─
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# ─── SOFIA Supabase (autenticación + organizaciones) ──────
VITE_SOFIA_SUPABASE_URL=https://xxxx.supabase.co
VITE_SOFIA_SUPABASE_ANON_KEY=eyJ...

# ─── IRIS Supabase (Project Hub + CRM + Workflows) ───────
VITE_IRIS_SUPABASE_URL=https://xxxx.supabase.co
VITE_IRIS_SUPABASE_ANON_KEY=eyJ...

# ─── Google OAuth (Calendar + Gmail + Drive + Chat) ──────
VITE_GOOGLE_OAUTH_CLIENT_ID=xxxx.apps.googleusercontent.com
VITE_GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxx

# ─── Gamma API (presentaciones) ──────────────────────────
VITE_GAMMA_API_KEY=sk-gamma-xxxx
```

### Base de Datos (SQL)

Las tablas para CRM y Workflows deben crearse ejecutando los scripts SQL en el SQL Editor de Supabase (IRIS):

- `sql/workflow-crm-tables.sql` — CRM (companies, contacts, opportunities, interactions) + Workflow Engine (definitions, runs, steps, artifacts, approvals).
- `sql/monitoring-tables.sql` — Tablas para persistencia del monitoreo de productividad.

---

## 🛠️ Stack Tecnológico

| Categoría               | Tecnología                                                   |
| ----------------------- | ------------------------------------------------------------ |
| **Framework**           | Electron 30.5 + Vite 5 + React 18 + TypeScript 5.7           |
| **Estilos**             | Tailwind CSS v4 (`@tailwindcss/postcss`, directiva `@theme`) |
| **IA**                  | Google Generative AI SDK (`@google/generative-ai`)           |
| **Modelos**             | Gemini 3 Flash/Pro, Live Audio, Image Gen, Deep Research     |
| **Base de datos**       | Supabase (3 instancias: SOFIA, Lia, IRIS)                    |
| **Base de datos local** | SQLite (better-sqlite3) — Memory Service                     |
| **WhatsApp**            | Baileys (`@whiskeysockets/baileys` 7.0)                      |
| **Google APIs**         | googleapis (Calendar, Gmail, Drive, Chat)                    |
| **Microsoft**           | MSAL Node + Microsoft Graph Client (Outlook)                 |
| **Documentos**          | docx (Word), exceljs (Excel)                                 |
| **OCR**                 | Tesseract.js 5                                               |
| **Imágenes**            | Sharp                                                        |
| **Validación**          | Zod                                                          |
| **Animaciones**         | Framer Motion                                                |
| **Empaquetado**         | electron-builder 26.8                                        |
| **System Info**         | systeminformation (CPU, RAM, procesos)                       |

---

## 🗂️ Estructura del Proyecto

```
SofLIA-HUB/
├── electron/                        # Main Process (Node.js)
│   ├── main.ts                      # Entry point: Tray, IPC, service wiring
│   ├── preload.ts                   # contextBridge (40+ API methods)
│   ├── whatsapp-agent.ts            # Agente principal WhatsApp (3800+ líneas)
│   ├── whatsapp-service.ts          # Baileys connection manager
│   ├── whatsapp-terminal.ts         # Terminal commands via WhatsApp
│   ├── whatsapp-workflow-*.ts       # Workflows: reunión, presentación
│   ├── workflow-engine.ts           # Motor BPM-lite genérico
│   ├── workflow-ai-service.ts       # Generación de artefactos con IA
│   ├── workflow-handlers.ts         # IPC handlers para workflows
│   ├── crm-service.ts              # CRM-lite: empresas, contactos, oportunidades
│   ├── autodev-service.ts          # Auto-programación multi-agente (1800+ líneas)
│   ├── autodev-git.ts              # Git operations (branch, commit, push, PR)
│   ├── autodev-prompts.ts          # Prompts para agentes AutoDev
│   ├── autodev-sandbox.ts          # Sandbox segura de ejecución
│   ├── autodev-selflearn.ts        # Self-learning engine
│   ├── autodev-types.ts            # Tipos AutoDev
│   ├── autodev-web.ts              # Web scraping para research
│   ├── memory-service.ts           # Memoria infinita 3 capas (SQLite)
│   ├── knowledge-service.ts        # Knowledge Base (.md, OpenClaw-style)
│   ├── monitoring-service.ts       # Monitoreo de productividad
│   ├── calendar-service.ts         # Google Calendar + Microsoft Outlook
│   ├── gmail-service.ts            # Gmail API integration
│   ├── drive-service.ts            # Google Drive API
│   ├── drive-transcript-watcher.ts # Auto-detección de transcripciones
│   ├── gchat-service.ts            # Google Chat API
│   ├── proactive-service.ts        # Notificaciones proactivas
│   ├── computer-use-handlers.ts    # Computer Use: mouse, keyboard, screen
│   ├── iris-data-main.ts           # IRIS data layer (proyectos, issues)
│   ├── mcp-manager.ts              # Model Context Protocol manager
│   ├── neural-organizer.ts         # Organizador neuronal de contexto
│   ├── semantic-indexer.ts         # Indexador semántico de archivos
│   ├── summary-generator.ts        # Generador de resúmenes con IA
│   ├── system-guardian.ts          # Guardian del sistema
│   ├── thought-logger.ts           # Logger de razonamiento del agente
│   └── ocr-service.ts             # OCR con Tesseract.js
│
├── src/                             # Renderer Process (React)
│   ├── App.tsx                      # App principal (sidebar, routing, state)
│   ├── main.tsx                     # Entry point React
│   ├── config.ts                    # API keys, modelos, URLs
│   ├── index.css                    # Tailwind v4 @theme (colores, animaciones)
│   ├── adapters/
│   │   ├── desktop_ui/
│   │   │   └── ChatUI.tsx           # Chat UI con streaming + markdown
│   │   ├── gemini_service/          # Adapter Gemini
│   │   ├── os_automation/           # Adapter OS
│   │   ├── tools/                   # Adapter Tools
│   │   └── tracking/               # Adapter Tracking
│   ├── components/
│   │   ├── Auth.tsx                 # Login screen
│   │   ├── WhatsAppSetup.tsx        # Setup y QR de WhatsApp
│   │   ├── AutoDevPanel.tsx         # Panel de auto-programación
│   │   ├── ToolLibrary.tsx          # Biblioteca de herramientas
│   │   ├── ToolEditorModal.tsx      # Editor de tools personalizados
│   │   ├── SettingsModal.tsx        # Configuración del usuario
│   │   ├── FlowMode.tsx             # Modo flujo de trabajo
│   │   ├── ProductivityDashboard.tsx # Dashboard de productividad
│   │   ├── ProjectHub.tsx           # Vista de proyecto/folder
│   │   ├── FolderModals.tsx         # Modales crear/mover carpeta
│   │   ├── ScreenViewer.tsx         # Visor de captura de pantalla
│   │   ├── ApprovalInbox.tsx        # Bandeja de aprobaciones HITL
│   │   ├── ArtifactReviewModal.tsx  # Modal de revisión de artefactos
│   │   ├── ConfirmActionModal.tsx   # Modal de confirmación de acciones
│   │   ├── WorkflowTimeline.tsx     # Timeline visual de workflows
│   │   ├── MeetingWorkflowTrigger.tsx # Trigger de workflow de reunión
│   │   ├── UserManagementModal.tsx  # Gestión de usuarios
│   │   └── monitoring/
│   │       ├── AppUsageChart.tsx     # Gráfico de uso de apps
│   │       ├── CalendarPanel.tsx     # Panel de calendario
│   │       ├── DailyTimeline.tsx     # Timeline diario
│   │       ├── MonitoringControls.tsx # Controles de monitoreo
│   │       └── SummaryCard.tsx       # Tarjeta de resumen con IA
│   ├── contexts/
│   │   └── AuthContext.tsx          # AuthProvider + useAuth
│   ├── core/                        # Clean Architecture (entities, ports, use_cases)
│   ├── lib/
│   │   ├── supabase.ts             # Cliente Supabase Lia
│   │   └── sofia-client.ts         # Cliente SOFIA + tipos
│   ├── prompts/
│   │   ├── chat.ts                  # System prompt LIA
│   │   ├── flow.ts                  # Prompts modo flujo
│   │   ├── prompt-optimizer.ts      # Optimizador de prompts
│   │   └── utils.ts                # Utilidades de prompts
│   └── services/
│       ├── sofia-auth.ts            # Auth service SOFIA
│       ├── chat-service.ts          # CRUD conversaciones Supabase
│       ├── gemini-chat.ts           # Streaming Gemini + historial
│       ├── gemini-tools.ts          # Tool calling en renderer
│       ├── folder-service.ts        # CRUD folders Supabase
│       ├── iris-data.ts             # IRIS data (renderer side)
│       ├── live-api.ts              # Gemini Live API (WebSocket audio)
│       ├── computer-use-service.ts  # Computer Use (renderer)
│       ├── monitoring-service.ts    # Monitoreo (renderer side)
│       ├── image-generation.ts      # Generación de imágenes
│       ├── flow-service.ts          # Flow mode service
│       ├── drive-service.ts         # Drive (renderer side)
│       ├── gmail-service.ts         # Gmail (renderer side)
│       ├── crm-renderer-service.ts  # CRM (renderer side)
│       ├── workflow-renderer-service.ts # Workflows (renderer side)
│       ├── org-service.ts           # Organizaciones
│       ├── settings-service.ts      # Settings del usuario
│       ├── tools-service.ts         # Gestión de tools
│       └── api-keys.ts             # Gestión de API keys
│
├── sql/
│   ├── workflow-crm-tables.sql      # Tablas CRM + Workflow Engine
│   └── monitoring-tables.sql        # Tablas de monitoreo
│
├── public/                          # Assets estáticos
├── scripts/                         # Scripts utilitarios
├── .env                             # Variables de entorno (no comitear)
├── electron-builder.json5           # Configuración de empaquetado
├── package.json                     # Dependencias y scripts
├── vite.config.ts                   # Configuración de Vite
├── tailwind.config.js               # Configuración de Tailwind
├── tsconfig.json                    # TypeScript config
└── tsconfig.node.json               # TypeScript config (Node)
```

---

## ▶️ Ejecución

```bash
# Instalar dependencias
npm install

# Modo desarrollo (Electron + Vite hot reload)
npm run dev

# Lint
npm run lint
```

---

## 📦 Empaquetado

```bash
# Build de producción
npm run build

# El instalador se genera en release/{version}/
# Windows: SofLIA Hub-Windows-{version}-Setup.exe
# Mac:     SofLIA Hub-Mac-{version}-Installer.dmg
# Linux:   SofLIA Hub-Linux-{version}.AppImage
```

**Configuración de empaquetado** (`electron-builder.json5`):

- **App ID**: `com.pulsehub.sofliahub`
- **Windows**: NSIS installer (x64), permite cambiar directorio de instalación.
- **Mac**: DMG
- **Linux**: AppImage

---

## 🤖 Modelos de IA

```typescript
export const MODELS = {
  PRIMARY: "gemini-3-flash-preview", // Chat principal
  FALLBACK: "gemini-2.5-flash", // Fallback
  PRO: "gemini-3-pro-preview", // Análisis complejos
  WEB_AGENT: "gemini-3-flash-preview", // Computer Use
  LIVE: "gemini-2.5-flash-native-audio-preview-12-2025", // Audio bidireccional
  IMAGE_GENERATION: "gemini-2.5-flash-image", // Generación de imágenes
  DEEP_RESEARCH: "deep-research-pro-preview-12-2025", // Investigación profunda
  TRANSCRIPTION: "gemini-2.5-flash", // Transcripción de audio
  MAPS: "gemini-2.5-flash", // Geolocalización
};
```

---

## 📄 Licencia

Proyecto privado de **Pulse Hub**. Todos los derechos reservados.
