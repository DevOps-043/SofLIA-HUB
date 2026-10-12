import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaInputService, sanitizeProviderError } from '../media-input/service';

const CLAVE = 'AIza-clave-de-prueba-suficientemente-larga';

function crearSdk(overrides: {
  upload?: (params: any) => Promise<any>;
  get?: (params: any) => Promise<any>;
  delete?: (params: any) => Promise<any>;
} = {}) {
  const files = {
    upload: vi.fn(overrides.upload ?? (async () => ({ name: 'files/a1', uri: 'https://archivos.test/a1', mimeType: 'video/mp4', state: 'ACTIVE' }))),
    get: vi.fn(overrides.get ?? (async () => ({ name: 'files/a1', uri: 'https://archivos.test/a1', mimeType: 'video/mp4', state: 'ACTIVE' }))),
    delete: vi.fn(overrides.delete ?? (async () => ({}))),
  };
  return {
    files,
    // Una funcion flecha no puede invocarse con `new`, y el cliente se
    // construye con `new mod.GoogleGenAI(...)`.
    module: { GoogleGenAI: vi.fn().mockImplementation(function () { return { files }; }) },
  };
}

function crearServicio(sdk: ReturnType<typeof crearSdk>, size = 1_000) {
  return new MediaInputService({
    loadSdk: () => sdk.module as any,
    statFile: async () => ({ size }),
  });
}

