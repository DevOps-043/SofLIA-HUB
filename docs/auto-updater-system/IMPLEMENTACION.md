# Sistema de Auto-Actualizaciones para Electron

## Resumen

Sistema completo de auto-actualización OTA (Over-The-Air) para aplicaciones Electron usando `electron-updater` con GitHub Releases como proveedor. Incluye:

- **Backend (Main Process):** Servicio que verifica, descarga e instala actualizaciones
- **IPC Bridge:** Handlers + preload para comunicar main ↔ renderer de forma segura
- **Frontend (Renderer):** Componente de notificación flotante + panel de configuración
- **CI/CD:** GitHub Actions workflow que buildea (Windows + Mac) y publica releases automáticamente

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Releases                          │
│   (repo separado para releases: owner/app-releases)             │
│   Contiene: .exe, .dmg, latest.yml, latest-mac.yml, blockmap   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS polling
┌──────────────────────────────┼──────────────────────────────────┐
│  Main Process                │                                   │
│  ┌───────────────────────────▼──────────────────────────────┐   │
│  │  UpdaterService (EventEmitter)                            │   │
│  │  - electron-updater autoUpdater                           │   │
│  │  - Polling cada 4 horas + check al arrancar (10s delay)   │   │
│  │  - Estados: idle→checking→available→downloading→downloaded │   │
│  │  - autoDownload: true                                     │   │
│  │  - autoInstallOnAppQuit: true                             │   │
│  └───────────────┬───────────────────────────────────────────┘   │
│                  │ EventEmitter events                            │
│  ┌───────────────▼───────────────────────────────────────────┐   │
│  │  UpdaterHandlers (IPC)                                     │   │
│  │  - ipcMain.handle: check, download, install, get-status    │   │
│  │  - Event forwarding: main → renderer via webContents.send  │   │
│  └───────────────┬───────────────────────────────────────────┘   │
├──────────────────┼───────────────────────────────────────────────┤
│  Preload         │ contextBridge.exposeInMainWorld('updater')    │
│  (Security)      │ safeInvoke + safeOn + channel allowlist       │
├──────────────────┼───────────────────────────────────────────────┤
│  Renderer        │                                               │
│  ┌───────────────▼───────────────────────────────────────────┐   │
│  │  updater-service.ts (typed wrapper)                        │   │
│  │  window.updater.checkForUpdates / downloadUpdate / etc.    │   │
│  ├───────────────────────────────────────────────────────────┤   │
│  │  UpdateNotification — toast flotante bottom-right          │   │
│  │  UpdatePanel — panel completo en settings                  │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Archivos a Crear

| # | Archivo | Capa | Descripción |
|---|---------|------|-------------|
| 1 | `electron/updater-service.ts` | Main | Servicio core con electron-updater |
| 2 | `electron/updater-handlers.ts` | Main | IPC handlers (request-response + event forwarding) |
| 3 | Sección en `electron/preload.ts` | Bridge | contextBridge API para updater |
| 4 | Sección en `electron/main.ts` | Main | Inicialización del servicio |
| 5 | `src/services/updater-service.ts` | Renderer | Wrapper tipado para el frontend |
| 6 | `src/components/UpdateNotification.tsx` | Renderer | Toast de notificación |
| 7 | `src/components/UpdatePanel.tsx` | Renderer | Panel completo de actualizaciones |
| 8 | `electron-builder.json5` | Build | Config de electron-builder con publish |
| 9 | `.github/workflows/release.yml` | CI/CD | Build + publish automático |

---

## Paso a Paso de Implementacion

### 1. Instalar dependencias

```bash
npm install electron-updater
npm install -D electron-builder
```

### 2. Crear `electron/updater-service.ts`

Este es el servicio core. Usa `electron-updater` para verificar, descargar e instalar actualizaciones.

