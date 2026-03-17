# SofLIA Hub — Explicación Detallada del Sistema

## ¿Qué es SofLIA Hub?

SofLIA Hub es una aplicación de escritorio construida con Electron que funciona como una plataforma de operaciones empresariales potenciada por inteligencia artificial. Combina múltiples herramientas en una sola aplicación: un asistente de IA conversacional, un agente de WhatsApp autónomo, integración con Google Workspace, monitoreo de productividad, gestión de proyectos, CRM y un motor de workflows automatizados.

---

## Arquitectura General

La aplicación tiene dos capas principales que se comunican entre sí:

### 1. Main Process (Node.js — Backend local)
Es el "cerebro" de la aplicación. Corre en Node.js dentro de Electron y tiene acceso completo al sistema operativo. Aquí viven todos los servicios pesados:

- **WhatsApp Service** — Conexión directa a WhatsApp Web via Baileys (sin API oficial, usa el protocolo directo). Maneja QR login, envío/recepción de mensajes, y el agente autónomo que responde con IA.
- **Calendar Service** — Se conecta a Google Calendar y Microsoft Outlook via OAuth2. Monitorea eventos cada 60 segundos y puede crear/modificar reuniones.
- **Gmail Service** — Lee y envía correos via Gmail API.
- **Drive Service** — Accede a Google Drive para listar, subir y descargar archivos. Incluye un "Transcript Watcher" que detecta automáticamente transcripciones de reuniones (Google Meet, Plaud Note) cada 2 minutos.
- **Google Chat Service** — Envía y lee mensajes de Google Chat (spaces).
- **Monitoring Service** — Captura screenshots del escritorio, detecta la ventana activa, mide tiempo idle, y usa OCR (Tesseract.js) para extraer texto de las capturas.
- **Proactive Service** — Envía recordatorios automáticos via WhatsApp sobre reuniones próximas y deadlines. Hace polling cada 5 minutos.
- **Memory Service** — Sistema de memoria persistente con 4 capas: datos raw en SQLite, resúmenes rolling, embeddings para búsqueda semántica, y facts extraídos.
- **Knowledge Service** — Base de conocimiento basada en archivos Markdown que el asistente puede consultar.
- **Workflow Engine** — Motor de workflows BPM-lite con máquina de estados. Soporta pasos automáticos y pasos que requieren aprobación humana (HITL).
- **CRM Service** — Gestión de empresas, contactos y oportunidades con deduplicación automática (algoritmo Jaccard).
- **AutoDev Service** — Sistema multi-agente que puede auto-programar mejoras al propio SofLIA Hub (ver sección dedicada abajo).
- **Updater Service** — Sistema de auto-actualización via electron-updater que detecta nuevas versiones cada 4 horas desde GitHub Releases.

### 2. Renderer Process (React — Frontend)
Es la interfaz gráfica que ve el usuario. Construida con React 18, TypeScript y Tailwind CSS v4. Se comunica con el Main Process exclusivamente via IPC (Inter-Process Communication).

**Componentes principales:**
- **Chat** — Interfaz de conversación con el asistente IA (Google Gemini). Soporta texto, imágenes, y herramientas (tool calling).
- **Project Hub (IRIS)** — Gestión de proyectos con issues, sprints y tablero Kanban.
- **CRM** — Vista de empresas, contactos y pipeline de oportunidades.
- **Productivity Dashboard** — Métricas de productividad, timeline de actividad, y resúmenes generados por IA.
- **WhatsApp Setup** — Configuración del agente de WhatsApp (QR, números permitidos, política de grupos).
- **Settings Modal** — Configuración unificada con pestañas: Personalización, WhatsApp, Miembros, AutoDev, Pantalla, Productividad, Actualización.
- **Flow Mode** — Ventana flotante mini (Ctrl+M) para acceso rápido al chat sin abrir la app completa.
- **Update Notification** — Toast reactivo que aparece cuando hay una nueva versión disponible.

---

## Comunicación IPC (Inter-Process Communication)

