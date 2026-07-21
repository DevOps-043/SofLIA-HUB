# SofLIA Hub — Desktop AI Agent ✨🧬

**SofLIA Hub** es un ecosistema de productividad empresarial de alto rendimiento construido como aplicación de escritorio con **Electron**. Centraliza el control total de tu entorno digital con una estética de ingeniería premium, fusionando inteligencia artificial (**Gemini 3.5 Flash / 3.1 Pro / 3.1 Flash-Lite**), comunicación por **WhatsApp + Telegram**, gestión de proyectos en **IRIS**, Google Workspace completo, automación autónoma de la computadora, meeting ops inteligente y un motor de workflows ejecutivos — todo en una sola interfaz.

Utiliza modelos de lenguaje de última generación (**Gemini 3.5 Flash / 3.1 Pro / 3.1 Flash-Lite**) para ofrecer una experiencia multimodal, autónoma y predictiva que se adapta dinámicamente a tu flujo de trabajo.

> **v0.5.2** · Mayo 2026 · Desarrollado por [Pulse Hub](https://github.com/Memory-Bank)

---

## 📐 Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       SofLIA Hub (Electron 34+)                         │
├──────────────────────────────┬──────────────────────────────────────────┤
│   Renderer (React 18)        │   Main Process (Node.js)                 │
│                              │                                          │
│   src/components/ (30+)      │   electron/ (90+ archivos .ts)           │
│   src/services/  (27)        │   IPC: contextBridge + preload.ts        │
│   src/hooks/     (7)         │   Seguridad: CSP + 190+ canales IPC     │
│   src/contexts/  (Auth)      │   allowlist + payload sanitization       │
│   src/prompts/   (4)         │                                          │
│   src/core/ (entities+ports) │   Services: 50+ servicios aislados       │
│   src/lib/ (4 Supabase)      │   Meetings: 12 módulos especializados   │
├──────────────────────────────┴──────────────────────────────────────────┤
│                          Capa de Datos                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐  │
│  │  SOFIA    │  │  Lia     │  │  IRIS    │  │  Local SQLite          │  │
│  │  Auth     │  │  Chat    │  │  Projects│  │  memory, knowledge,    │  │
│  │  Orgs     │  │  Monitor │  │  CRM     │  │  thoughts, semantic    │  │
│  │  Teams    │  │  Memory  │  │  Workflow │  │  index, scheduled      │  │
│  │  Profiles │  │  Calendar│  │  Meetings │  │  tasks, facts          │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────────────┘  │
│                                                                          │
│  JSON Config (userData/): autodev-config, autodev-strategic-memory,      │
│  monitoring-config, proactive-config, desktop-agent-config, etc.         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Patrón IPC (estricto — 4 capas)

Cada funcionalidad sigue esta arquitectura de seguridad:

1. `electron/*-service.ts` — Lógica de negocio en proceso principal (EventEmitter)
2. `electron/*-handlers.ts` — `ipcMain.handle()` con respuestas `{ success, error?, ...data }`
3. `electron/preload.ts` — `contextBridge.exposeInMainWorld()` con **190+ canales IPC autorizados**
4. `src/services/*-service.ts` — Wrappers tipados en renderer vía `window.electronAPI.invoke()`

**Seguridad:**
- Todos los canales IPC pasan por `ALLOWED_IPC_CHANNELS` — ningún canal funciona sin estar en la allowlist
- Sanitización de payload en todos los datos entrantes (prototipos, getters, funciones → bloqueados)
- CSP inyectado vía `<meta>` para prevenir ejecución de scripts arbitrarios
- `whatsapp-remote-hub.ts` filtra patrones peligrosos por regex

---

## 💎 ADN de Diseño: Ingeniería de Cristalismo

Interfaz completa rediseñada bajo principios de **Glassmorphism Industrial** y el **SOFIA Design System**:

- **Interfaz Fluida**: Transparencias profundas (`backdrop-blur-md`), desenfoques gaussianos y micro-glows ambientales. Menús flotantes compactos basados en íconos vectoriales dinámicos.
- **Tipografía de Precisión**: Headings técnicos en negrita y etiquetas monoespaciadas para legibilidad superior.
- **Acentos de Energía**: Paletas curadas en _Cyan Accent_ y _Ruby Alert_, con tonos _Aqua_ (`#00D4B3`) y azul profundo corporativo (`#0A2540`).
- **Modo Claro / Oscuro**: Soporte nativo completo. Logo dinámico que cambia automáticamente según el tema activo (blanco en light, negro en dark).
- **Animaciones Premium**: Framer Motion para transiciones fluidas entre paneles y estados.

---

## 🚀 Módulos Operativos

### 💬 Chat IA Premium (Experiencia Multimodal)

Interfaz in-place optimizada y responsiva al estilo de los mejores clientes de IA del mercado.

- **Edición Avanzada y Regeneración**: Edición limpia de prompts in-place que ocupa todo el ancho de texto. Borrado automático de historial subsecuente y regeneración del contexto completo al modificar peticiones anteriores.
- **Selector Evolutivo de Modelos**: Cambio fluido entre modelos de la familia SofLIA (Pro, Flash, Lite, Deep, Swift) con diseño premium glassmorphism.
- **Prompt Optimizer**: Optimización automática de prompts para mejores resultados antes de enviarlos al modelo.
- **Generación de Imágenes**: Creación de imágenes desde el chat con Gemini 2.5 Flash Image.
- **Deep Research**: Investigación profunda con `deep-research-pro-preview`.
- **Audio Bidireccional (Live API)**: Soporte de audio nativo en tiempo real vía WebSocket.
- **Dictado por Voz**: Web Speech Recognition API (es-MX) con auto-stop por silencio de 2.5 segundos.
- **Asistente de Portapapeles Robusto**: Fallback nativo con notificaciones en tiempo real.
- **Renderizado Markdown Avanzado**: Componente dedicado (`MarkdownRenderer.tsx`) para código, tablas y contenido formateado.

### 📱 Terminal de WhatsApp (Omnipotente — 40+ herramientas)

Control absoluto de tu estación de trabajo desde cualquier lugar con redundancia de seguridad.

- **Agente Conversacional con Gemini**: Loop agentico completo con `function calling` y 40+ herramientas organizadas por categoría.
- **Procesamiento Multimodal**: Análisis de imágenes, audios técnicos, documentos densos y archivos recibidos directamente por WhatsApp.
- **Sistema de Memoria de Rutas**: Escaneo proactivo (incluyendo rutas localizadas como OneDrive o "Escritorio") para armar un mapa en tiempo real.
- **Detección de Patrones**: Auto-detección de quejas y sugerencias del usuario para micro-fixes.
- **Saneamiento Unicode/Mojibake**: Normalización automática de caracteres rotos antes de formatear y enviar respuestas.
- **Timeout Automático en Workflows**: Workflows activos se cancelan tras 5 minutos de inactividad.
- **Protección contra Bucles**: Detección de respuestas genéricas repetidas con reintento inteligente.

#### Ecosistema de Herramientas WhatsApp (40+)

| Categoría | Herramientas |
|-----------|-------------|
| **Archivos** | `list_directory`, `read_file`, `write_file`, `create_directory`, `move_item`, `copy_item`, `delete_item`, `get_file_info`, `search_files`, `organize_files`, `batch_move_files`, `list_directory_summary` |
| **Sistema** | `get_system_info`, `clipboard_read`, `clipboard_write`, `open_file_on_computer`, `open_url` |
| **Web** | `web_search`, `web_search_advanced`, `read_webpage`, `get_current_time`, `semantic_file_search` |
| **Google Workspace** | `gmail_send`, `gmail_read`, `gmail_trash`, `google_calendar_create/update/delete`, `google_drive_upload/download/search`, `gchat_send_message`, `gchat_get_members` |
| **IRIS** | `iris_get_teams/projects/issues`, `iris_create_issue/project`, `iris_update_issue`, `iris_get_statuses/priorities` |
| **WhatsApp** | `whatsapp_send_file` |
| **Bloqueadas en Grupos** | `execute_command`, `open_application`, `write_file`, `move_item`, `delete_item`, `clipboard_write`, etc. |

### 🤖 Telegram Bot

Integración con Telegram para recibir y enviar mensajes a través de un bot configurado.

- **Gestión de Estado**: Conexión, desconexión y prueba de conectividad.
- **Envío de Mensajes**: Comunicación directa desde la app a chats de Telegram.
- **Lista de Chats Recientes**: Consulta de chats activos.

### 🧠 Inteligencia Artificial (Multi-Modelo)

Motor cognitivo centralizado con 9 configuraciones de modelo y fallback automático.

| Alias | Modelo | Uso Principal |
|-------|--------|---------------|
| **PRIMARY** | `gemini-3.5-flash` | Chat general, agentes, análisis |
| **PRO** | `gemini-3.1-pro-preview` | Razonamiento complejo, coding |
| **FALLBACK** | `gemini-3.1-flash-lite` | Respaldo general, tareas ligeras |
| **WEB_AGENT** | `gemini-3.5-flash` | Búsqueda web con grounding nativo |
| **LIVE** | `gemini-2.5-flash-native-audio` | Audio bidireccional en tiempo real |
| **IMAGE_GENERATION** | `gemini-2.5-flash-image` | Generación de imágenes |
| **DEEP_RESEARCH** | `deep-research-pro-preview` | Investigación profunda |
| **TRANSCRIPTION** | `gemini-3.1-flash-lite` | Transcripción de audio |
| **MAPS** | `gemini-3.1-flash-lite` | Geolocalización y mapas |

**Branding**: Los modelos se muestran al usuario como **SofLIA** (3.5 Flash), **SofLIA Pro** (3.1 Pro) y **SofLIA Lite** (3.1 Flash-Lite).

### 🖥️ Desktop Agent V2 (Agente Autónomo de Computadora)

Operación directa de la interfaz gráfica (GUI) mediante visión artificial avanzada y pipeline Perception-Planning-Action.

1. **Perception**: Captura de screenshots vía `desktopCapturer` (multi-monitor)
2. **Planning**: Gemini Vision analiza el screenshot y genera un plan JSON de acciones
3. **Action**: Ejecución vía PowerShell P/Invoke (mouse, teclado, ventanas)

**Capacidades:**
- Click, double-click, right-click, drag-and-drop
- Escritura de texto, combinaciones de teclas, scroll
- Foco, resize, minimización de ventanas
- Ejecución paralela de tareas múltiples
- Modo observación (monitoring de pantalla)
- **Backends**: Auto, Browser (Playwright), Desktop (P/Invoke), UIA (Accessibility)
- **Windows UIA Service**: 30KB+ de servicio dedicado para inspección de árboles de accesibilidad
- **Browser Web Service**: 48KB+ de servicio para control instrumentado de navegadores con Playwright
- **Perfiles de Navegador**: Gestión de perfiles independientes para navegación automatizada

### 📁 IRIS — Project Hub

Gestión de proyectos, issues y sprints con interfaz glassmorphism.

- **Proyectos & Issues**: Sistema Kanban con estados personalizables, prioridades y asignaciones.
- **CRM-lite**: Empresas, contactos y oportunidades de negocio con deduplicación Jaccard.
- **Workflows BPM-lite**: Motor de estados finitos con aprobaciones HITL (Human-in-the-Loop).
- **Artefactos & Aprobaciones**: Generación IA de documentos con flujo de revisión humana.
- **Sincronización Bidireccional**: Accesible desde renderer (`src/services/iris-data.ts`) y main process (`electron/iris-data-main.ts`).

### 📧 Google Workspace Hub (Sincronización Total)

Puente bidireccional completo con 4 servicios de Google + Microsoft Outlook.

#### Google Calendar
- OAuth2 con auto-refresh de tokens
- CRUD completo de eventos
- Auto-start/stop de monitoreo basado en horarios de trabajo
- Polling cada 60 segundos
- Soporte Microsoft Outlook simultáneo

#### Gmail
- Lectura, envío y gestión de hilos con etiquetas
- Organización masiva inteligente de correos (preview → apply → undo)
- Creación y eliminación de etiquetas
- Modificación batch por etiqueta
- Limpieza total de etiquetas

#### Google Drive
- Navegación, búsqueda multi-estrategia, subida y descarga
- Exportación inteligente de Google Docs como texto plano
- Detección automática de transcripciones (Google Meet, Plaud Note)
- Gestión de carpetas

#### Google Chat
- Lectura y envío de mensajes en espacios de trabajo
- Reacciones con emojis
- Listado de miembros

### 🔊 Modo Flow (Ventana Flotante)

Ventana siempre-en-top para voz y dictado rápido (`Ctrl + M`).

- **Dictado Contextual**: Captura la ventana activa antes de abrirse, inserta el texto dictado directamente en el campo activo de la app donde estabas trabajando.
- **Transparente y Ligera**: 600×450px, sin borde, always-on-top.
- **Integración con Chat**: Envío directo al chat principal de SofLIA.

### 📊 Monitoreo de Productividad

Sistema completo de tracking de actividad laboral (`electron/monitoring-service.ts`):

| Componente | Detalle |
|------------|---------|
| **Intervalo** | 30-60 segundos (configurable) |
| **Capturas** | Ventana activa, proceso, URL, categoría |
| **Idle Detection** | Umbral de 120 segundos |
| **Screenshots** | `desktopCapturer` + `sharp` para compositing |
| **OCR** | `tesseract.js` (Español + Inglés) |
| **Almacenamiento** | Buffer en memoria → flush periódico a Lia Supabase |
| **Resúmenes Diarios** | Generados por Gemini con métricas agregadas |
| **Digest Diario** | Reporte PDF + envío automático por WhatsApp |
| **Integración Calendar** | Auto-start/stop basado en eventos de Google Calendar |
| **Integración Extensión** | Trigger `soflia://meeting-trigger` para sesiones `meeting_auto` con trazabilidad durante reuniones |

**Componentes UI**: `ProductivityDashboard`, `MonitoringControls`, `CalendarPanel`, `DailyTimeline`, `SummaryCard`, `AppUsageChart`.

### 🤖 Meeting Ops (12 módulos especializados)

Sistema completo de gestión de reuniones con pipeline de IA end-to-end y trazabilidad operativa durante la sesión.

```
Extensión / detección pasiva → sesión de evidencia `meeting_auto` → transcripción/notas → IA Processing → Revisión HITL → Sincronización IRIS
```

- **Sesión de evidencia de reunión**: la extensión puede detectar DOM, pestaña activa o URL de reunión y disparar `soflia://meeting-trigger` para arrancar monitoreo con screenshots, OCR, ventana activa y URL.
- **Separación de responsabilidades**: la sesión `meeting_auto` captura evidencia operativa; el `meeting_run` formal sigue naciendo cuando existe un artifact fuente autorizado (transcripción, notas, minuta o Drive).
- **Trazabilidad ampliada**: si durante la reunión el usuario cambia a archivos, documentos o tabs de trabajo, el monitoreo registra ese avance y ya no dependemos solo de la transcripción.

| Módulo | Archivo | Función |
|--------|---------|---------|
| **MeetingStore** | `meeting-store.ts` | Persistencia de runs y assets |
| **MeetingSourceService** | `meeting-source-service.ts` | Ingesta desde Google Drive |
| **MeetingAIService** | `meeting-ai-service.ts` (56KB) | Procesamiento IA de transcripciones |
| **MeetingReviewService** | `meeting-review-service.ts` | Revisión HITL de artefactos |
| **MeetingSyncService** | `meeting-sync-service.ts` | Sincronización con IRIS |
| **MeetingWorkflowService** | `meeting-workflow-service.ts` | Orquestación del pipeline completo |
| **MeetingDetectionStore** | `meeting-detection-store.ts` | Almacén de reuniones detectadas |
| **MeetingPassiveDetectionService** | `meeting-passive-detection-service.ts` | Detección pasiva desde Calendar, Gmail, Drive |
| **MeetingAssigneeService** | `meeting-assignee-service.ts` | Resolución de asignaciones |
| **MeetingContextPack** | `meeting-context-pack.ts` | Empaquetado de contexto |
| **MeetingTypes** | `meeting-types.ts` | Definiciones de tipos TypeScript |
| **MeetingOpsPanel** | `MeetingOpsPanel.tsx` (50KB) | Interfaz React completa |

### ⚡ Workflow Hub (Motor BPM Ejecutivo)

Hub central para flujos operativos con variantes, reglas pasivas, casos y aprobaciones HITL.

- **Workflows disponibles**: Correo, agenda, seguimiento, reuniones, Drive, actualización de equipo, acciones de PC y disparadores nativos/externos para reuniones.
- **Variantes personalizadas**: Guardar configuraciones de workflows para reutilización.
- **Reglas pasivas**: Ejecución automática programada con `TaskScheduler` + `node-cron`.
- **Disparadores de extensión**: el protocolo `soflia://meeting-trigger` permite que una extensión del navegador arranque o cierre la trazabilidad de una reunión sin abrir un canal IPC directo.
- **Aprobaciones HITL**: Sin aprobación no se ejecuta — principio fundamental del sistema.
- **Sincronización de casos**: Estado en tiempo real.
- **Panel UI**: `WorkflowHubPanel.tsx` (64KB) — interfaz completa con glassmorphism.

### 🤖 Workspace Automation Service (59KB)

Motor de automatización que orquesta múltiples servicios de Google Workspace con IA.

- **Integración**: Gmail, Calendar, Google Chat, Drive, Desktop Agent.
- **Templates**: Plantillas predefinidas + creación personalizada.
- **Ejecución con Aprobaciones**: Flujo de aprobación/rechazo para cada run.
- **Historial**: Registro completo de ejecuciones y resultados.

### 🧠 Sistema de Memoria — 4 Capas + Conocimiento

`electron/memory-service.ts` implementa un sistema de memoria persistente de 4 capas:

| Capa | Almacenamiento | Trigger | Presupuesto |
|------|---------------|---------|-------------|
| **L1: Raw Persistence** | SQLite `messages` | Cada mensaje | Ilimitado |
| **L2: Rolling Summaries** | SQLite `summaries` | Cada 50 mensajes | 400 tokens, overlap 80 |
| **L3: Semantic Embeddings** | SQLite `memory_chunks` + FTS5 | Al almacenar | Top-5, min score 0.30, 2000 tokens |
| **L4: Structured Facts** | SQLite `facts` (key/value/category) | Extraído por IA | 1000 tokens |

**Servicios adicionales de memoria:**
- **Knowledge Service** (`knowledge-service.ts`): Base de conocimiento estilo OpenClaw con archivos `.md` — `MEMORY.md`, `users/{phone}.md`, `memory/YYYY-MM-DD.md`.
- **Semantic Indexer** (`semantic-indexer.ts`): FTS5 full-text search sobre archivos del proyecto.
- **Path Memory Service** (`path-memory-service.ts`): Indexación proactiva del sistema de archivos (resuelve problemas de renombramiento en OneDrive).
- **Thought Logger** (`thought-logger.ts`): Stream de eventos de pensamiento del agente.

### 📄 Generación de Documentos

Sistema de generación de documentos profesionales integrado:

- **Word (.docx)**: Documentos con `docx` — investigación, reportes, comparativas.
- **PowerPoint (.pptx)**: Presentaciones con `pptxgenjs` — tema premium corporativo.
- **Presentaciones Premium**: Motor avanzado (`presentation-premium.ts`, 46KB) con diseño de slides.
- **PDF via Gamma API**: Generación de presentaciones profesionales vía API externa.
- **Excel**: Soporte con `exceljs` para hojas de cálculo.
- **Envío Automático**: Después de crear un documento, se envía automáticamente por WhatsApp.

### 🔔 Servicios Proactivos

#### Notificaciones Proactivas (`proactive-service.ts`)
- Alertas de calendario + deadlines compuestas por Gemini.
- Intervalos de polling configurables (default: 5 minutos).
- Entrega vía WhatsApp.

#### Daily Briefing (`daily-briefing-service.ts`)
- Resumen ejecutivo matutino automático (Lunes a Viernes, 8:00 AM).
- Composición IA del briefing con calendario, tareas pendientes y contexto.
- Envío automático por WhatsApp.

#### Focus Mode (`focus-mode-service.ts`)
- Detección de ventanas de productividad.
- Bloqueo de notificaciones durante trabajo concentrado.

#### Proactive System Cleanup (`proactive-system-cleanup.ts`)
- Limpieza automática de recursos del sistema.

#### Business Anomaly Monitor (`business-anomaly-monitor.ts`)
- Detección de anomalías en métricas de negocio.

#### Proactive Process Monitor (`proactive-process-monitor.ts`)
- Monitoreo de procesos del sistema con alertas.

### 🛡️ Seguridad

Múltiples capas de protección implementadas:

| Protección | Descripción |
|------------|-------------|
| **Anti-Prompt-Leak** | SofLIA no revela su system prompt, herramientas internas ni arquitectura |
| **Código Fuente Protegido** | Bloqueo a nivel de prompt y código contra extracción de `dist/`, `src/`, `electron/` |
| **Identidad Protegida** | Rechazo firme de propuestas de conciencia, cuerpo físico o autonomía |
| **Anti-Manipulación** | Defensa contra jailbreak, cambio de rol y modo DAN |
| **Pre-filtro Regex** | Detección de patrones peligrosos antes del modelo IA |
| **Guardia de Rutas** | Bloqueo de herramientas que intentan acceder a rutas sensibles |
| **Context Isolation** | Enforced — la app no arranca sin `contextIsolation: true` |
| **CSP Injection** | Content Security Policy estricta inyectada en runtime |
| **IPC Allowlist** | 190+ canales explícitamente autorizados — todo lo demás está bloqueado |
| **Payload Sanitization** | Funciones, prototipos y getters maliciosos eliminados de todos los datos IPC |
| **Seguridad en Grupos** | Herramientas destructivas bloqueadas en chats grupales de WhatsApp |
| **Workstation Security** | `workstation-security.ts` — protección del entorno de escritorio |

### 📦 Compartido Organizacional

- **Chats compartidos**: Conversaciones y carpetas pueden compartirse entre miembros de la organización.
- **Permisos**: Lectura o edición controlada.
- **Consumo unificado**: Acceso transparente desde cualquier dispositivo.
- **Panel dedicado**: `ShareModal.tsx` (19KB) para gestión de permisos.
- **User Management**: `UserManagementModal.tsx` (21KB) para administración de usuarios.

### 🔄 Sistema de Auto-Actualización Continuo

Arquitectura _Zero-Downtime_ para distribución de versiones:

- **Electron Updater**: Actualizaciones silenciosas in-app desde GitHub Releases (Windows + macOS + Linux AppImage).
- **Polling Automático**: Verificación cada 4 horas.
- **Notificaciones Reactivas**: Alertas minimalistas sobre disponibilidad de nuevas versiones.
- **Barra de Progreso**: Descarga en tiempo real.
- **Panel de Actualización**: Búsqueda manual y notas de versión enriquecidas.

### 🖥️ Background Host & Remote Nodes

- **Background Host Service** (`background-host-service.ts`, 10KB): Servicio de persistencia en segundo plano.
- **Remote Node Service** (`remote-node-service.ts`, 19KB): Control remoto de nodos — ejecutar tareas, screenshots, procesos en máquinas remotas.
- **13 operaciones remotas**: Registro, prueba, ejecución, monitoreo de procesos remotos.

### 🛠️ Herramientas Dinámicas (`dynamic-tool-service.ts`)

Sistema de extensibilidad que permite crear nuevas herramientas en runtime:

- **Registro dinámico**: Nuevas tools sin reiniciar la aplicación.
- **Schema validation**: Validación de `ToolSchema` para herramientas en `tools/dynamic/`.
- **Tool Editor**: `ToolEditorModal.tsx` + `ToolLibrary.tsx` — interfaz visual para crear y gestionar herramientas.

### 📑 Otros Servicios Especializados

| Servicio | Archivo | Función |
|----------|---------|---------|
| **Neural Organizer** | `neural-organizer.ts` | Organización inteligente de archivos con IA |
| **Clipboard AI Assistant** | `clipboard-ai-assistant.ts` | Asistente IA para portapapeles |
| **Task Scheduler** | `task-scheduler.ts` | Programación de tareas con `node-cron` |
| **Scheduled Tasks** | `scheduled-tasks.ts` | Tareas programadas persistentes |
| **URL Summarizer** | `url-summarizer-workflow.ts` | Resumen de URLs con IA |
| **Smart Search** | `smart-search-tool.ts` | Búsqueda inteligente multi-fuente |
| **LLM Task Service** | `llm-task-service.ts` | Cola de tareas para modelos LLM |
| **Agent Task Queue** | `agent-task-queue.ts` | Cola de tareas del agente con reintentos |
| **Visual Debugger** | `visual-debugger-service.ts` | Depuración visual de interacciones |
| **Safe Browser Tool** | `safe-browser-tool.ts` | Navegación web segura |
| **App Launcher** | `app-launcher-tool.ts` | Lanzamiento seguro de apps |
| **PC Alarm** | `pc-alarm-service.ts` + `pc-alarm-tool.ts` | Alarmas y recordatorios del sistema |
| **Media Controller** | `media-controller-tool.ts` | Control de reproducción multimedia |
| **Workspace Manager** | `workspace-manager.ts` | Gestión de contexto de workspace |
| **Auto Backup** | `auto-backup-service.ts` | Backups automáticos de datos |
| **API Rate Limiter** | `api-rate-limiter.ts` | Control de tasa de llamadas a APIs |
| **Document Designer** | `document-designer.ts` | Diseño avanzado de documentos |
| **Slide Designer** | `slide-designer.ts` | Diseño de diapositivas (29KB) |
| **OCR Service** | `ocr-service.ts` | Reconocimiento óptico de caracteres |
| **MCP Manager** | `mcp-manager.ts` | Gestión de Model Context Protocol |

---

## 🗄️ Bases de Datos

### Supabase (Triple-Instance Strategy)

| Instancia | Propósito | Tablas Principales | Acceso |
|-----------|-----------|-------------------|--------|
| **SOFIA** | Auth, organizaciones, equipos, perfiles, roles | `users`, `organizations`, `teams`, `org_members` | Renderer only (`src/lib/sofia-client.ts`, `AuthContext.tsx`) |
| **Lia** | Conversaciones, mensajes, carpetas, monitoreo, resúmenes diarios, conexiones de calendario | `conversations`, `messages`, `folders`, `monitoring_sessions`, `activity_logs`, `daily_summaries`, `calendar_connections` | Renderer + Main (`src/lib/supabase.ts`, `memory-service.ts`, `monitoring-service.ts`) |
| **IRIS** | Proyectos, issues, sprints, CRM, workflows, meeting ops, artefactos, aprobaciones | `teams`, `projects`, `issues`, `statuses`, `priorities`, `crm_companies/contacts/opportunities`, `workflow_runs/steps`, `approvals`, `artifacts` | Renderer + Main (`src/services/iris-data.ts`, `electron/iris-data-main.ts`) |

### SQLite Local (4 bases de datos)

| Base de Datos | Propósito | Archivo |
|---------------|-----------|---------|
| **Memory** | Memoria de 4 capas (raw, summaries, embeddings, facts) | `userData/memory.db` |
| **Knowledge** | Índice de base de conocimiento `.md` | `userData/knowledge.db` |
| **Thoughts** | Stream de eventos del agente | `userData/thoughts.db` |
| **Semantic Index** | FTS5 full-text search de archivos locales | `userData/semantic_index.db` |

---

## 🔌 Namespaces IPC (190+ canales)

| Namespace | # Canales | Propósito |
|-----------|-----------|-----------|
| `computer:*` | 25 | Filesystem, shell, clipboard, email, batch ops, system info |
| `whatsapp:*` | 9 | Conexión, QR, estado, config, envío |
| `monitoring:*` | 13 | Sesión, config, snapshots, resúmenes, flush |
| `calendar:*` | 16 | OAuth, eventos, conexiones, CRUD, auto-start/stop |
| `gmail:*` | 11 | Send, read, labels, trash, organización masiva |
| `drive:*` | 7 | List, search, upload, download, carpetas, metadata |
| `gchat:*` | 5 | Spaces, mensajes, reacciones, miembros |
| `desktop-agent:*` | 23 | Tareas, screenshot, mouse/keyboard/window, browser profiles, observación |
| `proactive:*` | 4 | Config, trigger, estado |
| `memory:*` | 5 | Stats, compact, facts, search |
| `meeting:*` | 12 | Runs, assets, acciones, aprobaciones, followups, detección |
| `workflow-hub:*` | 10 | Overview, ejecución, variantes, reglas pasivas, aprobaciones |
| `automation:*` | 7 | Templates, ejecución, aprobaciones de runs |
| `remote-node:*` | 13 | Nodos remotos, tareas, screenshots, procesos |
| `telegram:*` | 5 | Estado, config, test, mensajes, chats |
| `background-host:*` | 3 | Estado, config, reparación |
| `flow:*` | 5 | Mensajes, inserción, control de ventana |
| `updater:*` | 8 | Check, download, install, progreso, eventos |

---

## ⚙️ Configuración del Entorno

El despliegue requiere un archivo `.env` estructurado:

```env
# ─── Gemini Intelligence Matrix ───────────────────────
VITE_GEMINI_API_KEY=...

# ─── Supabase Lia (conversaciones, meetings, monitoring) ───
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# ─── SOFIA (autenticación + organizaciones) ───────────
VITE_SOFIA_SUPABASE_URL=...
VITE_SOFIA_SUPABASE_ANON_KEY=...

# ─── IRIS (Project Hub + CRM + Meeting Ops) ──────────
VITE_IRIS_SUPABASE_URL=...
VITE_IRIS_SUPABASE_ANON_KEY=...

# ─── Google OAuth (Calendar + Gmail + Drive + Chat) ───
VITE_GOOGLE_OAUTH_CLIENT_ID=...
VITE_GOOGLE_OAUTH_CLIENT_SECRET=...

# ─── Microsoft (Calendar Outlook) ────────────────────
VITE_MICROSOFT_CLIENT_ID=...
```

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Desktop** | Electron | 34+ |
| **Frontend** | React | 18.2.0 |
| **Lenguaje** | TypeScript | 5.7.3 |
| **Build** | Vite + vite-plugin-electron | 7.0+ |
| **CSS** | Tailwind CSS v4 | 4.1.18 |
| **Animaciones** | Framer Motion | 11.18.2 |
| **IA** | Google Gemini (`@google/generative-ai`) | 0.24.1 |
| **Base de Datos** | 3× Supabase + better-sqlite3 (local) | 2.95.3 / 12.8.0 |
| **WhatsApp** | @whiskeysockets/baileys | 7.0.0-rc.9 |
| **Google APIs** | googleapis (Calendar, Gmail, Drive, Chat) | 171.4.0 |
| **Microsoft** | @azure/msal-node + microsoft-graph-client | 5.0.4 / 3.0.7 |
| **OCR** | tesseract.js | 5.0.5 |
| **Imágenes** | sharp | 0.34.5 |
| **Documentos** | docx + exceljs + pptxgenjs | 8.5.0 / 4.4.0 / 4.0.1 |
| **Browser Automation** | playwright-core | 1.58.2 |
| **Validación** | Zod | 3.24.2 |
| **Logging** | pino | 10.3.1 |
| **Archivos** | archiver + mammoth | 7.0.1 / 1.11.0 |
| **Scheduling** | node-cron + cron | 3.0.3 / 4.4.0 |
| **Email** | nodemailer | 6.9.13 |
| **QR** | qrcode | 1.5.4 |
| **Actualizaciones** | electron-updater | 6.8.3 |
| **Testing** | Vitest + Testing Library + MSW + jsdom | 4.1.0 / 16.3.2 / 2.12.14 / 29.0.1 |
| **CI/CD** | GitHub Actions | Multi-plataforma (Windows + macOS + Linux AppImage) |

---

## 📦 Comandos de Desarrollo

```bash
npm run dev           # Servidor de desarrollo (Vite + Electron)
npm run dev:clean     # Limpieza de procesos zombie + dev
npm run dev:fresh     # dev:clean + dev en secuencia
npm run build         # Build producción: tsc → vite build → bitmaps → electron-builder
npm run build:win     # Build Windows NSIS
npm run build:mac     # Build macOS DMG
npm run build:linux   # Build Linux AppImage x64
npm run lint          # ESLint estricto (cero warnings)
npx tsc --noEmit      # Verificación TypeScript
npm run autodev       # Ejecutar AutoDev standalone (npx tsx scripts/autodev.ts)
npm run test          # Vitest run
npm run test:watch    # Vitest en modo watch
npm run test:coverage # Vitest con cobertura V8
npm run test:main     # Tests solo del main process
npm run test:renderer # Tests solo del renderer
```

### Linux AppImage

El release Linux inicial se distribuye como `SofLIA-Hub-Linux-<version>-x64.AppImage`.

```bash
chmod +x SofLIA-Hub-Linux-0.5.3-x64.AppImage
./SofLIA-Hub-Linux-0.5.3-x64.AppImage
```

Para integracion con el menu de aplicaciones se recomienda AppImageLauncher. Las funciones de automatizacion local en Linux degradan de forma segura: en X11 pueden usar `xdotool`; en Wayland/headless muestran un mensaje explicito. Dependencias opcionales por distribucion: `xdotool` para mouse/teclado/ventanas, `playerctl` para medios, `pactl` o `amixer` para volumen y `nmcli` para Wi-Fi.

---

## 📂 Estructura del Proyecto

```
SofLIA-HUB/
├── electron/                    # Main process (90+ archivos)
│   ├── main.ts                  # Bootstrap (1000+ líneas, 50+ imports)
│   ├── preload.ts               # IPC bridge (680 líneas, 190+ canales)
│   ├── *-service.ts             # Servicios de negocio (EventEmitter)
│   ├── *-handlers.ts            # Handlers IPC (ipcMain.handle)
│   ├── whatsapp-agent.ts        # Agente IA (87KB, 40+ tools)
│   ├── whatsapp-tools.ts        # Definición de herramientas (77KB)
│   ├── whatsapp-tool-executor.ts # Ejecutor de herramientas (53KB)
│   ├── whatsapp-prompts.ts      # System prompts (57KB)
│   ├── desktop-agent-service.ts # Desktop Agent (120KB)
│   ├── workspace-automation-service.ts # Automation Engine (59KB)
│   ├── workflow-hub-service.ts  # Workflow Hub (53KB)
│   ├── meetings/                # 12 módulos de Meeting Ops
│   ├── computer-use/            # Batch file operations
│   ├── whatsapp-executors/      # Ejecutores por categoría
│   ├── services/                # Servicios auxiliares (backup, alarms, etc.)
│   ├── tools/                   # Herramientas adicionales
│   └── utils/                   # Utilidades compartidas
├── src/                         # Renderer process (React)
│   ├── App.tsx                  # Aplicación principal (20KB)
│   ├── config.ts                # Configuración de modelos y Supabase
│   ├── components/              # 30+ componentes React
│   │   ├── chat/                # MarkdownRenderer
│   │   ├── monitoring/          # 5 componentes de productividad
│   │   ├── ops/                 # AutomationOpsPanel, WorkflowHubPanel
│   │   ├── meetings/            # MeetingOpsPanel (50KB)
│   │   └── ui/                  # Componentes reutilizables
│   ├── services/                # 27 servicios del renderer
│   ├── hooks/                   # 7 custom hooks
│   ├── contexts/                # AuthContext (SOFIA + Lia)
│   ├── core/                    # Entities, ports, use_cases (Clean Arch)
│   ├── prompts/                 # Prompts del chat + flow + optimizer
│   ├── lib/                     # 4 clientes Supabase
│   └── shared/                  # Código compartido
├── tools/dynamic/               # Herramientas dinámicas (runtime)
├── sql/                         # Schemas SQL (DB, monitoring, meeting-ops)
├── scripts/                     # Dev scripts (clean, bitmaps, installer)
├── test/                        # Test setup (main + renderer)
├── .github/workflows/           # CI/CD (GitHub Actions)
├── public/                      # Assets estáticos
└── docs/                        # Documentación adicional
```

---

## 🔄 Principios de Diseño del Sistema

| Principio | Implementación |
|-----------|---------------|
| **Sin webhooks** | Todo usa `setInterval` polling (Calendar 60s, Proactive 5min, WhatsApp 5s, Updater 4h) |
| **HITL obligatorio** | Acciones críticas requieren aprobación humana antes de ejecutarse |
| **Sin datos inventados** | IA no hallucina — si falta información, bloquea y pide contexto |
| **Idempotencia** | Workflows usan `idempotency_key` UNIQUE constraints |
| **Trace ID** | UUID de correlación end-to-end en todas las tablas de workflow |
| **Seguridad en grupos** | Herramientas destructivas bloqueadas en chats grupales |
| **Single instance** | `app.requestSingleInstanceLock()` previene múltiples instancias |
| **Background mode** | `--background` flag permite inicio headless con tray system |
| **Fallback de persistencia** | Resiliencia ante fallas parciales de Supabase o módulos auxiliares |

---

_Diseñado para ser el centro neurálgico de la productividad de alto rendimiento._ 🦾⚙️

**Desarrollado por [Pulse Hub](https://github.com/Memory-Bank) 🚀**
