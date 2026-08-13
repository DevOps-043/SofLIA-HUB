// =============================================================================
// Pulse Hub - DesktopContextService
// =============================================================================
// Servicio de la capacidad "Anadir aplicaciones" del chat: inventario de
// ventanas abiertas y extraccion en cascada del contenido de las que el usuario
// marque.
//
// La extraccion SOLO ocurre sobre identificadores que este servicio emitio en
// un inventario previo. Un identificador desconocido se rechaza antes de tocar
// PowerShell o COM.
// =============================================================================

import fs from 'node:fs';
import { BrowserWindow, desktopCapturer } from 'electron';
import { DesktopWindowControls } from '../desktop-agent/window-controls';
import { isSidecarDocument, pythonToolsService } from '../python-tools-service';
import { buildInventory, availableLevelsFor, type DesktopWindowRecord, type WindowSource } from './inventory';
import { extractAppContext } from './cascade';
import { listOpenOfficeDocuments } from './office-com';
import { runEncodedPowerShell } from './powershell';
import { captureWindow } from './window-capture';
import { extractWindowText } from './uia-text';
import {
  DESKTOP_CONTEXT_LIMITS,
  isValidCandidateId,
  type DesktopAppContextAttachment,
  type DesktopContextInventory,
} from './types';

const THUMBNAIL_SIZE = { width: 320, height: 180 };
const WINDOW_LIST_TIMEOUT_MS = 8_000;

export class DesktopContextService {
  /** Ventanas del ultimo inventario, indexadas por identificador emitido. */
  private records = new Map<string, DesktopWindowRecord>();

  private readonly windowControls = new DesktopWindowControls(
    (script) => runEncodedPowerShell(script, WINDOW_LIST_TIMEOUT_MS),
  );

  /** Inventario de ventanas candidatas. No lee el contenido de ninguna. */
  async listApps(): Promise<DesktopContextInventory> {
    const { inventory, records } = await buildInventory({
      listWindows: () => this.windowControls.listWindows(),
      getWindowSources: () => this.readWindowSources(),
      ownWindowTitles: () => readOwnWindowTitles(),
      ownPid: process.pid,
      platform: process.platform,
    });

    this.records = new Map(records.map((record) => [record.id, record]));
    return inventory;
  }

  /** Extrae el contenido de una ventana previamente inventariada. */
  async captureApp(appId: unknown): Promise<DesktopAppContextAttachment> {
    if (!isValidCandidateId(appId)) {
      throw new Error('Identificador de aplicacion invalido.');
    }
    const record = this.records.get(appId);
    if (!record) {
      throw new Error('La aplicacion ya no esta en el inventario. Vuelve a abrir el selector.');
    }

    return extractAppContext(record, {
      availableLevels: availableLevelsFor(process.platform),
      listOfficeDocuments: () => listOpenOfficeDocuments(),
      isSidecarDocument,
      parseDocument: (filePath) => this.parseDocument(filePath),
      extractWindowText: (pid) => extractWindowText(pid),
      captureWindow: (sourceId) =>
        captureWindow(sourceId, ({ thumbnailSize }) =>
          desktopCapturer.getSources({ types: ['window'], thumbnailSize })),
      fileExists: (filePath) => fs.existsSync(filePath),
    });
  }

  /** Solo para pruebas y diagnostico: cuantas ventanas conoce el inventario. */
  getInventorySize(): number {
    return this.records.size;
  }

  private async parseDocument(filePath: string): Promise<string> {
    if (!pythonToolsService.isAvailable()) return '';
    const result = await pythonToolsService.parseDocument(filePath);
    if (!result.success) {
      console.warn(`[ContextoEscritorio] El sidecar no pudo leer el documento: ${result.error.code}`);
      return '';
    }
    return result.data.markdown ?? '';
  }

  private async readWindowSources(): Promise<WindowSource[]> {
    try {
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: THUMBNAIL_SIZE });
      return sources.slice(0, DESKTOP_CONTEXT_LIMITS.maxCandidates).map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.isEmpty() ? '' : source.thumbnail.toDataURL(),
      }));
    } catch (error) {
      console.warn(
        '[ContextoEscritorio] No se pudieron obtener miniaturas de ventanas:',
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }
}

/** Las ventanas del propio Pulse Hub no son adjuntables: el chat no se adjunta a si mismo. */
function readOwnWindowTitles(): string[] {
  try {
    return BrowserWindow.getAllWindows()
      .filter((window) => !window.isDestroyed())
      .map((window) => window.getTitle());
  } catch {
    return [];
  }
}
