# SofLIA Hub Desktop — Estado del Proyecto

## Resumen
Aplicacion de escritorio (Electron + Vite + React + TypeScript + Tailwind CSS v4) que replica todas las funcionalidades de la extension de Chrome "SofLIA Extension". Usa Gemini AI para chat con streaming, dual Supabase (SOFIA para auth + Lia para datos), y sistema de carpetas/proyectos.

---

## Stack Tecnico
- **Framework**: Electron + Vite + React 18 + TypeScript
- **Estilos**: Tailwind CSS v4 (`@tailwindcss/postcss`, directiva `@theme` en `index.css`)
- **AI**: Google Gemini (`@google/generative-ai` SDK)
- **Modelo principal**: `gemini-2.5-flash-preview`
- **Base de datos**: Supabase (dos instancias)
- **Empaquetado**: electron-builder v26.7.0
- **Directorio del proyecto**: `Soflia-hub-desktop/`

---

## Arquitectura de Supabase

### SOFIA Supabase (auth + organizaciones)
- URL: `VITE_SOFIA_SUPABASE_URL`
- Auth via RPC `authenticate_user` (email/username + password)
- Tablas: users, organizations, teams, organization_users, user_profiles

### Lia Supabase (datos de la app)
- URL: `VITE_SUPABASE_URL`
- Tablas: `conversations`, `messages`, `folders`
- Auth sincronizada: cuando user se autentica en SOFIA, se hace signInWithPassword en Lia con las mismas credenciales

---

## Funcionalidades Implementadas (COMPLETADAS)

### 1. Sistema de Autenticacion
**Archivos:**
- `src/lib/supabase.ts` — Cliente Supabase Lia con localStorage adapter
- `src/lib/sofia-client.ts` — Cliente SOFIA Supabase + tipos (SofiaUser, SofiaOrganization, SofiaTeam, etc.)
- `src/services/sofia-auth.ts` — SofiaAuthService (signIn via RPC, session con TTL 24h en localStorage, signOut)
- `src/contexts/AuthContext.tsx` — AuthProvider con dual auth (SOFIA + Lia sync), useAuth hook
- `src/components/Auth.tsx` — Pantalla de login (email/username + password)

**Flujo:** Login → RPC authenticate_user en SOFIA → sync con Lia Supabase → guardar session en localStorage (24h TTL)

### 2. System Tray + Segundo Plano
**Archivos:**
- `electron/main.ts` — Tray con menu (Abrir/Salir), minimize-to-tray on close, flag `isQuitting`
- `electron/preload.ts` — contextBridge con API screenCapture
- `electron/electron-env.d.ts` — Tipos Window con screenCapture

**Comportamiento:** Al cerrar ventana se oculta al tray. Click en tray = restaurar. "Salir" = cerrar de verdad.

### 3. Captura de Pantalla
**Archivos:**
- `src/components/ScreenViewer.tsx` — Visor con auto-refresh (2s), selector de fuentes, captura manual
- IPC handlers en `electron/main.ts`: `capture-screen`, `get-screen-sources`

**Usa:** `desktopCapturer.getSources()` de Electron con thumbnails 1920x1080

### 4. Chat Completo con Streaming
**Archivos:**
- `src/prompts/chat.ts` — System prompt para LIA (personalidad profesional, analitica, español)
- `src/services/gemini-chat.ts` — Streaming con `sendMessageStream`, historial (max 50 msgs), Google Search grounding
- `src/services/chat-service.ts` — CRUD conversaciones en Supabase (load, create, save, delete, update title)
- `src/adapters/desktop_ui/ChatUI.tsx` — UI de chat con streaming progresivo, markdown renderer (headers, code blocks, listas, bold, inline code), sources como badges

**Flujo:** User escribe → placeholder msg → streaming chunks → auto-save debounce 1s → Supabase

### 5. Historial de Conversaciones
**Archivo:** `src/App.tsx`
- Sidebar con lista de conversaciones
- Nuevo chat / seleccionar / eliminar conversacion
- Auto-save con debounce 1s
- Titulo auto-generado (primeros 40 chars del primer mensaje)
- Persistir ultimo chat activo en localStorage
- Restaurar ultimo chat al abrir la app