describe('MediaInputService', () => {
  beforeEach(() => { vi.useRealTimers(); });

  it('MEDIA-SVC-001: sube un archivo admitido y devuelve su URI con caducidad', async () => {
    const sdk = crearSdk();
    const registro = await crearServicio(sdk).upload({ path: 'C:/videos/demo.mp4', mimeType: 'video/mp4', apiKey: CLAVE });

    expect(registro.state).toBe('ready');
    expect(registro.uri).toBe('https://archivos.test/a1');
    expect(registro.expiresAt).toBeTruthy();
    expect(sdk.files.upload).toHaveBeenCalledWith(expect.objectContaining({ file: 'C:/videos/demo.mp4' }));
  });

  it('MEDIA-SVC-002: espera a que el proveedor termine de procesar', async () => {
    const sdk = crearSdk({
      upload: async () => ({ name: 'files/a1', state: 'PROCESSING' }),
    });
    sdk.files.get
      .mockResolvedValueOnce({ name: 'files/a1', state: 'PROCESSING' })
      .mockResolvedValueOnce({ name: 'files/a1', uri: 'https://archivos.test/a1', mimeType: 'video/mp4', state: 'ACTIVE' });

    const registro = await crearServicio(sdk).upload({ path: '/tmp/demo.mp4', mimeType: 'video/mp4', apiKey: CLAVE });

    expect(registro.state).toBe('ready');
    expect(sdk.files.get).toHaveBeenCalledTimes(2);
  }, 15_000);

  it('MEDIA-SVC-003: un procesamiento que no termina aborta con su estado, sin colgar el turno', async () => {
    const sdk = crearSdk({ upload: async () => ({ name: 'files/a1', state: 'PROCESSING' }) });
    sdk.files.get.mockResolvedValue({ name: 'files/a1', state: 'PROCESSING' });
    let ahora = 0;
    const servicio = new MediaInputService({
      loadSdk: () => sdk.module as any,
      statFile: async () => ({ size: 10 }),
      // El reloj avanza mas rapido que la espera real: el limite se alcanza
      // sin que la prueba tarde dos minutos.
      now: () => (ahora += 60_000),
    });

    const registro = await servicio.upload({ path: '/tmp/demo.mp4', mimeType: 'video/mp4', apiKey: CLAVE });

    expect(registro.state).toBe('failed');
    expect(registro.error).toContain('no termino de procesar');
  }, 15_000);

  it('MEDIA-SVC-004: un formato no admitido se rechaza sin llamar al proveedor', async () => {
    const sdk = crearSdk();
    const registro = await crearServicio(sdk).upload({ path: '/tmp/a.zip', mimeType: 'application/zip', apiKey: CLAVE });

    expect(registro.state).toBe('failed');
    expect(sdk.files.upload).not.toHaveBeenCalled();
  });

  it('MEDIA-SVC-005: un archivo que ya no existe se declara, no se inventa', async () => {
    const sdk = crearSdk();
    const servicio = new MediaInputService({
      loadSdk: () => sdk.module as any,
      statFile: async () => { throw new Error('ENOENT'); },
    });

    const registro = await servicio.upload({ path: '/tmp/ido.mp4', mimeType: 'video/mp4', apiKey: CLAVE });

    expect(registro.state).toBe('failed');
    expect(registro.error).toContain('ya no esta disponible');
  });

  it('MEDIA-SVC-006: un archivo sobre el limite del proveedor se rechaza antes de subir', async () => {
    const sdk = crearSdk();
    const registro = await crearServicio(sdk, 3 * 1024 * 1024 * 1024)
      .upload({ path: '/tmp/enorme.mp4', mimeType: 'video/mp4', apiKey: CLAVE });

    expect(registro.state).toBe('failed');
    expect(registro.error).toContain('tamaño maximo');
    expect(sdk.files.upload).not.toHaveBeenCalled();
  });

  it('MEDIA-SVC-007: cancelar durante el procesamiento suelta el archivo remoto', async () => {
    const sdk = crearSdk({ upload: async () => ({ name: 'files/a1', state: 'PROCESSING' }) });
    sdk.files.get.mockResolvedValue({ name: 'files/a1', state: 'PROCESSING' });
    const servicio = crearServicio(sdk);

    const pendiente = servicio.upload({ path: '/tmp/demo.mp4', mimeType: 'video/mp4', apiKey: CLAVE });
    // El identificador es determinista dentro de la instancia: primera subida.
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    const enCurso = [...(servicio as any).uploads.keys()][0] as string;
    servicio.cancel(enCurso);
    const registro = await pendiente;

    expect(registro.state).toBe('cancelled');
    expect(registro.uri).toBeUndefined();
    expect(sdk.files.delete).toHaveBeenCalledWith({ name: 'files/a1' });
  }, 15_000);

  it('MEDIA-SVC-008: un fallo de red se reporta saneado, sin clave ni ruta local', async () => {
    const sdk = crearSdk({
      upload: async () => { throw new Error('fallo con key=AIzaSyD-secreto en C:\\Users\\ana\\videos\\demo.mp4'); },
    });

    const registro = await crearServicio(sdk).upload({ path: 'C:/Users/ana/videos/demo.mp4', mimeType: 'video/mp4', apiKey: CLAVE });

    expect(registro.state).toBe('failed');
    expect(registro.error).not.toContain('AIzaSyD-secreto');
    expect(registro.error).not.toContain('Users');
  });

  it('MEDIA-SVC-009: una referencia caducada se detecta antes de reutilizarse', () => {
    const servicio = crearServicio(crearSdk());

    expect(servicio.isExpired({ expiresAt: new Date(Date.now() - 1_000).toISOString() })).toBe(true);
    expect(servicio.isExpired({ expiresAt: new Date(Date.now() + 60_000).toISOString() })).toBe(false);
    expect(servicio.isExpired({ expiresAt: undefined })).toBe(false);
  });

  it('MEDIA-SVC-010: liberar borra el archivo remoto y olvida el registro', async () => {
    const sdk = crearSdk();
    const servicio = crearServicio(sdk);
    const registro = await servicio.upload({ path: '/tmp/demo.mp4', mimeType: 'video/mp4', apiKey: CLAVE });

    await expect(servicio.release(registro.uploadId, CLAVE)).resolves.toBe(true);
    expect(sdk.files.delete).toHaveBeenCalledWith({ name: 'files/a1' });
    expect(servicio.status(registro.uploadId)).toBeNull();
  });

  it('MEDIA-SVC-011: sin SDK disponible la subida falla declarandolo', async () => {
    const servicio = new MediaInputService({ loadSdk: () => null, statFile: async () => ({ size: 10 }) });

    const registro = await servicio.upload({ path: '/tmp/demo.mp4', mimeType: 'video/mp4', apiKey: CLAVE });

    expect(servicio.disponible()).toBe(false);
    expect(registro.state).toBe('failed');
  });
});

describe('saneamiento de errores del proveedor', () => {
  it('MEDIA-SVC-012: elimina claves y rutas locales del mensaje', () => {
    const saneado = sanitizeProviderError(new Error('AIzaSyABC123_secreto falló en /home/ana/videos/demo.mp4'));

    expect(saneado).not.toContain('AIzaSyABC123_secreto');
    expect(saneado).not.toContain('/home/ana');
  });
});
