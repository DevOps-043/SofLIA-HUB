import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../desktop-agent/agent-config';

const mocks = vi.hoisted(() => ({
  runLoop: vi.fn(),
  createClient: vi.fn(() => ({ disponible: () => true })),
  createIntegratedDriver: vi.fn(() => ({ capturar: vi.fn(), ejecutar: vi.fn() })),
}));

vi.mock('../desktop-agent/gemini-cu/client', () => ({ createComputerUseClient: mocks.createClient }));
vi.mock('../desktop-agent/gemini-cu/loop', () => ({ runComputerUseLoop: mocks.runLoop }));
vi.mock('../integrated-browser', () => ({ createIntegratedBrowserCuDriver: mocks.createIntegratedDriver }));

const { runComputerUseBrowserTask } = await import('../desktop-agent/service-computer-use');

describe('Ciclo de vida de Computer Use integrado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restaura idle y publica agotamiento sin perder la sesión visible', async () => {
    mocks.runLoop.mockResolvedValue({ estado: 'presupuesto_agotado', mensaje: 'límite', pasos: 90 });
    const integratedBrowser = {
      openForAgent: vi.fn(async () => undefined),
      releaseAgentControl: vi.fn(),
    };
    const service = {
      apiKey: 'test-key',
      config: { ...DEFAULT_CONFIG, maxSteps: 60, defaultStepBudget: 40 },
      integratedBrowser,
      status: 'idle',
      currentTask: null,
      currentStep: 0,
      emit: vi.fn(),
      delay: vi.fn(async () => undefined),
    };

    const outcome = await runComputerUseBrowserTask(service, 'Inicia sesión y abre Empresas', { backend: 'browser' });

    expect(mocks.runLoop).toHaveBeenCalledWith(expect.objectContaining({ maxSteps: 90 }));
    expect(outcome).toMatchObject({ estado: 'presupuesto_agotado', pasosEjecutados: 90 });
    expect(outcome?.mensaje).toContain('página, cookies y sesión');
    expect(service.emit).toHaveBeenCalledWith('task-budget-exhausted', expect.objectContaining({ maxSteps: 90 }));
    expect(service.status).toBe('idle');
    expect(service.currentTask).toBeNull();
    expect(service.currentStep).toBe(0);
    expect(integratedBrowser.releaseAgentControl).toHaveBeenCalledTimes(1);
  });
});