```typescript
import { EventEmitter } from 'events'
import electronUpdater from 'electron-updater'
import type { UpdateInfo, ProgressInfo } from 'electron-updater'
import { app } from 'electron'

const { autoUpdater } = electronUpdater as typeof import('electron-updater')

// ─── Types ──────────────────────────────────────────────────────────

export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdaterStatus {
  state: UpdaterState
  currentVersion: string
  availableVersion: string | null
  releaseNotes: string | null
  downloadProgress: number | null // 0-100
  error: string | null
}

// ─── Service ────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 horas
const STARTUP_DELAY_MS = 10 * 1000 // 10 segundos

export class UpdaterService extends EventEmitter {
  private state: UpdaterState = 'idle'
  private availableVersion: string | null = null
  private releaseNotes: string | null = null
  private downloadProgress: number | null = null
  private errorMessage: string | null = null
  private pollInterval: NodeJS.Timeout | null = null

  init(): void {
    // Configuración: descarga automática + instala silenciosamente al cerrar
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowDowngrade = false

    // ─── Eventos de electron-updater ──────────────────────────
    autoUpdater.on('checking-for-update', () => {
      this.state = 'checking'
      this.emit('status-changed', this.getStatus())
      console.log('[Updater] Verificando actualizaciones...')
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.state = 'available'
      this.availableVersion = info.version
      this.releaseNotes = typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map(n => typeof n === 'string' ? n : n.note).join('\n')
          : null
      this.errorMessage = null
      this.emit('update-available', {
        version: info.version,
        releaseNotes: this.releaseNotes,
        releaseDate: info.releaseDate,
      })
      this.emit('status-changed', this.getStatus())
      console.log(`[Updater] Actualización disponible: v${info.version}`)
    })

    autoUpdater.on('update-not-available', (_info: UpdateInfo) => {
      this.state = 'not-available'
      this.errorMessage = null
      this.emit('status-changed', this.getStatus())
      console.log('[Updater] No hay actualizaciones disponibles')
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.state = 'downloading'
      this.downloadProgress = Math.round(progress.percent)
      this.emit('download-progress', {
        percent: this.downloadProgress,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      })
      this.emit('status-changed', this.getStatus())
    })

    autoUpdater.on('update-downloaded', (_info: UpdateInfo) => {
      this.state = 'downloaded'
      this.downloadProgress = 100
      this.emit('update-downloaded', {
        version: this.availableVersion,
        releaseNotes: this.releaseNotes,
      })
      this.emit('status-changed', this.getStatus())
      console.log('[Updater] Actualización descargada — lista para instalar')
    })

    autoUpdater.on('error', (err: Error) => {
      this.state = 'error'
      this.errorMessage = err.message
      this.emit('error', { message: err.message })
      this.emit('status-changed', this.getStatus())
      console.error('[Updater] Error:', err.message)
    })

    // Verificar al arrancar (con delay para no bloquear startup)
    setTimeout(() => {
      this.checkForUpdates().catch(() => {})
    }, STARTUP_DELAY_MS)

    // Polling periódico
    this.pollInterval = setInterval(() => {
      this.checkForUpdates().catch(() => {})
    }, CHECK_INTERVAL_MS)

    console.log('[Updater] Inicializado — polling cada 4h')
  }

  async checkForUpdates(): Promise<UpdaterStatus> {
    try {
      await autoUpdater.checkForUpdates()
    } catch (err: any) {
      this.state = 'error'
      this.errorMessage = err.message
    }
    return this.getStatus()
  }

  async downloadUpdate(): Promise<void> {
    this.state = 'downloading'
    this.downloadProgress = 0
    this.emit('status-changed', this.getStatus())
    await autoUpdater.downloadUpdate()
  }

  installUpdate(): void {
    // isSilent=true: no muestra wizard/UI del instalador
    // isForceRunAfter=true: reabre la app automáticamente después de instalar
    autoUpdater.quitAndInstall(true, true)
  }

  getStatus(): UpdaterStatus {
    return {
      state: this.state,
      currentVersion: app.getVersion(),
      availableVersion: this.availableVersion,
      releaseNotes: this.releaseNotes,
      downloadProgress: this.downloadProgress,
      error: this.errorMessage,
    }
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }
}
```

**Notas importantes:**
- `autoUpdater.autoDownload = true` — descarga automáticamente cuando detecta una nueva versión
- `autoUpdater.autoInstallOnAppQuit = true` — instala cuando el usuario cierra la app
- El import de `electron-updater` usa un cast porque el módulo usa default export
- Delay de 10s al arrancar para no bloquear el startup de la app
- Polling cada 4 horas para no saturar GitHub API

### 3. Crear `electron/updater-handlers.ts`

Conecta el servicio con el renderer via IPC.

```typescript
import { ipcMain, type BrowserWindow } from 'electron'
import type { UpdaterService } from './updater-service'

export function registerUpdaterHandlers(
  updaterService: UpdaterService,
  getMainWindow: () => BrowserWindow | null,
): void {
  // ─── Invoke handlers (request-response) ────────────────────────
  ipcMain.handle('updater:check-for-updates', async () => {
    try {
      const status = await updaterService.checkForUpdates()
      return { success: true, ...status }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('updater:download-update', async () => {
    try {
      await updaterService.downloadUpdate()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('updater:install-update', async () => {
    try {
      updaterService.installUpdate()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('updater:get-status', async () => {
    return updaterService.getStatus()
  })

  // ─── Event forwarding (main → renderer) ────────────────────────
  updaterService.on('update-available', (data) => {
    getMainWindow()?.webContents.send('updater:update-available', data)
  })

  updaterService.on('download-progress', (data) => {
    getMainWindow()?.webContents.send('updater:download-progress', data)
  })

  updaterService.on('update-downloaded', (data) => {
    getMainWindow()?.webContents.send('updater:update-downloaded', data)
  })

  updaterService.on('error', (data) => {
    getMainWindow()?.webContents.send('updater:error', data)
  })

  console.log('[UpdaterHandlers] Registrados correctamente')
}
```

