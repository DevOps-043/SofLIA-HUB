import { describe, expect, it, vi } from 'vitest';
import { prepareWhatsAppTeam } from '../wa-agent/agent-team';
import type { AgentLoopRequest } from '../wa-agent/agent-loop-types';
import { createComputerUseClient } from '../desktop-agent/gemini-cu/client';
import { createDesktopTaskPlan } from '../desktop-agent/plan-runtime';
import { DEFAULT_CONFIG } from '../desktop-agent/agent-config';
import type { GoogleGenerativeAI } from '@google/generative-ai';

describe('Integración de equipos en main', () => {
  it('WhatsApp no distribuye historial de grupo, memoria, identificadores ni permisos a workers', async () => {
    const generate = vi.fn().mockResolvedValue({ text: 'Aporte seguro' });
    const request = {
      userMessage: 'Crea un documento de ventas', isGroup: true, groupPassiveHistory: 'historial privado',
      senderNumber: 'numero-privado', jid: 'grupo-privado', options: { skipConfirmations: true },
      agent: { getGenAiClient: () => ({ models: { generateContent: generate } }) },
    } as unknown as AgentLoopRequest;
    const result = await prepareWhatsAppTeam(request);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result).toContain('Aporte seguro');
    const params = generate.mock.calls[0][0];
    expect(params.config).not.toHaveProperty('tools');
    expect(JSON.stringify(params)).not.toMatch(/historial privado|numero-privado|grupo-privado|skipConfirmations/);
  });
  it('Computer Use entrega aportes al controlador y sólo el controlador recibe herramientas e imagen', async () => {
    const generate = vi.fn().mockImplementation(async (params) => ({ text: params.config?.tools ? 'Fin' : 'Plan independiente' }));
    const client = createComputerUseClient({
      apiKey: 'prueba', model: 'modelo-elegido', environment: 'ENVIRONMENT_BROWSER',
      loadSdk: () => ({ GoogleGenAI: class { models = { generateContent: generate }; }, createPartFromFunctionResponse: () => ({}) }),
    });
    await client.iniciar('Abre el panel y revisa sus datos', 'captura-privada', { text: 'Datos de la página' });
    expect(generate).toHaveBeenCalledTimes(3);
    for (const [params] of generate.mock.calls.slice(0, 2)) {
      expect(params.config).not.toHaveProperty('tools');
      expect(JSON.stringify(params)).not.toContain('captura-privada');
      expect(params.model).toBe('modelo-elegido');
    }
    const final = generate.mock.calls[2][0];
    expect(final.config.tools).toEqual([{ computerUse: { environment: 'ENVIRONMENT_BROWSER' } }]);
    expect(JSON.stringify(final.contents)).toContain('Plan independiente');
    expect(JSON.stringify(final.contents)).toContain('captura-privada');
  });
  it('cancelar especialistas de Computer Use impide iniciar el controlador', async () => {
    const controller = new AbortController(); let resolve!: (value: { text: string }) => void;
    const pending = new Promise<{ text: string }>(done => { resolve = done; });
    const generate = vi.fn(() => pending);
    const client = createComputerUseClient({
      apiKey: 'prueba', model: 'modelo', environment: 'ENVIRONMENT_DESKTOP',
      loadSdk: () => ({ GoogleGenAI: class { models = { generateContent: generate }; }, createPartFromFunctionResponse: () => ({}) }),
    });
    const result = client.iniciar('modo equipo: revisa la aplicación', 'imagen', undefined, controller.signal);
    await Promise.resolve(); controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    resolve({ text: 'Tarde' }); await Promise.resolve(); await Promise.resolve();
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('planificación legacy incorpora aportes y conserva validación del plan', async () => {
    const generateContent = vi.fn().mockImplementation(async input => ({ response: { text: () => typeof input === 'string' ? 'Aporte legacy' : JSON.stringify({ goal: 'Objetivo', subGoals: ['Paso'], estimatedSteps: 1 }) } }));
    const ai = { getGenerativeModel: vi.fn(() => ({ generateContent })) } as unknown as GoogleGenerativeAI;
    const result = await createDesktopTaskPlan({ ai, config: { ...DEFAULT_CONFIG, hierarchicalPlanningEnabled: false }, task: 'Abre la app y revisa los datos', screenshotBase64: 'imagen' });
    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(generateContent.mock.calls[2][0])).toContain('Aporte legacy');
    expect(result.taskPlan.subGoals).toEqual(['Paso']);
  });
});
