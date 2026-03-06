# SofLIA Hub — Desktop AI Agent ✨🧬

**SofLIA Hub** es un ecosistema de productividad empresarial de alto rendimiento construido como aplicación de escritorio con **Electron**. Centraliza el control total de tu entorno digital con una estética de ingeniería premium, fusionando inteligencia artificial (**Gemini 3 Flash / Pro**), comunicación por **WhatsApp**, gestión de proyectos en **IRIS**, Google Workspace y automatización autónoma de la computadora — todo en una sola interfaz.

> **v0.0.5** · Multiplataforma (Windows + macOS) · Auto-actualizaciones · CI/CD con GitHub Actions

---

## 💎 ADN de Diseño: Ingeniería de Cristalismo

La interfaz está construida bajo principios de **Glassmorphism Industrial** con Tailwind CSS v4:

- **Interfaz Fluida**: Transparencias profundas, desenfoques gausianos y micro-glows ambientales.
- **Tipografía de Precisión**: Headings en negrita técnica y etiquetas monoespaciadas para legibilidad superior.
- **Acentos de Energía**: Paletas curadas en _Cyan Accent_ y _Ruby Alert_ para estados de sistema críticos.
- **Micro-animaciones**: Transiciones suaves con Framer Motion para una experiencia viva y reactiva.

---

## 🚀 Módulos Operativos

### 📱 Terminal de WhatsApp (Omnipotente)

Control absoluto de tu estación de trabajo desde cualquier lugar con redundancia de seguridad.

- **Agente IA Autónomo**: Loop agentico con Gemini + 50+ herramientas (tool calling) para ejecutar cualquier tarea.
- **Ejecución Remota**: Terminal sandboxed, gestión de archivos, sistema de archivos remoto y telemetría de pantalla.
- **Procesamiento Multimodal**: Análisis de imágenes, audios, documentos (PDF, DOCX, XLSX) y transcripciones vía IA.
- **Remote Hub**: Hub de control remoto con validación Zod, sandbox de seguridad y conversión de archivos.
- **Recordatorios & Tareas Programadas**: Sistema Cron nativo para programar acciones y recordatorios vía WhatsApp.

### 🧠 Inteligencia Artificial (Multi-modelo)

Motor cognitivo centralizado con soporte multi-modelo y fallback automático.

- **Gemini 3 Flash/Pro**: Modelos primarios para chat, análisis y generación compleja.
- **Deep Research**: Investigación profunda con `deep-research-pro-preview`.
- **Audio Bidireccional**: Live API con soporte de audio nativo en tiempo real.
- **Generación de Imágenes**: Creación de imágenes con Gemini 2.5 Flash Image.
- **Prompt Optimizer**: Optimización automática de prompts para mejores resultados.

### 🖥️ Desktop Agent V2 (Agente Autónomo)

Operación directa de la interfaz gráfica de usuario (GUI) mediante visión artificial avanzada.

- **Planificación Jerárquica**: Descomposición en fases → sub-metas con criterios de éxito verificables.
- **Set-of-Mark (SoM)**: Numeración visual de elementos UI para precisión de clics.
- **Zoom Inteligente**: Inspección de zonas específicas para elementos pequeños o ambiguos.
- **Recovery Proactiva**: Auto-detección de loops, pantallas pegadas y fallbacks automáticos.
- **Visual Debugger**: Capturas con marcado de zonas de fallo, enviadas por WhatsApp para intervención humana.
- **Multi-agente**: Soporte para tareas concurrentes con historial y resúmenes intermedios.

### 📁 IRIS — Project Hub

Gestión de proyectos, issues y sprints con interfaz glassmorphism.

- **Proyectos & Issues**: Sistema Kanban con estados, prioridades y asignaciones.
- **CRM-lite**: Empresas, contactos y oportunidades de negocio con deduplicación Jaccard.
- **Workflows BPM-lite**: Motor de estados finitos con aprobaciones HITL (Human-in-the-Loop).
- **Artefactos & Aprobaciones**: Generación IA de documentos con flujo de revisión humana.

### 📧 Google Workspace Hub

Puente bidireccional completo con servicios en la nube.

- **Google Calendar**: Gestión de eventos con soporte para Microsoft Outlook simultáneo.
- **Gmail**: Lectura, envío y gestión de hilos con etiquetas.
- **Google Drive**: Navegación, subida, descarga y detección automática de transcripciones (Meet, Plaud Note).
- **Google Chat**: Lectura y envío de mensajes en espacios de trabajo.

### 📊 Monitoreo de Productividad

Dashboard de productividad con métricas en tiempo real.

- **Activity Tracking**: Screenshots, detección de ventana activa, idle time y OCR local.
- **Timeline Visual**: Visualización cronológica de actividad diaria.
- **Resúmenes IA**: Generación automática de resúmenes de productividad por sesión.
- **Calendar Panel**: Vista integrada de calendario con próximos eventos.

### 🛡️ System Guardian (Auto-Healing)

Watchdog autónomo que monitoriza la salud del sistema y ejecuta acciones correctivas.

- **Monitoreo de Disco**: Alerta y limpieza automática cuando el uso supera el 90%.
- **Monitoreo de RAM**: Detección y terminación de procesos pesados no vitales al superar 95%.
- **Notificaciones Proactivas**: Alertas vía WhatsApp cuando se detectan anomalías del sistema.

### 📂 Organizador Neuronal

Clasificación automática de archivos descargados mediante IA + OCR.

