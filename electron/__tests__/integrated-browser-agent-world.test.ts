import { describe, expect, it, vi } from 'vitest';
import {
  AGENT_WORLD_ID,
  runInAgentWorld,
  supportsAgentWorld,
  type AgentWorldTarget,
} from '../integrated-browser/agent-world';

describe('mundo aislado del agente', () => {
  it('ejecuta en el mundo aislado cuando el destino lo admite', async () => {
    const executeJavaScript = vi.fn(async () => 'mundo principal');
    const executeJavaScriptInIsolatedWorld = vi.fn(async () => 'mundo aislado');
    const target: AgentWorldTarget = { executeJavaScript, executeJavaScriptInIsolatedWorld };

    const resultado = await runInAgentWorld(target, 'document.title');

    expect(resultado).toBe('mundo aislado');
    expect(executeJavaScript).not.toHaveBeenCalled();
    expect(executeJavaScriptInIsolatedWorld).toHaveBeenCalledWith(
      AGENT_WORLD_ID,
      [{ code: 'document.title' }],
      true,
    );
  });

  it('no usa el mundo 0 ni el 999 de contextIsolation de Electron', () => {
    expect(AGENT_WORLD_ID).not.toBe(0);
    expect(AGENT_WORLD_ID).not.toBe(999);
    expect(AGENT_WORLD_ID).toBeGreaterThan(0);
    expect(AGENT_WORLD_ID).toBeLessThanOrEqual(536_870_911);
  });

  it('cae al mundo principal cuando el destino no expone la API', async () => {
    const executeJavaScript = vi.fn(async () => 'mundo principal');
    const target: AgentWorldTarget = { executeJavaScript };

    expect(supportsAgentWorld(target)).toBe(false);
    // Un marco secundario solo tiene `executeJavaScript`: perder el aislamiento
    // degrada la garantia, pero dejar al agente sin lectura lo rompe.
    await expect(runInAgentWorld(target, 'document.title')).resolves.toBe('mundo principal');
    expect(executeJavaScript).toHaveBeenCalledWith('document.title', true);
  });

  it('propaga el fallo del mundo aislado en vez de reintentar en el principal', async () => {
    const executeJavaScript = vi.fn(async () => 'mundo principal');
    const executeJavaScriptInIsolatedWorld = vi.fn(async () => {
      throw new Error('contexto destruido');
    });

    await expect(
      runInAgentWorld({ executeJavaScript, executeJavaScriptInIsolatedWorld }, 'x'),
    ).rejects.toThrow('contexto destruido');
    // Reintentar en el mundo principal reintroduciria justo el problema que el
    // aislamiento resuelve: el sitio veria el registro de elementos.
    expect(executeJavaScript).not.toHaveBeenCalled();
  });
});