### 4. Agregar al preload.ts

Agrega estos canales IPC al allowlist y expón la API:

```typescript
// En el array ALLOWED_IPC_CHANNELS, agregar:
'updater:check-for-updates',
'updater:download-update',
'updater:install-update',
'updater:get-status',
'updater:update-available',
'updater:download-progress',
'updater:update-downloaded',
'updater:error',

// Exponer la API al renderer:
contextBridge.exposeInMainWorld('updater', {
  checkForUpdates: () => safeInvoke('updater:check-for-updates'),
  downloadUpdate: () => safeInvoke('updater:download-update'),
  installUpdate: () => safeInvoke('updater:install-update'),
  getStatus: () => safeInvoke('updater:get-status'),
  onUpdateAvailable: (cb: (info: any) => void) => safeOn('updater:update-available', cb),
  onDownloadProgress: (cb: (progress: any) => void) => safeOn('updater:download-progress', cb),
  onUpdateDownloaded: (cb: (info: any) => void) => safeOn('updater:update-downloaded', cb),
  onError: (cb: (err: any) => void) => safeOn('updater:error', cb),
  removeListeners: () => {
    safeRemoveAllListeners('updater:update-available')
    safeRemoveAllListeners('updater:download-progress')
    safeRemoveAllListeners('updater:update-downloaded')
    safeRemoveAllListeners('updater:error')
  },
})
```

**Nota:** `safeInvoke`, `safeOn`, `safeRemoveAllListeners` son helpers del preload que validan el canal contra el allowlist antes de llamar a `ipcRenderer`. Si tu proyecto no los tiene, usa directamente:
```typescript
// safeInvoke equivale a:
const safeInvoke = (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
// safeOn equivale a:
const safeOn = (channel: string, cb: (...args: any[]) => void) => ipcRenderer.on(channel, (_event, ...args) => cb(...args))
// safeRemoveAllListeners equivale a:
const safeRemoveAllListeners = (channel: string) => ipcRenderer.removeAllListeners(channel)
```

### 5. Inicializar en main.ts

```typescript
import { UpdaterService } from './updater-service'
import { registerUpdaterHandlers } from './updater-handlers'

// Crear instancia
const updaterService = new UpdaterService()

// Registrar IPC handlers (pasar getter de la ventana principal)
registerUpdaterHandlers(updaterService, () => mainWindow)

// Inicializar (después de crear la ventana)
updaterService.init()
```

### 6. Crear `src/services/updater-service.ts` (Renderer wrapper)

```typescript
// ─── Types ──────────────────────────────────────────────────────────

export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdaterStatus {
  state: UpdaterState
  currentVersion: string
  availableVersion: string | null
  releaseNotes: string | null
  downloadProgress: number | null
  error: string | null
}

export interface UpdateAvailableInfo {
  version: string
  releaseNotes: string | null
  releaseDate: string
}

export interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

// ─── Window type augmentation ───────────────────────────────────────

declare global {
  interface Window {
    updater: {
      checkForUpdates: () => Promise<{ success: boolean; state?: UpdaterState; availableVersion?: string | null; error?: string }>
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>
      installUpdate: () => Promise<{ success: boolean; error?: string }>
      getStatus: () => Promise<UpdaterStatus>
      onUpdateAvailable: (cb: (info: UpdateAvailableInfo) => void) => void
      onDownloadProgress: (cb: (progress: DownloadProgress) => void) => void
      onUpdateDownloaded: (cb: (info: { version: string; releaseNotes: string | null }) => void) => void
      onError: (cb: (err: { message: string }) => void) => void
      removeListeners: () => void
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export async function checkForUpdates(): Promise<UpdaterStatus | null> {
  if (typeof window.updater === 'undefined') return null
  const result = await window.updater.checkForUpdates()
  if (!result.success) return null
  return window.updater.getStatus()
}

export async function downloadUpdate(): Promise<void> {
  await window.updater.downloadUpdate()
}

export async function installUpdate(): Promise<void> {
  await window.updater.installUpdate()
}

export async function getUpdaterStatus(): Promise<UpdaterStatus | null> {
  if (typeof window.updater === 'undefined') return null
  return window.updater.getStatus()
}
```