- **Auto-categorización**: Los archivos nuevos en Descargas se categorizan automáticamente (Facturas, Trabajo, Personal, Software, Otros).
- **OCR Integrado**: Extracción de texto de imágenes con Tesseract.js para categorización inteligente.
- **Notificación de Organización**: Resumen enviado por WhatsApp de cada archivo procesado.

### 🔄 AutoDev — Self-Programming System

Sistema multi-agente autónomo que mejora su propio código.

- **Modo Completo**: Pipeline de 8 agentes (research → analyzer → planner → coder → reviewer → tester → commit/PR).
- **Micro-Fix Reactivo**: Pipeline ligero de 4 fases para correcciones rápidas (<5 archivos, <200 líneas).
- **Triggers**: Programado (cron), manual (WhatsApp/UI) o automático (detección de quejas/errores).

### 🔒 Control del Workstation

Control remoto del hardware vía herramientas IA.

- **Lock Screen**: Bloqueo de pantalla multiplataforma.
- **Sleep Mode**: Suspensión del equipo.
- **Mute Volume**: Silenciar/activar volumen.
- **System Health**: Métricas en tiempo real de CPU, RAM, disco y uptime.

### 📋 Clipboard Manager

Gestión inteligente del portapapeles con historial.

- **Historial de Copias**: Últimas 20 entradas del portapapeles.
- **Sincronización IA**: Lectura y escritura del portapapeles desde el agente WhatsApp.

### 🔧 MCP Manager (Dynamic Tools)

Sistema de herramientas dinámicas hot-reload.

- **Hot-reload**: Las herramientas `.json`, `.js` o `.ts` en `tools/dynamic/` se cargan y recargan automáticamente.
- **File System Watch**: Detección de cambios en tiempo real para registrar o desregistrar herramientas.

### 🔍 Semantic Indexer

Indexación full-text de archivos locales con SQLite FTS5.

- **Indexado Automático**: Daemon periódico que indexa directorios configurados.
- **Búsqueda Semántica**: Búsqueda de texto completo con ranking de relevancia.

---

## ⚙️ Configuración del Núcleo

El despliegue requiere un entorno de variables `.env` estructurado:

```env
# Gemini Intelligence Matrix
VITE_GEMINI_API_KEY=...

# Supabase Lia (conversaciones, meetings)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# SOFIA (autenticación + organizaciones)
VITE_SOFIA_SUPABASE_URL=...
VITE_SOFIA_SUPABASE_ANON_KEY=...

# IRIS (Project Hub)
VITE_IRIS_SUPABASE_URL=...
VITE_IRIS_SUPABASE_ANON_KEY=...

# Google OAuth (Calendar + Gmail + Drive + Chat)
VITE_GOOGLE_OAUTH_CLIENT_ID=...
VITE_GOOGLE_OAUTH_CLIENT_SECRET=...
```

---

## 🛠️ Stack Tecnológico

| Capa                | Tecnología                                | Versión          |
| ------------------- | ----------------------------------------- | ---------------- |
| **Desktop**         | Electron                                  | 30.5.1           |
| **Frontend**        | React                                     | 18.2.0           |
| **Lenguaje**        | TypeScript                                | 5.7.3            |
| **Build**           | Vite + vite-plugin-electron               | 5.4.21           |
| **CSS**             | Tailwind CSS v4                           | 4.1.18           |
| **Animaciones**     | Framer Motion                             | 11.18.2          |
| **IA**              | Google Gemini (`@google/generative-ai`)   | 0.24.1           |
| **Base de Datos**   | 3x Supabase + better-sqlite3 (local)      | —                |
| **WhatsApp**        | @whiskeysockets/baileys                   | 7.0.0-rc.9       |
| **Google APIs**     | googleapis (Calendar, Gmail, Drive, Chat) | 171.4.0          |
| **OCR**             | tesseract.js                              | 5.0.5            |
| **Validación**      | Zod                                       | 3.24.2           |
| **Documentos**      | docx + exceljs                            | —                |
| **Actualizaciones** | electron-updater                          | 6.8.3            |
| **CI/CD**           | GitHub Actions                            | Multi-plataforma |

---

## 📦 Comandos de Desarrollo

```bash
npm run dev        # Servidor de desarrollo (Vite + Electron)
npm run build      # Build de producción + empaquetado
npm run lint       # ESLint (estricto, sin warnings)
npx tsc --noEmit   # Verificación TypeScript
npm run autodev    # Ejecutar AutoDev standalone
```

---

## 📐 Arquitectura

```
┌──────────────────────────────────────────────────────────────────────┐
│                    SofLIA Hub (Electron 30.5)                        │
├─────────────────────────────┬────────────────────────────────────────┤
│  Renderer (React 18)        │  Main Process (Node.js)                │
│                             │                                        │
│  src/components/ (21)       │  electron/ (56 .ts files)              │
│  src/services/ (18)         │  IPC via contextBridge + preload.ts    │
│  src/adapters/ (6)          │  Security: CSP + channel allowlist     │
│  src/core/ (Clean Arch)     │  electron/services/ (2)               │
│  src/prompts/ (4)           │                                        │
│  src/lib/ (3 Supabase)      │                                        │
├─────────────────────────────┴────────────────────────────────────────┤
│  3 Supabase Instances       │  Local SQLite (memory, knowledge,      │
│  SOFIA · Lia · IRIS         │  thoughts, semantic index)             │
│                             │  JSON config files (userData/)         │
└──────────────────────────────────────────────────────────────────────┘
```

---

_Diseñado para ser el centro neurálgico de la productividad de alto rendimiento._ 🦾⚙️

**Desarrollado por [Pulse Hub](https://github.com/Memory-Bank) 🚀**