### 6. Sistema de Carpetas/Proyectos
**Archivos:**
- `src/services/folder-service.ts` — CRUD folders (load, create, rename, delete, moveChatToFolder)
- `src/components/FolderModals.tsx` — CreateFolderModal + MoveChatModal
- `src/components/ProjectHub.tsx` — Vista de proyecto (header editable, grid de cards, nuevo chat en proyecto)
- `src/App.tsx` — Sidebar con folders colapsables, chats anidados, mover chat entre folders

**Sidebar:**
- Boton "Nuevo Chat" + "Nueva Carpeta"
- Seccion "Proyectos": folders colapsables (click=expandir, doble-click=ProjectHub)
- Chats anidados bajo cada folder
- Hover: botones mover/eliminar
- Seccion "Sin carpeta" para chats sin folder
- Vista ProjectHub: header editable + grid de conversation cards

---

## Estructura de Archivos Clave

```
Soflia-hub-desktop/
├── .env                              # API keys y Supabase credentials
├── electron/
│   ├── main.ts                       # Main process (tray, IPC, screen capture)
│   ├── preload.ts                    # contextBridge (ipcRenderer, screenCapture)
│   └── electron-env.d.ts             # Window types
├── src/
│   ├── App.tsx                       # App principal (sidebar, routing, state)
│   ├── index.css                     # Tailwind v4 @theme (colores, animaciones)
│   ├── config.ts                     # API keys, modelos Gemini, URLs
│   ├── main.tsx                      # Entry point React
│   ├── adapters/
│   │   └── desktop_ui/
│   │       └── ChatUI.tsx            # Chat UI con streaming + markdown
│   ├── components/
│   │   ├── Auth.tsx                  # Login screen
│   │   ├── ScreenViewer.tsx          # Screen capture viewer
│   │   ├── ProjectHub.tsx            # Vista de proyecto/folder
│   │   └── FolderModals.tsx          # Modales crear/mover carpeta
│   ├── contexts/
│   │   └── AuthContext.tsx           # AuthProvider + useAuth
│   ├── lib/
│   │   ├── supabase.ts              # Cliente Supabase Lia
│   │   └── sofia-client.ts          # Cliente SOFIA + tipos
│   ├── prompts/
│   │   └── chat.ts                  # System prompt LIA
│   └── services/
│       ├── chat-service.ts          # CRUD conversaciones Supabase
│       ├── gemini-chat.ts           # Streaming Gemini + historial
│       ├── sofia-auth.ts            # Auth service SOFIA
│       └── folder-service.ts        # CRUD folders Supabase
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Configuracion (config.ts)

```typescript
export const MODELS = {
  PRIMARY: 'gemini-2.5-flash-preview',
  FALLBACK: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-pro-preview',
  WEB_AGENT: 'gemini-2.5-flash-preview',
  LIVE: 'gemini-2.5-flash-native-audio-preview-12-2025',
  IMAGE_GENERATION: 'gemini-2.5-flash-image',
  DEEP_RESEARCH: 'deep-research-pro-preview-12-2025',
};
```

---

## Tipos Clave

```typescript
// Conversation (chat-service.ts)
interface Conversation {
  id: string; user_id: string; title: string;
  folder_id?: string; is_pinned?: boolean;
  created_at: string; updated_at: string;
}

// ChatMessage (chat-service.ts)
interface ChatMessage {
  id: string; role: 'user' | 'model'; text: string;
  timestamp: number;
  sources?: Array<{ uri: string; title: string }>;
  images?: string[];
}

// Folder (folder-service.ts)
interface Folder {
  id: string; user_id: string; name: string;
  description?: string; created_at: string; updated_at: string;
}
```

---

## Problemas Resueltos

1. **Tailwind v3 → v4**: Migrado a `@tailwindcss/postcss` plugin + directiva `@theme` + `@utility`
2. **Modelo Gemini deprecado**: Cambiado a `gemini-2.5-flash-preview`
3. **`nativeImage` tipo**: Cambiado `let trayIcon: nativeImage` a `let trayIcon: Electron.NativeImage`
4. **Auth dual Supabase**: Adaptado de chrome.storage.local a localStorage
5. **electron-builder**: Actualizado a v26.7.0 por compatibilidad

---

## QUE FALTA POR IMPLEMENTAR

### Prioridad Alta (funcionalidades core de la extension)

#### 1. Chat en Voz (Live API)
- Conexion WebSocket a Gemini Live API (`wss://generativelanguage.googleapis.com/...`)
- Modelo: `gemini-2.5-flash-native-audio-preview-12-2025`
- Captura de audio del microfono via Web Audio API
- Streaming bidireccional (enviar audio, recibir audio/texto)
- UI: boton de microfono, indicador de grabacion, visualizacion de audio
- La extension ya tiene esto implementado — adaptar para desktop

