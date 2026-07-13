import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isSidecarDocument,
  PythonToolsService,
  SIDECAR_DOCUMENT_EXTENSIONS,
} from '../python-tools-service';

interface ServiceInternals {
  getPythonPath: () => string;
  getSidecarPath: () => string;
  getPrivacyConfigPath: () => string;
  send: (cmd: string, params: Record<string, unknown>, timeoutMs: number) => Promise<unknown>;
}

let tempDir: string;

/** Servicio con rutas apuntando a un directorio temporal (nada real en disco). */
function createService(options: { runtimeInstalled: boolean }) {
  const service = new PythonToolsService();
  const internals = service as unknown as ServiceInternals;

  const pythonPath = path.join(tempDir, 'python.exe');
  const sidecarPath = path.join(tempDir, 'main.py');
  if (options.runtimeInstalled) {
    fs.writeFileSync(pythonPath, '');
    fs.writeFileSync(sidecarPath, '');
  }

  vi.spyOn(internals, 'getPythonPath').mockReturnValue(pythonPath);
  vi.spyOn(internals, 'getSidecarPath').mockReturnValue(sidecarPath);
  vi.spyOn(internals, 'getPrivacyConfigPath').mockReturnValue(path.join(tempDir, 'privacy-config.json'));
  return { service, internals };
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-pytools-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('isSidecarDocument', () => {
  it('reconoce los formatos que solo el sidecar sabe leer', () => {
    expect(SIDECAR_DOCUMENT_EXTENSIONS).toContain('.pdf');
    expect(isSidecarDocument('C:/facturas/marzo.PDF')).toBe(true);
    expect(isSidecarDocument('/home/ana/ventas.xlsx')).toBe(true);
    expect(isSidecarDocument('propuesta.pptx')).toBe(true);
    expect(isSidecarDocument('informe.docx')).toBe(true);
  });

  it('deja pasar los formatos que ya lee el camino de TypeScript', () => {
    expect(isSidecarDocument('notas.txt')).toBe(false);
    expect(isSidecarDocument('config.json')).toBe(false);
    expect(isSidecarDocument('sin-extension')).toBe(false);
  });
});

describe('degradación cuando Python no está instalado', () => {
  it('no lanza el proceso y devuelve SIDECAR_UNAVAILABLE con un mensaje accionable', async () => {
    const { service } = createService({ runtimeInstalled: false });

    expect(service.isAvailable()).toBe(false);
    const result = await service.parseDocument('C:/facturas/marzo.pdf');

    expect(result.success).toBe(false);
    if (result.success) throw new Error('inalcanzable');
    expect(result.error.code).toBe('SIDECAR_UNAVAILABLE');
    expect(result.error.recoverable).toBe(true);
    expect(result.error.message).toContain('python:setup');
    // Nada de procesos zombis: el arranque es perezoso y ni se intentó.
    expect(service.getStatus().running).toBe(false);
  });
});

describe('configuración de privacidad', () => {
  it('viene DESACTIVADA por defecto (opt-in: no cambia el comportamiento sin consentimiento)', () => {
    const { service } = createService({ runtimeInstalled: true });
    expect(service.getPrivacyConfig().redactDocuments).toBe(false);
    expect(service.getStatus().privacy.redactDocuments).toBe(false);
  });

  it('persiste el toggle en disco y lo relee en el siguiente arranque', () => {
    const { service } = createService({ runtimeInstalled: true });
    service.setPrivacyConfig({ redactDocuments: true });

    // Otro servicio (equivale a reiniciar la app) lee el mismo archivo.
    const { service: reiniciado } = createService({ runtimeInstalled: true });
    expect(reiniciado.getPrivacyConfig().redactDocuments).toBe(true);
  });

  it('pide la redacción al sidecar solo si el usuario la activó', async () => {
    const { service, internals } = createService({ runtimeInstalled: true });
    const send = vi.spyOn(internals, 'send').mockResolvedValue({ success: true, data: {} });

    await service.parseDocument('C:/facturas/marzo.pdf');
    expect(send.mock.calls[0][1]).toMatchObject({ redact: false });

    service.setPrivacyConfig({ redactDocuments: true });
    await service.parseDocument('C:/facturas/marzo.pdf');
    // La redacción ocurre DENTRO de Python: el dato sensible nunca llega aquí.
    expect(send.mock.calls[1][1]).toMatchObject({ redact: true });
  });
});
