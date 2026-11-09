import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopInference } from '../desktop-agent/inference';
import { startContinuousObservation } from '../desktop-agent/observation-runtime';
import { attachDesktopAgentObservation } from '../desktop-agent/service-observation';
import type { DesktopAgentServiceConstructor } from '../desktop-agent/service-types';
import type { DesktopAgentService } from '../desktop-agent-service';
import { DEFAULT_CONFIG } from '../desktop-agent-types';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
beforeEach(() => { resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-qa' }); });
afterEach(() => { resetAuthStateForTests(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('Vigencia de observación Desktop', () => {
  it('stop durante modelo no admite acción tardía', async () => {
    vi.useFakeTimers(); const controller = new AbortController(); let finish!: (value: unknown) => void;
    const generateContent = vi.fn(() => new Promise(resolve => { finish = resolve; })), executeAction = vi.fn(); let running = false;
    const interval = startContinuousObservation({ objective: 'Observar', intervalMs: 1000, modelName: 'modelo-ficticio', ai: generateContent as unknown as DesktopInference,
      signal: controller.signal, isRunning: () => running, setRunning: value => { running = value; }, takeScreenshot: async () => 'captura-ficticia', quickHash: () => 'hash', executeAction, emit: vi.fn(), getErrorMessage: () => 'error' });
    await vi.advanceTimersByTimeAsync(1000); expect(generateContent).toHaveBeenCalledOnce(); controller.abort(); clearInterval(interval);
    finish('{"action":"click","x":1,"y":2}');
    for (let index = 0; index < 12; index++) await Promise.resolve();
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('revocar durante captura no envía pantalla al modelo', async () => {
    vi.useFakeTimers(); const controller = new AbortController(), generateContent = vi.fn();
    const interval = startContinuousObservation({ objective: 'Observar', intervalMs: 1000, modelName: 'ficticio', ai: generateContent as unknown as DesktopInference,
      signal: controller.signal, isRunning: () => false, setRunning: vi.fn(), takeScreenshot: async () => { controller.abort(); return 'captura'; }, quickHash: () => 'hash', executeAction: vi.fn(), emit: vi.fn(), getErrorMessage: () => 'error' });
    await vi.advanceTimersByTimeAsync(1000); clearInterval(interval); expect(generateContent).not.toHaveBeenCalled();
  });
  it('revocar en listener de observation-action impide ejecutar lo recién anunciado', async () => {
    vi.useFakeTimers(); const controller = new AbortController(), executeAction = vi.fn();
    const interval = startContinuousObservation({ objective: 'Observar', intervalMs: 1000, modelName: 'ficticio', ai: async () => '{"action":"click","x":1,"y":2}',
      signal: controller.signal, isRunning: () => false, setRunning: vi.fn(), takeScreenshot: async () => 'captura', quickHash: () => 'hash', executeAction, emit: () => controller.abort(), getErrorMessage: () => 'error' });
    await vi.advanceTimersByTimeAsync(1000); clearInterval(interval); expect(executeAction).not.toHaveBeenCalled();
  });
  it('reemplazar observación no crea otro ciclo físico hasta terminar el anterior', async () => {
    vi.useFakeTimers(); let finish!: (value: unknown) => void;
    const generateContent = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    class Fake {
      config = { ...DEFAULT_CONFIG, continuousObservationInterval: 1000 }; apiKey = 'ficticia'; observationInterval = null; observationRunning = false; status = 'idle';
      getInference = () => generateContent; calculateScreenScale = vi.fn(); takeScreenshot = vi.fn(async () => 'captura'); quickHash = () => 'hash'; executeAction = vi.fn(); emit = vi.fn();
    }
    attachDesktopAgentObservation(Fake as unknown as DesktopAgentServiceConstructor);
    const service = new Fake() as unknown as DesktopAgentService;
    await service.startObservation('Primera'); await vi.advanceTimersByTimeAsync(1000); expect(generateContent).toHaveBeenCalledOnce();
    const firstSignal = generateContent.mock.calls[0] as unknown as [unknown, { signal: AbortSignal }];
    await service.startObservation('Segunda'); await vi.advanceTimersByTimeAsync(2000); expect(generateContent).toHaveBeenCalledOnce();
    expect(firstSignal[1].signal.aborted).toBe(true);
    finish('{"action":"click","x":1,"y":1}'); for (let index = 0; index < 12; index++) await Promise.resolve();
    expect(service.executeAction).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(1000); expect(generateContent).toHaveBeenCalledTimes(2);
    setAuthState({ authenticated: true, userId: 'otra' });
    finish('{"action":"click","x":1,"y":1}'); for (let index = 0; index < 12; index++) await Promise.resolve();
    expect(service.executeAction).not.toHaveBeenCalled(); expect(service.status).toBe('idle');
    service.stopObservation();
  });
});
