import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog, type BrowserWindow } from 'electron';
import { BROWSER_DOWNLOAD_STATES, type BrowserDownloadState, type BrowserRuntimeDiagnostic } from './platform-types';

export const DIAGNOSTIC_REVIEW_TTL_MS = 5 * 60_000;
export const MAX_DIAGNOSTIC_BYTES = 64 * 1024;

interface DiagnosticInput {
  startedAt: number;
  runtime: BrowserRuntimeDiagnostic;
  tabs: number;
  liveViews: number;
  detachedWindows: number;
  groups: number;
  downloadStates: readonly BrowserDownloadState[];
}

type MetricSource = 'tab-registry' | 'window-registry' | 'group-registry' | 'retained-downloads';
type MetricId = 'tabs.logical' | 'tabs.liveViews' | 'windows.detached' | 'tabs.groups'
  | 'downloads.retained' | `downloads.${BrowserDownloadState}`;

export interface BrowserDiagnosticReport {
  schemaVersion: 1;
  scope: 'local-profile';
  period: { startedAt: string; capturedAt: string };
  runtime: {
    appVersion: string | null;
    electronVersion: string | null;
    chromiumVersion: string | null;
    nodeVersion: string | null;
    profileKind: 'authenticated';
    privacyProtectionEnabled: boolean;
    managedPolicyLoaded: boolean;
  };
  metrics: Array<{ id: MetricId; value: number; source: MetricSource; aggregation: 'snapshot' }>;
}

/** Proyección explícita: nunca serializar state, registros o errores del navegador. */
export function buildBrowserDiagnosticReport(input: DiagnosticInput, capturedAt = Date.now()): BrowserDiagnosticReport {
  if (!Number.isSafeInteger(input.startedAt) || input.startedAt < 0 || !Number.isSafeInteger(capturedAt)
    || capturedAt < input.startedAt || capturedAt > 8_640_000_000_000_000
    || input.runtime.profileKind !== 'authenticated') throw new Error('No se puede preparar el diagnóstico del perfil actual.');
  const metrics: BrowserDiagnosticReport['metrics'] = [];
  const add = (id: MetricId, value: number, maximum: number, source: MetricSource) => {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error('Los conteos del diagnóstico no son válidos.');
    metrics.push({ id, value, source, aggregation: 'snapshot' });
  };
  add('tabs.logical', input.tabs, 500, 'tab-registry');
  add('tabs.liveViews', input.liveViews, 8, 'tab-registry');
  add('windows.detached', input.detachedWindows, 4, 'window-registry');
  add('tabs.groups', input.groups, 500, 'group-registry');
  if (input.liveViews > input.tabs || input.detachedWindows > input.liveViews) throw new Error('El estado del diagnóstico no es consistente.');
  add('downloads.retained', input.downloadStates.length, 200, 'retained-downloads');
  if (input.downloadStates.some((state) => !BROWSER_DOWNLOAD_STATES.includes(state))) throw new Error('El estado de descargas no es válido.');
  for (const state of BROWSER_DOWNLOAD_STATES) {
    add(`downloads.${state}`, input.downloadStates.filter((value) => value === state).length, 200, 'retained-downloads');
  }
  return {
    schemaVersion: 1, scope: 'local-profile',
    period: { startedAt: new Date(input.startedAt).toISOString(), capturedAt: new Date(capturedAt).toISOString() },
    runtime: {
      appVersion: safeVersion(input.runtime.appVersion), electronVersion: safeVersion(input.runtime.electronVersion),
      chromiumVersion: safeVersion(input.runtime.chromiumVersion), nodeVersion: safeVersion(input.runtime.nodeVersion),
      profileKind: 'authenticated', privacyProtectionEnabled: input.runtime.protectionLevel === 'balanced' || input.runtime.protectionLevel === 'strict',
      managedPolicyLoaded: input.runtime.managed === true,
    },
    metrics,
  };
}

function safeVersion(value: unknown): string | null {
  return typeof value === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:\.\d{1,4})?(?:-(?:alpha|beta|rc)\.\d{1,4})?$/.test(value) ? value : null;
}

interface DiagnosticExportContext {
  scopeId: string;
  generation: number;
  changing: boolean;
  authenticated: boolean;
  parent: BrowserWindow | null;
}

