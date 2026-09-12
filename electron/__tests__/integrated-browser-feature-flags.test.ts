import { describe, expect, it } from 'vitest';
import {
  BROWSER_CAPABILITY_KEYS,
  DEFAULT_BROWSER_CAPABILITY_FLAGS,
  readBrowserCapabilityFlags,
} from '../integrated-browser/feature-flags';

describe('flags de capacidades del navegador', () => {
  it('activa sólo herramientas P0 por defecto', () => {
    expect(readBrowserCapabilityFlags({})).toEqual(DEFAULT_BROWSER_CAPABILITY_FLAGS);
    expect(DEFAULT_BROWSER_CAPABILITY_FLAGS.downloads).toBe(true);
    expect(DEFAULT_BROWSER_CAPABILITY_FLAGS.pageTools).toBe(true);
    expect(DEFAULT_BROWSER_CAPABILITY_FLAGS.encryptedSync).toBe(false);
  });

  it('acepta valores booleanos explícitos', () => {
    const flags = readBrowserCapabilityFlags({
      BROWSER_DOWNLOADS_ENABLED: 'off',
      BROWSER_SESSION_RESTORE_ENABLED: 'YES',
    });
    expect(flags.downloads).toBe(false);
    expect(flags.sessionRestore).toBe(true);
  });

  it('degrada valores desconocidos al default seguro', () => {
    const flags = readBrowserCapabilityFlags({
      BROWSER_ENCRYPTED_SYNC_ENABLED: 'quizá',
      BROWSER_PAGE_TOOLS_ENABLED: 'desconocido',
    });
    expect(flags.encryptedSync).toBe(false);
    expect(flags.pageTools).toBe(true);
  });

  it('mantiene contrato cerrado y permite apagar cada capacidad sin ambigüedad', () => {
    const env = Object.fromEntries(BROWSER_CAPABILITY_KEYS.map((key) => [
      `BROWSER_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}_ENABLED`, ' off ',
    ]));
    const flags = readBrowserCapabilityFlags(env);
    expect(Object.keys(flags)).toEqual([...BROWSER_CAPABILITY_KEYS]);
    expect(Object.values(flags).every((value) => value === false)).toBe(true);
  });
});