La comunicación entre el frontend y el backend sigue un patrón estricto de seguridad:

```
Renderer (React)                    Main Process (Node.js)
─────────────────                   ──────────────────────
src/services/*-service.ts    →      electron/preload.ts    →    electron/*-handlers.ts    →    electron/*-service.ts
(wrapper tipado)                    (contextBridge +            (ipcMain.handle)               (lógica de negocio)
                                     canal allowlist)
```

1. **Service files** (`electron/*-service.ts`) — Contienen la lógica de negocio real.
2. **Handler files** (`electron/*-handlers.ts`) — Registran los `ipcMain.handle()` que escuchan peticiones del renderer.
3. **Preload** (`electron/preload.ts`) — Puente seguro que expone APIs al renderer via `contextBridge.exposeInMainWorld()`. Tiene una lista blanca (`ALLOWED_IPC_CHANNELS`) de canales permitidos.
4. **Renderer services** (`src/services/*-service.ts`) — Wrappers tipados que el React usa para llamar al main process.

**Seguridad:** Todos los canales IPC pasan por la allowlist. Hay sanitización de payloads y Content Security Policy (CSP) inyectada en todas las páginas.

---

## Base de Datos

SofLIA Hub usa **3 instancias de Supabase** (PostgreSQL en la nube) + **SQLite local**:

### Supabase SOFIA
- Autenticación de usuarios (login, registro, sesiones)
- Organizaciones y equipos
- Perfiles de usuario y configuraciones

### Supabase Lia
- Conversaciones y mensajes del chat
- Carpetas para organizar conversaciones
- Sesiones de monitoreo de productividad
- Snapshots de actividad (capturas, window info, OCR)
- Resúmenes diarios generados por IA

### Supabase IRIS
- Proyectos, issues y sprints
- CRM: empresas, contactos, oportunidades
- Workflows: definiciones, runs, steps, artefactos
- Aprobaciones HITL
- Datos accedidos tanto desde renderer como desde main process (cada uno con su propio cliente Supabase)

### SQLite Local
- Sistema de memoria del asistente (hechos, resúmenes, embeddings)
- Base de conocimiento
- Datos que necesitan acceso offline rápido

---

## Inteligencia Artificial (Google Gemini)

Toda la IA usa modelos de Google Gemini, configurados en `src/config.ts`:

| Modelo | Uso |
|--------|-----|
| **gemini-3-flash-preview** | Chat principal, agente WhatsApp, extracción de workflows |
| **gemini-3-pro-preview** | Generación compleja (propuestas detalladas, análisis profundo) |
| **gemini-2.5-flash** | Fallback cuando los modelos principales fallan |
| **gemini-2.5-flash-native-audio-preview** | Audio bidireccional (Live API) |
| **gemini-2.5-flash-image** | Generación de imágenes |
| **deep-research-pro-preview** | Investigación profunda |

### Tool Calling (Herramientas del Chat)

El asistente de chat puede ejecutar acciones reales via "tool calling" de Gemini. Cuando el usuario pide algo como "agenda una reunión mañana a las 10", Gemini genera una llamada a la herramienta `create_calendar_event` que el sistema ejecuta automáticamente.

Herramientas disponibles:
- **Google Calendar** — Ver, crear, modificar, eliminar eventos
- **Gmail** — Leer inbox, enviar correos, buscar
- **Google Drive** — Listar archivos, subir, descargar, crear carpetas
- **Google Chat** — Enviar mensajes a spaces
- **Monitoreo** — Iniciar/detener sesiones de productividad
- **IRIS** — Crear proyectos, issues, sprints
- **CRM** — Gestionar empresas, contactos, oportunidades
- **Workflows** — Iniciar y gestionar workflows

### Lógica de Fallback

Todos los servicios de IA implementan un patrón de fallback:
1. Intenta con el modelo primario
2. Si falla → intenta con el modelo fallback
3. Si también falla → retorna error al usuario

### Structured Output

