import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { PythonToolsService } from './python-tools-service';
import { nativeConfirmation, trustedAppCaller } from './ipc/caller-authorization';
import { onAuthStateChange } from './main/auth-state';
import { parsePrivacyConfig, PrivacyPersistenceError } from './python/privacy-store';
import { snapshotSelectedDocument } from './python/document-snapshot';
import { assertToolsOperation, toolsFailure, validateToolsText } from './python/tools-contract';
import { createLogger } from './utils/logger';
import { withCorrelation } from './utils/correlation';
import { PythonToolsError } from './python/tools-error';
const log = createLogger('python-tools-ipc');

/** Cinco canales concretos; las rutas/documentos sólo los elige main. */
export function registerPythonToolsHandlers(runtime: PythonToolsService, getMainWindow: () => BrowserWindow | null = () => null) {
  const confirm = nativeConfirmation('Cambiar protección de documentos');
  let readBusy = false; let pickerPending = false;
  const unsubscribe = onAuthStateChange(() => { void runtime.stop().catch(() => log.warn({ code: 'SIDECAR_STOP_UNCONFIRMED' }, 'No se confirmó el cierre del lector al cambiar sesión.')); });
  const register = (channel: string, argsCount: number, run: (caller: ReturnType<typeof trustedAppCaller>, args: unknown[]) => Promise<object>) => {
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => withCorrelation(async () => {
      let caller: ReturnType<typeof trustedAppCaller> | undefined;
      try {
        caller = trustedAppCaller(event, () => [getMainWindow()]); caller.assert();
        if (args.length !== argsCount) throw new Error('TOOLS_INVALID_INPUT');
        const result = await run(caller, args); caller.assert();
        log.info({ channel, success: true }, 'Operación del lector local completada.'); return { success: true, ...result };
      } catch (error) {
        const raw = error instanceof Error ? error.message : undefined;
        const code = raw === 'context_invalid' ? 'TOOLS_CANCELLED' : raw;
        const failure = toolsFailure(code);
        const cleanupPending = code === 'DOCUMENT_CLEANUP_PENDING' || error instanceof PrivacyPersistenceError && error.cleanupPending;
        log.warn({ channel, code: failure.error.code }, 'Operación del lector local rechazada o sin confirmar.');
        return { success: false, code: failure.error.code, error: failure.error.message,
          ...(raw === 'approval_cancelled' || code === 'TOOLS_CANCELLED' ? { cancelled: true } : {}),
          ...(cleanupPending ? { cleanupPending: true, recoveryRequired: true } : {}),
          ...(error instanceof PrivacyPersistenceError && error.uncertain ? { uncertain: true, recoveryRequired: true } : {}) };
      } finally { caller?.dispose(); }
    }));
  };
  register('pytools:status', 0, async () => {
    const status = runtime.getStatus(); return { status: { available: status.available, running: status.running,
      privacy: parsePrivacyConfig(status.privacy), lastError: status.lastError ? 'El lector local no está disponible. Revisa el runtime y vuelve a intentarlo.' : null } };
  });
  register('pytools:get-privacy-config', 0, async () => ({ config: runtime.getPrivacyConfig() }));
  register('pytools:set-privacy-config', 1, async (caller, [input]) => {
    const patch = parsePrivacyConfig(input); const policy = runtime.capturePrivacyContext();
    if (!patch.redactDocuments && policy.config.redactDocuments) {
      if (!await confirm(caller.parent!, 'Desactivar la protección de documentos de este equipo permite devolver texto y tablas sin redactar a sus consumidores. No borra ni revierte datos ya compartidos.', caller.assert, caller.signal)) throw new Error('approval_cancelled');
    }
    caller.assert(); policy.assertCurrent(); return { config: runtime.setPrivacyConfig(patch) };
  });
  register('pytools:redact-text', 1, async (caller, [input]) => {
    validateToolsText(input); const result = await runtime.redactText(input, { assertCurrent: caller.assert, signal: caller.signal });
    caller.assert(); if (!result.success) throw new Error(result.error.code); return { redaction: result.data };
  });
  register('pytools:parse-document', 0, async caller => {
    if (readBusy || pickerPending) throw new Error('SIDECAR_BUSY');
    const policy = runtime.capturePrivacyContext(); readBusy = true;
    const context = { signal: caller.signal, assertCurrent: () => { caller.assert(); policy.assertCurrent(); } };
    let snapshot: Awaited<ReturnType<typeof snapshotSelectedDocument>> | undefined;
    let result: object | undefined; let failure: unknown; let cleaned = true;
    try {
      context.assertCurrent(); pickerPending = true;
      const picker = Promise.resolve().then(() => { context.assertCurrent(); return dialog.showOpenDialog(caller.parent!, { title: 'Seleccionar documento para lectura local', properties: ['openFile', 'dontAddToRecent'],
        filters: [{ name: 'Documentos admitidos', extensions: ['pdf', 'xlsx', 'xlsm', 'pptx', 'docx'] }] }); }).finally(() => { pickerPending = false; });
      const chosen = await cancellablePicker(picker, caller.signal); context.assertCurrent();
      if (chosen.canceled) return { cancelled: true };
      if (chosen.filePaths.length !== 1) throw new Error('TOOLS_INVALID_INPUT');
      snapshot = await snapshotSelectedDocument(chosen.filePaths[0], app.getPath('temp'), context.assertCurrent);
      assertToolsOperation(context);
      const parsed = await runtime.parseDocument(snapshot.path, 200, context); context.assertCurrent();
      if (!parsed.success) throw new Error(parsed.error.code); result = { document: parsed.data };
    } catch (error) { failure = error; }
    finally {
      try { if (snapshot) cleaned = await runtime.releaseDocumentCopy(snapshot.remove); }
      finally { readBusy = false; }
    }
    if (failure) { if (!cleaned) throw new PythonToolsError('DOCUMENT_CLEANUP_PENDING', failure); throw failure; }
    return { ...result, ...(!cleaned ? { recoveryRequired: true, cleanupPending: true } : {}) };
  });
  return { dispose: () => { unsubscribe(); void runtime.stop().catch(() => log.warn({ code: 'SIDECAR_STOP_UNCONFIRMED' }, 'No se confirmó el cierre del lector.')); } };
}

async function cancellablePicker<T>(picker: Promise<T>, signal: AbortSignal): Promise<T> {
  let aborted!: () => void;
  const cancellation = new Promise<never>((_resolve, reject) => { aborted = () => reject(new Error('TOOLS_CANCELLED')); signal.addEventListener('abort', aborted, { once: true }); if (signal.aborted) aborted(); });
  try { return await Promise.race([picker, cancellation]); }
  finally { signal.removeEventListener('abort', aborted); }
}
