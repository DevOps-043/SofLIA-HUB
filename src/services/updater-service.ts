/**
 * Updater Service (Renderer-side)
 * Wrapper tipado para el sistema de auto-actualización vía IPC.
 */

// ─── Types ──────────────────────────────────────────────────────────

/**
 * Representa los posibles estados del servicio de actualización.
 * - `idle`: El actualizador está inactivo.
 * - `checking`: Buscando activamente una actualización.
 * - `available`: Se encontró una actualización disponible.
 * - `not-available`: No se encontraron actualizaciones disponibles.
 * - `downloading`: La actualización se está descargando.
 * - `downloaded`: La actualización se ha descargado y está lista para instalarse.
 * - `error`: Ocurrió un error durante el proceso.
 */
export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

/**
 * Contiene el estado completo y actual del servicio de actualización.
 */
export interface UpdaterStatus {
  /** El estado actual del proceso de actualización. */
  state: UpdaterState
  /** La versión actual de la aplicación. */
  currentVersion: string
  /** La versión disponible para descargar, si la hay. */
  availableVersion: string | null
  /** Las notas de la versión para la actualización disponible. */
  releaseNotes: string | null
  /** El progreso de la descarga (0-100), si se está descargando. */
  downloadProgress: number | null
  /** Un mensaje de error, si ocurrió alguno. */
  error: string | null
}

/**
 * Información detallada sobre una actualización disponible.
 * Se recibe a través del evento `onUpdateAvailable`.
 */
export interface UpdateAvailableInfo {
  /** La versión de la actualización disponible. */
  version: string
  /** Las notas de la versión asociadas. */
  releaseNotes: string | null
  /** La fecha de publicación de la versión. */
  releaseDate: string
}

/**
 * Información sobre el progreso de la descarga de una actualización.
 * Se recibe a través del evento `onDownloadProgress`.
 */
export interface DownloadProgress {
  /** Porcentaje de la descarga completado (0-100). */
  percent: number
  /** Velocidad de descarga en bytes por segundo. */
  bytesPerSecond: number
  /** Bytes transferidos hasta el momento. */
  transferred: number
  /** Tamaño total de la descarga en bytes. */
  total: number
}

// ─── Window type augmentation ───────────────────────────────────────

declare global {
  interface Window {
    /**
     * API del servicio de actualización expuesta desde el proceso principal
     * al proceso de renderizado a través del script de preload.
     * Permite interactuar con el sistema de auto-actualización de forma segura.
     */
    updater: {
      /** Inicia la búsqueda de actualizaciones. */
      checkForUpdates: () => Promise<{ success: boolean; state?: UpdaterState; availableVersion?: string | null; error?: string }>
      /** Comienza la descarga de una actualización disponible. */
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>
      /** Cierra la aplicación e instala la actualización descargada. */
      installUpdate: () => Promise<{ success: boolean; error?: string }>
      /** Obtiene el estado actual completo del servicio de actualización. */
      getStatus: () => Promise<UpdaterStatus>
      /** Registra un callback para cuando se encuentra una actualización disponible. */
      onUpdateAvailable: (cb: (info: UpdateAvailableInfo) => void) => void
      /** Registra un callback para recibir el progreso de la descarga. */
      onDownloadProgress: (cb: (progress: DownloadProgress) => void) => void
      /** Registra un callback para cuando una actualización ha sido descargada. */
      onUpdateDownloaded: (cb: (info: { version: string; releaseNotes: string | null }) => void) => void
      /** Registra un callback para manejar errores del actualizador. */
      onError: (cb: (err: { message: string }) => void) => void
      /** Elimina todos los listeners de eventos del actualizador. */
      removeListeners: () => void
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Busca actualizaciones disponibles.
 * Llama a `window.updater.checkForUpdates` y, si tiene éxito,
 * devuelve el estado completo del actualizador.
 * @returns Una promesa que se resuelve con el estado del actualizador, o `null` si la API no está disponible o falla.
 */
export async function checkForUpdates(): Promise<UpdaterStatus | null> {
  if (typeof window.updater === 'undefined') return null
  const result = await window.updater.checkForUpdates()
  if (!result.success) return null
  return window.updater.getStatus()
}

/**
 * Inicia la descarga de la actualización disponible.
 * Llama a `window.updater.downloadUpdate`.
 */
export async function downloadUpdate(): Promise<void> {
  if (typeof window.updater === 'undefined') return
  await window.updater.downloadUpdate()
}

/**
 * Instala la actualización descargada. La aplicación se cerrará y reiniciará.
 * Llama a `window.updater.installUpdate`.
 */
export async function installUpdate(): Promise<void> {
  if (typeof window.updater === 'undefined') return
  await window.updater.installUpdate()
}

/**
 * Obtiene el estado actual del servicio de actualización.
 * Llama a `window.updater.getStatus`.
 * @returns Una promesa que se resuelve con el estado del actualizador, o `null` si la API no está disponible.
 */
export async function getUpdaterStatus(): Promise<UpdaterStatus | null> {
  if (typeof window.updater === 'undefined') return null
  return window.updater.getStatus()
}