Todas las respuestas de IA usan `responseMimeType: 'application/json'` para obtener JSON estructurado predecible en lugar de texto libre.

---

## Agente de WhatsApp

El agente de WhatsApp es un sistema autónomo que:

1. Se conecta a WhatsApp Web via Baileys (protocolo directo, sin API oficial)
2. Recibe mensajes de los contactos permitidos
3. Procesa cada mensaje con Gemini (tool calling incluido)
4. Responde automáticamente
5. Puede ejecutar acciones: agendar reuniones, enviar correos, buscar en Drive, etc.

**Configuración de seguridad:**
- Lista de números permitidos (allowlist)
- Política de grupos: abierto, filtro (allowlist de grupos), o deshabilitado
- Activación en grupos: solo al mencionarlo o siempre
- Prefijo configurable para grupos (ej: `/soflia`)

**Workflows especializados:**
- **Presentaciones** — Genera presentaciones automáticas usando la API de Gamma
- **Reuniones** — Adapta el motor de workflows para gestionar reuniones via WhatsApp

---

## Monitoreo de Productividad

Sistema completo de tracking de actividad:

1. **Captura** — Toma screenshots del escritorio a intervalos regulares
2. **Window Tracking** — Detecta qué aplicación está activa (título de ventana)
3. **Idle Detection** — Mide tiempo inactivo del usuario
4. **OCR** — Extrae texto de las capturas usando Tesseract.js
5. **Timeline** — Genera una línea de tiempo visual de la actividad
6. **App Stats** — Estadísticas de uso por aplicación (tiempo en cada app)
7. **Resúmenes IA** — Al final de cada sesión, Gemini genera un resumen de lo que hizo el usuario

**Persistencia:**
- Los snapshots se guardan en Supabase Lia cada 2 capturas (flush rápido)
- Si hay error de red, hay retry automático con backoff
- El dashboard se refresca cada 15 segundos durante monitoreo activo

**Auto-monitoreo por calendario:**
- Si hay un evento de Google Calendar en curso, el monitoreo se inicia automáticamente
- Se detiene cuando el evento termina

---

## AutoDev — Sistema de Auto-Programación

AutoDev es un sistema multi-agente que puede modificar el propio código de SofLIA Hub autónomamente. Tiene 3 modos:

### Modo 1: Scheduled (Programado)
- Se ejecuta diariamente a las 3 AM (configurable)
- Pipeline completo de 8 agentes: investigación (5 agentes) → análisis → planificación → codificación → revisión → testing → commit/PR
- Puede modificar hasta 30 archivos y 500+ líneas
- Límite: 3 ejecuciones diarias

### Modo 2: Manual
- El usuario lo ejecuta desde el UI o via WhatsApp
- Mismo pipeline de 8 agentes
- Se ejecuta en un proceso terminal separado para no bloquear la UI

### Modo 3: Micro-Fix (Reactivo)
- Se activa automáticamente cuando detecta quejas del usuario ("no funciona X") o sugerencias ("deberías poder...")
- Pipeline ligero de 4 fases: análisis → codificación → verificación de build → commit/PR
- Máximo 5 archivos y 200 líneas
- Debounce de 3 minutos para agrupar issues relacionados
- Límite: 5 micro-fixes diarios

**Self-Learn Service:**
- Analiza mensajes del usuario buscando patrones de queja o sugerencia
- Clasifica si el problema es micro-fixable o necesita un full run
- Registra issues en `AUTODEV_ISSUES.md`
- Emite eventos que activan el micro-fix pipeline

---

## Sistema de Actualización Automática

### Flujo completo:

```
Desarrollador hace push a main
       ↓
GitHub Actions detecta el push
       ↓
Build en paralelo: Windows (.exe) + Mac (.dmg)
       ↓
Se crea un Release en DevOps-043/PulseHub-SofLIA-releases
con los instaladores + latest.yml + blockmap
       ↓
La app instalada del usuario hace polling cada 4 horas
       ↓
electron-updater compara versión local vs latest.yml del release
       ↓
Si hay nueva versión → notificación toast in-app
       ↓
Usuario decide: "Actualizar ahora" o "Más tarde"
       ↓
Si acepta → descarga en background con barra de progreso
       ↓
Descarga completa → "Reiniciar para actualizar"
       ↓
La app se cierra, instala la actualización, y se reabre
```