### 7. Crear componentes UI

Ver los archivos `UpdateNotification.tsx` y `UpdatePanel.tsx` incluidos en esta carpeta. Resumen:

- **UpdateNotification** — Toast flotante (fixed bottom-right, z-9999) que aparece automáticamente cuando hay actualización. Tiene 4 fases: `available` → `downloading` → `ready` → `error`. Se puede cerrar/dismissar.

- **UpdatePanel** — Panel completo para integrar en un modal de settings. Muestra versión actual, botón de check manual, progreso de descarga, release notes, estados.

**Uso en tu App:**
```tsx
// En tu componente raíz App.tsx:
import { UpdateNotification } from './components/UpdateNotification'

function App() {
  return (
    <>
      {/* ... tu app ... */}
      <UpdateNotification />
    </>
  )
}
```

### 8. Configurar electron-builder

Crear `electron-builder.json5` en la raíz del proyecto:

```json5
{
  $schema: "https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/scheme.json",
  appId: "com.tuempresa.tuapp",
  npmRebuild: false,
  asar: true,
  productName: "Tu App",
  publish: [
    {
      provider: "github",
      owner: "TU-ORG",           // <-- tu usuario u org de GitHub
      repo: "tu-app-releases",   // <-- repo separado para releases
      releaseType: "release",
    },
  ],
  directories: {
    output: "release/${version}",
    buildResources: "build",
  },
  files: ["dist", "dist-electron"],
  win: {
    icon: "public/assets/icono.ico",
    target: [{ target: "nsis", arch: ["x64"] }],
    artifactName: "TuApp-Windows-${version}-Setup.${ext}",
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    deleteAppDataOnUninstall: false,
    unicode: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Tu App",
  },
  mac: {
    target: ["dmg"],
    artifactName: "TuApp-Mac-${version}-Installer.${ext}",
  },
  linux: {
    target: ["AppImage"],
    artifactName: "TuApp-Linux-${version}.${ext}",
  },
}
```

**Puntos clave:**
- `publish.provider: "github"` — electron-updater busca releases en GitHub
- **Repo separado para releases** — recomendado para no mezclar código con artefactos binarios
- `asar: true` — empaqueta el código en un archivo .asar (seguridad + rendimiento)
- `nsis.oneClick: true` — instalador silencioso sin wizard

### 9. GitHub Actions CI/CD

Crear `.github/workflows/release.yml`:

```yaml
name: Build & Release

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    outputs:
      version: ${{ steps.version.outputs.version }}
      exists: ${{ steps.check_release.outputs.exists }}
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.RELEASES_TOKEN }}

      - name: Get version
        id: version
        run: |
          VERSION=$(node -p "require('./package.json').version")
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Check if release exists
        id: check_release
        env:
          GH_TOKEN: ${{ secrets.RELEASES_TOKEN }}
        run: |
          if gh release view "v${{ steps.version.outputs.version }}" --repo TU-ORG/tu-app-releases > /dev/null 2>&1; then
            echo "exists=true" >> $GITHUB_OUTPUT
          else
            echo "exists=false" >> $GITHUB_OUTPUT
          fi

  build-windows:
    needs: check
    if: needs.check.outputs.exists == 'false'
    runs-on: windows-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Create .env
        run: |
          echo "VITE_API_KEY=${{ secrets.VITE_API_KEY }}" >> .env
          # Agrega todas las vars de entorno que necesites
      - name: Build
        env:
          GH_TOKEN: ${{ secrets.RELEASES_TOKEN }}
        run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: windows-artifacts
          path: |
            release/${{ needs.check.outputs.version }}/*.exe
            release/${{ needs.check.outputs.version }}/*.blockmap
            release/${{ needs.check.outputs.version }}/latest.yml

  build-mac:
    needs: check
    if: needs.check.outputs.exists == 'false'
    runs-on: macos-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Create .env
        run: |
          echo "VITE_API_KEY=${{ secrets.VITE_API_KEY }}" >> .env
      - name: Build
        env:
          GH_TOKEN: ${{ secrets.RELEASES_TOKEN }}
        run: npx tsc && npx vite build && npx electron-builder --mac
      - uses: actions/upload-artifact@v4
        with:
          name: mac-artifacts
          path: |
            release/${{ needs.check.outputs.version }}/*.dmg
            release/${{ needs.check.outputs.version }}/latest-mac.yml

  release:
    needs: [check, build-windows, build-mac]
    if: needs.check.outputs.exists == 'false'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: windows-artifacts
          path: artifacts/
      - uses: actions/download-artifact@v4
        with:
          name: mac-artifacts
          path: artifacts/
      - name: Create Release
        env:
          GH_TOKEN: ${{ secrets.RELEASES_TOKEN }}
        run: |
          VERSION="${{ needs.check.outputs.version }}"
          gh release create "v${VERSION}" \
            --repo TU-ORG/tu-app-releases \
            --title "Tu App v${VERSION}" \
            --notes "Release v${VERSION}" \
            artifacts/*
```

