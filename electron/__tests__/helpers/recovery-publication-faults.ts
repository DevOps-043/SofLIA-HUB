import fs from 'node:fs';
import { vi } from 'vitest';

/** Fallos limitados al temporal del principal ficticio, después de preparar la revisión. */
export function failRecoveryPublication(file: string, secondary: 'unlink' | 'close') {
  const primary = Object.assign(new Error(`Publicación ficticia interrumpida: ${file}`), { code: 'EIO' });
  const denied = () => Object.assign(new Error(`Recurso ficticio ocupado: ${file}`), { code: 'EACCES' });
  const ownStage = (target: unknown) => String(target).startsWith(file + '.')
    && String(target).endsWith('.tmp') && !String(target).includes('.damaged-');
  const open = fs.openSync, sync = fs.fsyncSync, close = fs.closeSync;
  const rename = fs.renameSync, unlink = fs.unlinkSync;
  let descriptor: number | undefined; let failed = false; let staged = '';
  vi.spyOn(fs, 'openSync').mockImplementation((target, flags, mode) => {
    const fd = open(target, flags, mode);
    if (flags === 'wx' && ownStage(target)) descriptor = fd;
    return fd;
  });
  vi.spyOn(fs, 'fsyncSync').mockImplementation(fd => {
    // SQLite prepara otra proyección antes: el fallo corresponde a la publicación sincronizada.
    if (secondary === 'close' && fd === descriptor) { failed = true; throw primary; }
    return sync(fd);
  });
  vi.spyOn(fs, 'closeSync').mockImplementation(fd => {
    close(fd); // El fixture sí libera el recurso real antes de simular resultado ambiguo.
    if (secondary === 'close' && failed && fd === descriptor) { descriptor = undefined; throw denied(); }
  });
  vi.spyOn(fs, 'renameSync').mockImplementation((source, destination) => {
    if (String(destination) === file) { staged = String(source); throw primary; }
    return rename(source, destination);
  });
  vi.spyOn(fs, 'unlinkSync').mockImplementation(target => {
    if (secondary === 'unlink' && String(target) === staged) throw denied();
    return unlink(target);
  });
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  return { primary, warning };
}