### Componentes:
- **UpdaterService** (`electron/updater-service.ts`) — Servicio en main process que maneja electron-updater
- **UpdateNotification** (`src/components/UpdateNotification.tsx`) — Toast reactivo estilo VS Code
- **UpdatePanel** (`src/components/UpdatePanel.tsx`) — Panel en Configuración para buscar actualizaciones manualmente

### Repositorios:
- **DevOps-043/SofLIA-HUB** (privado) — Código fuente + workflow de CI/CD
- **DevOps-043/PulseHub-SofLIA-releases** (público) — Solo los binarios compilados y latest.yml

---

## Workflows BPM-Lite

Motor de workflows con máquina de estados para automatizar procesos de negocio:

- **Definición** — Cada workflow tiene pasos definidos con condiciones y acciones
- **Ejecución** — Un "run" es una instancia de un workflow en ejecución
- **Steps** — Cada paso puede ser automático (ejecutado por IA) o HITL (requiere aprobación humana)
- **Artefactos** — Los workflows generan documentos/archivos como resultado
- **Trazabilidad** — Cada run tiene un `trace_id` UUID para correlación end-to-end
- **Idempotencia** — Las acciones usan `idempotency_key` para evitar duplicados

**Principio clave:** "Sin aprobación no se ejecuta" — Los pasos críticos siempre requieren aprobación humana antes de ejecutarse.

---

## Seguridad

- **CSP (Content Security Policy)** — Inyectada en todas las páginas para prevenir XSS
- **IPC Allowlist** — Solo los canales explícitamente listados pueden comunicarse entre procesos
- **Sanitización** — Los payloads IPC se sanitizan antes de procesarse
- **RLS (Row Level Security)** — Las bases de datos Supabase tienen políticas de seguridad a nivel de fila
- **OAuth2** — Google APIs usan OAuth2 con tokens de refresh
- **No webhooks** — Todo el monitoreo externo usa polling para evitar exponer endpoints

---

## Políticas del Sistema

1. **No webhooks** — Todo usa `setInterval` polling (Calendar: 60s, Proactive: 5min, SLA: 60s, Transcript watcher: 2min, WhatsApp queue: 5s, Updater: 4h)
2. **HITL obligatorio** — Acciones críticas en workflows requieren aprobación humana
3. **No datos inventados** — La IA no puede inventar información. Si falta contexto, bloquea y pide más datos
4. **Idempotencia** — Todas las acciones de workflow usan constraints UNIQUE para evitar ejecuciones duplicadas
5. **Trazabilidad** — UUID `trace_id` end-to-end en todas las tablas de workflows
6. **Fallback de IA** — Siempre hay un modelo alternativo si el primario falla
7. **Idioma** — Todo el UI, prompts, logs y comentarios están en español

---

## Stack Tecnológico Completo

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Desktop | Electron | 30.5.1 |
| Frontend | React | 18.2.0 |
| Lenguaje | TypeScript | 5.7.3 |
| Build | Vite + vite-plugin-electron | 5.4.21 |
| CSS | Tailwind CSS v4 | 4.1.18 |
| IA | Google Gemini (@google/generative-ai) | 0.24.1 |
| Base de datos nube | 3x Supabase (PostgreSQL) | — |
| Base de datos local | better-sqlite3 | — |
| WhatsApp | @whiskeysockets/baileys | 7.0.0-rc.9 |
| Google APIs | googleapis | 171.4.0 |
| OCR | tesseract.js | 5.1.0 |
| Actualizaciones | electron-updater | latest |
| CI/CD | GitHub Actions | — |
| Empaquetado | electron-builder | 26.8.1 |
