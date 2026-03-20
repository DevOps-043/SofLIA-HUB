/**
 * EXTRACTO DEL MAIN.TS — Solo las partes relevantes al sistema de actualizaciones.
 *
 * Este archivo NO se copia directamente. Muestra cómo integrar el updater
 * en tu main.ts existente.
 */

// ─── 1. Imports ─────────────────────────────────────────────────────
import { UpdaterService } from './updater-service'
import { registerUpdaterHandlers } from './updater-handlers'

// ─── 2. Instanciar ──────────────────────────────────────────────────
// Junto con tus otros servicios:
const updaterService = new UpdaterService()

// ─── 3. Registrar IPC handlers ──────────────────────────────────────
// Después de crear la ventana principal (win/mainWindow):
// El segundo argumento es un getter que retorna la ventana principal.
// Esto permite que los eventos se reenvíen al renderer.
registerUpdaterHandlers(updaterService, () => mainWindow)

// ─── 4. Inicializar ────────────────────────────────────────────────
// Después de que la ventana esté lista:
updaterService.init()

// ─── 5. Cleanup (opcional) ──────────────────────────────────────────
// En el evento 'before-quit' o 'will-quit':
// updaterService.stop()