export interface BrowserDiagnosticExportResult { cancelled: boolean; exported: boolean }
class DiagnosticExportRejected extends Error {}

/** El titular del perfil autoriza el artefacto local, no su envío a soporte. */
export class BrowserDiagnosticExporter {
  private busy = false;
  constructor(private readonly getContext: () => DiagnosticExportContext, private readonly collect: () => DiagnosticInput) {}

  async exportFromDialog(): Promise<BrowserDiagnosticExportResult> {
    if (this.busy) throw new DiagnosticExportRejected('Ya hay una exportación de diagnóstico pendiente.');
    this.busy = true;
    try {
      const initial = { ...this.getContext() };
      const parent = initial.parent;
      const expiresAt = Date.now() + DIAGNOSTIC_REVIEW_TTL_MS;
      const assertCurrent = () => {
        const current = this.getContext();
        if (!initial.authenticated || !current.authenticated || !parent || parent.isDestroyed() || current.parent !== parent
          || current.changing || initial.scopeId !== current.scopeId || initial.generation !== current.generation) {
          throw new DiagnosticExportRejected('El perfil o la ventana cambió. Vuelve a solicitar el diagnóstico.');
        }
        if (Date.now() >= expiresAt) throw new DiagnosticExportRejected('La confirmación venció. Vuelve a solicitar el diagnóstico.');
      };
      assertCurrent();
      if (!parent) throw new DiagnosticExportRejected('El navegador no está iniciado.');
      const report = buildBrowserDiagnosticReport(this.collect());
      const serialized = JSON.stringify(report, null, 2) + '\n';
      if (Buffer.byteLength(serialized, 'utf8') > MAX_DIAGNOSTIC_BYTES) throw new DiagnosticExportRejected('El diagnóstico supera el tamaño permitido.');
      const consent = await dialog.showMessageBox(parent, {
        type: 'question', title: 'Exportar diagnóstico del navegador', message: '¿Quieres guardar un diagnóstico local?',
        detail: 'Incluye versiones y conteos actuales de pestañas, vistas, grupos y estados de descargas retenidas. No incluye URLs, historial, nombres de archivos, contraseñas ni contenido. No se envía automáticamente a nadie. Los conteos son una instantánea, no totales históricos.',
        buttons: ['Guardar diagnóstico', 'Cancelar'], defaultId: 1, cancelId: 1, noLink: true,
      });
      assertCurrent();
      if (consent.response !== 0) return { cancelled: true, exported: false };
      const selection = await dialog.showSaveDialog(parent, {
        title: 'Guardar diagnóstico en un archivo nuevo', defaultPath: 'diagnostico-navegador.json',
        filters: [{ name: 'Diagnóstico JSON', extensions: ['json'] }],
      });
      assertCurrent();
      if (selection.canceled || !selection.filePath) return { cancelled: true, exported: false };
      const destination = selection.filePath;
      if (!path.isAbsolute(destination) || path.extname(destination).toLowerCase() !== '.json') throw new DiagnosticExportRejected('Elige un destino JSON válido.');
      const temporary = path.join(path.dirname(destination), `.pulse-diagnostic-${randomUUID()}.tmp`);
      let created = false;
      try {
        const handle = await fs.open(temporary, 'wx', 0o600);
        created = true;
        try { await handle.writeFile(serialized, 'utf8'); await handle.sync(); }
        finally { await handle.close(); }
        assertCurrent();
        // Enlace exclusivo: publica completo y rechaza incluso symlinks existentes.
        await fs.link(temporary, destination);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new DiagnosticExportRejected('El destino ya existe. Elige un archivo nuevo; no se sobrescribió.');
        throw error;
      } finally {
        if (created) await fs.unlink(temporary).catch(() => {
          console.warn('[Navegador][Diagnóstico] No se pudo retirar un temporal saneado.');
        });
      }
      return { cancelled: false, exported: true };
    } catch (error) {
      if (error instanceof DiagnosticExportRejected) throw error;
      throw new DiagnosticExportRejected('No se pudo exportar el diagnóstico. Elige una carpeta local accesible y vuelve a intentarlo.');
    } finally { this.busy = false; }
  }
}