#### 2. Web Agent (Uso de Computadora)
- Agente que puede navegar la web autonomamente
- Toma screenshots de la pantalla, analiza con Gemini, ejecuta acciones
- Modelo: `gemini-2.5-flash-preview` con tools de computer use
- La extension usa tabs del navegador — en desktop seria via screen capture + automatizacion
- Componente: panel de seguimiento del agente con pasos en tiempo real

#### 3. Generacion de Imagenes
- Modelo: `gemini-2.5-flash-image`
- Input: prompt de texto → output: imagen generada
- UI: area de preview de imagen, descarga, historial de generaciones
- Integrar como herramienta seleccionable en el chat

#### 4. Deep Research
- Modelo: `deep-research-pro-preview-12-2025`
- Investigacion profunda automatizada con multiples busquedas
- Genera reporte en markdown
- UI: barra de progreso, pasos de investigacion visibles, reporte final

#### 5. Prompt Optimizer
- Tool que mejora prompts del usuario antes de enviarlos
- Usa Gemini Pro para reescribir/mejorar el prompt
- UI: boton "Optimizar" en el input, preview del prompt mejorado

### Prioridad Media

#### 6. Personalizacion del Usuario (Settings)
- Pagina de configuracion con:
  - Nickname, ocupacion, tono preferido
  - Instrucciones personalizadas para LIA
  - Tema (claro/oscuro)
- Guardar en Supabase (user_profiles o settings table)
- Inyectar en system prompt de Gemini

#### 7. Tool Library
- Biblioteca de herramientas/plugins disponibles
- Toggle para activar/desactivar tools
- UI: grid de cards con descripcion de cada tool
- Herramientas: Google Search, Deep Research, Image Gen, Web Agent, etc.

#### 8. Memoria de Proyecto (Project Memory Injection)
- Cuando se crea un chat nuevo dentro de un folder/proyecto
- Inyectar resumen de las ultimas 3 conversaciones del proyecto en el system prompt
- Da contexto continuo entre conversaciones del mismo proyecto
- Ya implementado en la extension — adaptar para desktop

#### 9. Sugerencia Automatica de Proyecto
- Cuando un chat tiene 4+ mensajes y no esta en folder
- Analizar keywords del titulo vs folders existentes
- Sugerir mover a folder existente o crear uno nuevo
- Modal de sugerencia con opciones

### Prioridad Baja

#### 10. Drag & Drop en Sidebar
- Arrastrar chats entre folders
- Reordenar folders

#### 11. Archivos Adjuntos en Chat
- Subir imagenes/PDFs al chat
- Enviar a Gemini como multimodal input
- Preview en el mensaje

#### 12. Export/Import de Conversaciones
- Exportar chat como markdown/PDF
- Importar conversaciones

#### 13. Notificaciones de Escritorio
- Notificaciones nativas de Windows cuando LIA responde (si app esta en tray)

#### 14. Auto-Update
- electron-updater para actualizaciones automaticas
- Verificar nueva version al iniciar

---

## Como Ejecutar

```bash
cd Soflia-hub-desktop
npm install
npm run dev          # Dev mode (Electron + Vite hot reload)
npm run build        # Build produccion
npm run build:win    # Empaquetar .exe con electron-builder
```

---

## Notas Tecnicas

- **Tailwind v4**: No usa `tailwind.config.js` para colores — todo esta en `@theme` dentro de `index.css`
- **Build verificado**: `npx tsc --noEmit` + `npx vite build` pasan sin errores
- **Supabase RLS**: Las tablas folders y conversations tienen Row Level Security por user_id
- **Session persistence**: localStorage con TTL de 24h (no chrome.storage)
- **Modales**: Usan overlay `fixed inset-0 z-50` con click-outside-to-close
- **Streaming**: Async iterables (`for await...of`) con chunks de texto
- **No se usa**: `src/adapters/os_automation/`, `src/adapters/tools/`, `src/core/` (legacy de Clean Architecture inicial, no conectados)

---

## Referencia: Extension de Chrome (Soflia Extension/)
La carpeta `Soflia Extension/` contiene la extension original con todas las funcionalidades completas. Usar como referencia para implementar las features pendientes. El archivo principal es `src/popup/App.tsx` (monolitico, ~5000 lineas).
