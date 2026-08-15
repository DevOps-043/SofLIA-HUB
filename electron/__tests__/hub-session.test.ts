import { beforeEach, describe, expect, it, vi } from 'vitest';

const almacen = vi.hoisted(() => ({ archivos: new Map<string, Buffer>() }));
const cifrado = vi.hoisted(() => ({ disponible: true }));

/** XOR simetrico: basta para que el valor no se lea en el buffer. */
const ofuscar = vi.hoisted(() => (datos: Buffer): Buffer => {
  const salida = Buffer.alloc(datos.length);
  for (let i = 0; i < datos.length; i += 1) salida[i] = datos[i] ^ 0x5a;
  return salida;
});

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/userData' },
  // Cifrado falso pero OPACO: el valor no debe poder leerse en el buffer, que
  // es justo lo que la prueba verifica del almacenamiento real.
  safeStorage: {
    isEncryptionAvailable: () => cifrado.disponible,
    encryptString: (valor: string) => Buffer.concat([Buffer.from('ENC1'), ofuscar(Buffer.from(valor, 'utf8'))]),
    decryptString: (buffer: Buffer) => {
      if (buffer.subarray(0, 4).toString() !== 'ENC1') throw new Error('no descifrable');
      return ofuscar(Buffer.from(buffer.subarray(4))).toString('utf8');
    },
  },
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: (ruta: string) => almacen.archivos.has(ruta),
    writeFileSync: (ruta: string, datos: Buffer) => { almacen.archivos.set(ruta, Buffer.from(datos)); },
    readFileSync: (ruta: string) => {
      const datos = almacen.archivos.get(ruta);
      if (!datos) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return datos;
    },
    unlinkSync: (ruta: string) => { almacen.archivos.delete(ruta); },
  },
}));

import {
  clearHubRefreshToken,
  hasStoredHubSession,
  readHubRefreshToken,
  saveHubRefreshToken,
} from '../main/hub-session-store';

describe('custodia del token de sesion del Hub', () => {
  beforeEach(() => {
    almacen.archivos.clear();
    cifrado.disponible = true;
    vi.clearAllMocks();
  });

  it('guarda el token cifrado, nunca en claro', () => {
    expect(saveHubRefreshToken('token-secreto')).toBe(true);
    const guardado = [...almacen.archivos.values()][0];
    // El valor no aparece legible en el archivo.
    expect(guardado.toString('utf8')).not.toContain('token-secreto');
    expect(guardado.toString('latin1')).not.toContain('token-secreto');
  });

  it('lo recupera intacto', () => {
    saveHubRefreshToken('token-secreto');
    expect(readHubRefreshToken()).toBe('token-secreto');
  });

  it('SIN cifrado del sistema NO persiste nada', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    cifrado.disponible = false;

    expect(saveHubRefreshToken('token-secreto')).toBe(false);
    // Un refresh token en claro en userData seria una credencial de larga vida
    // legible por cualquier proceso del equipo. Se prefiere perder la sesion.
    expect(almacen.archivos.size).toBe(0);
    aviso.mockRestore();
  });

  it('no interpreta como texto plano un archivo que no puede descifrar', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    almacen.archivos.set('C:/userData/hub-session.enc', Buffer.from('basura-sin-cifrar'));

    expect(readHubRefreshToken()).toBeNull();
    aviso.mockRestore();
  });

  it('un token vacio no se guarda', () => {
    expect(saveHubRefreshToken('   ')).toBe(false);
    expect(almacen.archivos.size).toBe(0);
  });

  it('borrar deja el disco sin rastro', () => {
    saveHubRefreshToken('token-secreto');
    expect(hasStoredHubSession()).toBe(true);

    clearHubRefreshToken();

    expect(hasStoredHubSession()).toBe(false);
    expect(readHubRefreshToken()).toBeNull();
  });

  it('sin token guardado devuelve null sin lanzar', () => {
    expect(readHubRefreshToken()).toBeNull();
    expect(hasStoredHubSession()).toBe(false);
  });
});
