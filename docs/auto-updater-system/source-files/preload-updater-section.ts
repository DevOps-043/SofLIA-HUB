/**
 * EXTRACTO DEL PRELOAD.TS — Solo las partes relevantes al sistema de actualizaciones.
 *
 * Este archivo NO se copia directamente. Muestra cómo integrar el updater
 * en tu preload.ts existente.
 */

import { contextBridge, ipcRenderer } from 'electron'

// ─── 1. Channel Allowlist ───────────────────────────────────────────
// Agregar estos canales a tu array de canales permitidos:
const UPDATER_CHANNELS = [
  'updater:check-for-updates',
  'updater:download-update',
  'updater:install-update',
  'updater:get-status',
  'updater:update-available',    // evento: main → renderer
  'updater:download-progress',   // evento: main → renderer
  'updater:update-downloaded',   // evento: main → renderer
  'updater:error',               // evento: main → renderer
]

// ─── 2. Helpers de seguridad ────────────────────────────────────────
// Si tu proyecto NO tiene estos helpers, agrégalos:

const sanitizePayload = (payload: any): any => {
  if (payload === null || payload === undefined) return payload
  if (typeof payload === 'function') {
    throw new Error('Security Violation: Callbacks and functions are not allowed in IPC.')
  }
  if (Array.isArray(payload)) return payload.map(sanitizePayload)
  if (typeof payload === 'object') {
    const safeObj: Record<string, any> = { ...payload }
    for (const key in safeObj) {
      if (Object.prototype.hasOwnProperty.call(safeObj, key)) {
        safeObj[key] = sanitizePayload(safeObj[key])
      }
    }
    return safeObj
  }
  return payload
}

const validateChannel = (channel: string) => {
  if (!ALLOWED_IPC_CHANNELS.includes(channel)) {
    console.error(`ALERTA DE SEGURIDAD: Canal IPC no autorizado: ${channel}`)
    throw new Error(`Unauthorized IPC channel: ${channel}`)
  }
}

const safeInvoke = (channel: string, ...args: any[]) => {
  validateChannel(channel)
  return ipcRenderer.invoke(channel, ...args.map(sanitizePayload))
}

const safeOn = (channel: string, cb: (...args: any[]) => void) => {
  validateChannel(channel)
  ipcRenderer.on(channel, (_event, ...args) => cb(...args.map(sanitizePayload)))
}

const safeRemoveAllListeners = (channel: string) => {
  validateChannel(channel)
  ipcRenderer.removeAllListeners(channel)
}

// ─── 3. Exponer API del Updater ─────────────────────────────────────
// Agregar este bloque en tu preload.ts:

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