**Secrets necesarios en GitHub:**
- `RELEASES_TOKEN` — GitHub Personal Access Token con permisos `repo` (para crear releases en el repo de releases)
- Variables de entorno de tu app (las que uses con VITE_*)

---

## Flujo Completo de una Actualización

```
1. Developer hace push a main con nueva version en package.json
   │
2. GitHub Actions detecta el push
   │
3. Job "check" lee la versión y verifica si ya existe un release
   │ (si ya existe, se salta todo)
   │
4. Jobs "build-windows" + "build-mac" corren en paralelo
   │  → npm ci → crear .env → npm run build
   │  → electron-builder genera: .exe + .blockmap + latest.yml (Win)
   │                               .dmg + latest-mac.yml (Mac)
   │
5. Job "release" descarga artefactos y crea GitHub Release
   │  → gh release create "vX.Y.Z" con todos los artefactos
   │
6. App en producción (UpdaterService) hace polling cada 4h
   │  → autoUpdater.checkForUpdates()
   │  → electron-updater lee latest.yml del GitHub Release
   │
7. Si hay nueva versión:
   │  → Evento 'update-available' → UI muestra notificación
   │  → autoDownload=true → descarga automática en background
   │  → Evento 'download-progress' → UI muestra barra de progreso
   │  → Evento 'update-downloaded' → UI muestra "Reiniciar para actualizar"
   │
8. Usuario hace click en "Reiniciar" o cierra la app
   │  → autoUpdater.quitAndInstall(true, true)
   │  → Instala silenciosamente + reabre la app
   │
9. App abre con la nueva versión ✓
```

---

## Requisitos Previos

1. **Repo de releases separado** — Crea un repo público o privado en GitHub solo para releases (ej: `TU-ORG/tu-app-releases`)
2. **GitHub Token** — Crea un Personal Access Token (classic) con scope `repo`, agrégalo como secret `RELEASES_TOKEN`
3. **Version en package.json** — Cada release nuevo requiere incrementar la versión
4. **Certificado de firma (opcional)** — Para Windows necesitas un certificado de firma de código para evitar warnings de SmartScreen. Sin él funciona pero Windows muestra "aplicación no reconocida"

---

## Checklist de Integración

- [ ] `npm install electron-updater`
- [ ] `npm install -D electron-builder`
- [ ] Crear `electron/updater-service.ts`
- [ ] Crear `electron/updater-handlers.ts`
- [ ] Agregar canales `updater:*` al allowlist del preload
- [ ] Agregar `contextBridge.exposeInMainWorld('updater', ...)` al preload
- [ ] Instanciar `UpdaterService` e inicializar en main.ts
- [ ] Registrar handlers con `registerUpdaterHandlers()`
- [ ] Crear `src/services/updater-service.ts` (renderer wrapper)
- [ ] Crear `src/components/UpdateNotification.tsx`
- [ ] Crear `src/components/UpdatePanel.tsx` (opcional, para settings)
- [ ] Montar `<UpdateNotification />` en el componente raíz
- [ ] Crear `electron-builder.json5` con `publish` configurado
- [ ] Crear repo de releases en GitHub
- [ ] Agregar `RELEASES_TOKEN` como secret en GitHub
- [ ] Crear `.github/workflows/release.yml`
- [ ] Incrementar versión en package.json y hacer push para probar

---

## Notas de Personalización

- **Cambiar intervalo de polling:** Modificar `CHECK_INTERVAL_MS` en updater-service.ts
- **Descarga manual (no automática):** Cambiar `autoUpdater.autoDownload = false` y dejar que el usuario haga click en "Descargar"
- **Solo Windows:** Eliminar el job `build-mac` del workflow y la config `mac` del electron-builder.json5
- **Proveedor S3/Generic:** electron-updater soporta S3, DigitalOcean Spaces, y servidores genéricos. Cambiar `publish.provider` en electron-builder.json5
- **Release notes:** El workflow extrae notas de `CHANGELOG.md`. Si no lo usas, pon un texto genérico
- **UI:** Los componentes usan Tailwind CSS v4. Si usas otro framework CSS, adapta las clases
