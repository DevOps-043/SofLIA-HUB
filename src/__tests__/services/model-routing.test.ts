import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({ openaiConfigurado: true }));

vi.mock('../../config', () => ({
  OPENAI_API_KEY: 'test-openai-key',
  OPENAI_VECTOR_STORE_IDS: [],
  MODELS: { PRIMARY: 'gemini-3.6-flash', FALLBACK: 'gemini-3.6-flash', PRO: 'gemini-3.6-flash' },
  OPENAI_MODELS: { COMPUTER_USE: 'gpt-5.6-terra', COMMANDS: 'gpt-5.6-luna' },
  isOpenAIConfigured: () => estado.openaiConfigurado,
}));

const { resolveRoutedModel } = await import('../../services/model-routing');
const { consumeSofliaMaxUse } = await import('../../services/model-quota');

describe('Ruteo de modelos', () => {
  beforeEach(() => {
    localStorage.clear();
    estado.openaiConfigurado = true;
  });

  it('MR-001: Computer Use conserva el orquestador seleccionado y delega el actuador en main', () => {
    const routed = resolveRoutedModel({
      options: { model: 'gpt-5.6-terra', thinking: { id: 'high', level: 'high' } },
      isComputerActionTurn: true,
      isCommandTurn: true,
    });

    expect(routed).toEqual({ modelId: 'gpt-5.6-terra', consumesSofliaMaxQuota: true });
  });

  it('MR-002: los comandos sin Computer Use respetan el modelo seleccionado', () => {
    const routed = resolveRoutedModel({
      options: { model: 'gemini-3.6-flash' },
      isComputerActionTurn: false,
      isCommandTurn: true,
    });

    expect(routed.modelId).toBe('gemini-3.6-flash');
  });

  it('MR-003: un turno de la Orbe sin Computer Use respeta el modelo seleccionado', () => {
    const routed = resolveRoutedModel({
      options: { model: 'gemini-3.6-flash', task: 'orb' },
      isComputerActionTurn: false,
      isCommandTurn: false,
    });

    expect(routed.modelId).toBe('gemini-3.6-flash');
  });

  it('MR-004: el chat normal respeta SofLIA Lite', () => {
    const routed = resolveRoutedModel({
      options: { model: 'gemini-3.5-flash-lite' },
      isComputerActionTurn: false,
      isCommandTurn: false,
    });

    expect(routed.modelId).toBe('gemini-3.5-flash-lite');
  });

  it('MR-005: elegir SofLIA Max manualmente consume cuota', () => {
    const routed = resolveRoutedModel({
      options: { model: 'gpt-5.6-terra', userId: 'user-1' },
      isComputerActionTurn: false,
      isCommandTurn: false,
    });

    expect(routed.modelId).toBe('gpt-5.6-terra');
    expect(routed.consumesSofliaMaxQuota).toBe(true);
  });

  it('MR-006: agotada la cuota, SofLIA Max degrada a SofLIA Pro avisando', () => {
    consumeSofliaMaxUse('user-1');
    consumeSofliaMaxUse('user-1');
    consumeSofliaMaxUse('user-1');

    const routed = resolveRoutedModel({
      options: { model: 'gpt-5.6-terra', userId: 'user-1' },
      isComputerActionTurn: false,
      isCommandTurn: false,
    });

    expect(routed.modelId).toBe('gpt-5.6-luna');
    expect(routed.quotaExhausted).toBe(true);
  });

  it('MR-007: un modelo OpenAI conserva su proveedor para que el cliente resuelva la llave', () => {
    estado.openaiConfigurado = false;

    const routed = resolveRoutedModel({
      options: { model: 'gpt-5.6-luna', task: 'orb' },
      isComputerActionTurn: false,
      isCommandTurn: false,
    });

    expect(routed.modelId).toBe('gpt-5.6-luna');
  });

  it('MR-008: sin modelo elegido cae al primario', () => {
    expect(resolveRoutedModel({ isComputerActionTurn: false, isCommandTurn: false }).modelId).toBe('gemini-3.6-flash');
  });
});
