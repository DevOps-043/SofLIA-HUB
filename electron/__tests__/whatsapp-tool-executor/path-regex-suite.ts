import { describe, expect, it } from 'vitest';
import { isBlockedPath } from './fixture';

describe('SOFLIA_BLOCKED_PATHS - regex pattern security', () => {
  it('WA-081: blocks .env paths', () => {
    expect(isBlockedPath('.env')).toBe(true);
    expect(isBlockedPath('C:\\project\\.env')).toBe(true);
    expect(isBlockedPath('.env.local')).toBe(true);
  });

  it('WA-082: blocks electron/ source files', () => {
    expect(isBlockedPath('electron/main.ts')).toBe(true);
    expect(isBlockedPath('electron\\whatsapp-agent.ts')).toBe(true);
    expect(isBlockedPath('electron/preload.js')).toBe(true);
  });

  it('WA-083/084/085/086/087/088: blocks protected project and secret patterns', () => {
    for (const blocked of ['supabase', 'lib/supabase.ts', 'SUPABASE_URL', 'api-key', 'api_key', 'API KEY', 'dist-electron', 'dist/electron', 'app.asar', 'whatsapp-agent', 'whatsapp_agent', 'SofLIA-Hub', 'SOFLIA Source', 'src/App.tsx', 'src\\services\\chat-service.ts']) {
      expect(isBlockedPath(blocked)).toBe(true);
    }
  });

  it('WA-089: allows normal user paths', () => {
    expect(isBlockedPath('C:\\Users\\fysg5\\Documents\\reporte.pdf')).toBe(false);
    expect(isBlockedPath('D:\\Downloads\\foto.jpg')).toBe(false);
    expect(isBlockedPath('C:\\Users\\fysg5\\Desktop')).toBe(false);
    expect(isBlockedPath('mis documentos')).toBe(false);
  });

  it('WA-090: allows normal file operations', () => {
    expect(isBlockedPath('C:\\Users\\fysg5\\OneDrive\\Escritorio\\archivo.txt')).toBe(false);
    expect(isBlockedPath('notas.md')).toBe(false);
    expect(isBlockedPath('C:\\Proyectos\\mi-app\\README.md')).toBe(false);
  });
});
