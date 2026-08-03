import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({ openaiConfigurado: true }));

vi.mock('../../config', () => ({
  OPENAI_API_KEY: 'test-openai-key',
  OPENAI_VECTOR_STORE_IDS: [],
  MODELS: { PRIMARY: 'gemini-3.6-flash', FALLBACK: 'gemini-3.5-flash-lite', PRO: 'gemini-2.5-pro' },
  OPENAI_MODELS: { COMPUTER_USE: 'gpt-5.6-terra', COMMANDS: 'gpt-5.6-luna' },
  isOpenAIConfigured: () => estado.openaiConfigurado,
}));

const { COMPUTER_ACTION_REASONING_EFFORT, resolveRoutedModel } = await import('../../services/model-routing');
const { consumePulseMaxUse } = await import('../../services/model-quota');

describe('Ruteo de modelos', () => {
  beforeEach(() => {
    localStorage.clear();
    estado.openaiConfigurado = true;
  });

  it('MR-001: una accion real sobre la computadora va a Pulse Max con maximo razonamiento', () => {
    const routed = resolveRoutedModel({
      options: { model: 'gemini-3.6-flash', thinking: { id: 'minimal', level: 'minimal' } },
      isComputerActionTurn: true,
      isCommandTurn: true,
    });

    expect(routed.modelId).toBe('gpt-5.6-terra');
    expect(routed.reasoningEffort).toBe(COMPUTER_ACTION_REASONING_EFFORT);
    // El ruteo interno no gasta cuota: la orbe debe poder actuar todo el mes.
    expect(routed.consumesPulseMaxQuota).toBeFalsy();
  });

  it('MR-002: los demas comandos con herramientas van a Pulse Pro', () => {
    const routed = resolveRoutedModel({
      options: { model: 'gemini-3.6-flash' },
      isComputerActionTurn: false,
      isCommandTurn: true,
    });

    expect(routed.modelId).toBe('gpt-5.6-luna');
    expect(routed.reasoningEffort).toBeUndefined();
  });

  it('MR-003: un turno de la orbe sin accion va a Pulse Pro', () => {
    const routed = resolveRoutedModel({
      options: { model: 'gemini-3.6-flash', task: 'orb' },
      isComputerActionTurn: false,
      isCommandTurn: false,
    });

    expect(routed.modelId).toBe('gpt-5.6-luna');
  });

  it('MR-004: el chat normal respeta el modelo elegido por el usuario', () => {
    const routed = resolveRoutedModel({
      options: { model: 'gemini-3.5-flash-lite' },
      isComputerActionTurn: false,
      isCommandTurn: false,
    });

    expect(routed.modelId).toBe('gemini-3.5-flash-lite');
  });

  it('MR-005: elegir Pulse Max a mano consume cuota', () => {
    const routed = resolveRoutedModel({
      options: { model: 'gpt-5.6-terra', userId: 'user-1' },
      isComputerActionTurn: false,
      isCommandTurn: false,
    });

    expect(routed.modelId).toBe('gpt-5.6-terra');
    expect(routed.consumesPulseMaxQuota).toBe(true);
    expect(routed.quotaExhausted).toBeFalsy();
  });

  it('MR-006: agotada la cuota, Pulse Max degrada a Pulse Pro avisando', () => {
    consumePulseMaxUse('user-1');
    consumePulseMaxUse('user-1');
    consumePulseMaxUse('user-1');

    const routed = resolveRoutedModel({
      options: { model: 'gpt-5.6-terra', userId: 'user-1' },
      isComputerActionTurn: false,
      isCommandTurn: false,
    });

    expect(routed.modelId).toBe('gpt-5.6-luna');
    expect(routed.quotaExhausted).toBe(true);
    expect(routed.consumesPulseMaxQuota).toBeFalsy();
  });

  it('MR-007: sin llave de OpenAI todo se queda en Gemini', () => {
    estado.openaiConfigurado = false;

    const accion = resolveRoutedModel({
      options: { model: 'gemini-3.6-flash' },
      isComputerActionTurn: true,
      isCommandTurn: true,
    });
    const orbe = resolveRoutedModel({
      options: { model: 'gemini-3.6-flash', task: 'orb' },
      isComputerActionTurn: false,
      isCommandTurn: false,
    });

    expect(accion.modelId).toBe('gemini-3.6-flash');
    expect(orbe.modelId).toBe('gemini-3.6-flash');
  });

  it('MR-008: sin modelo elegido cae al primario', () => {
    estado.openaiConfigurado = false;

    expect(resolveRoutedModel({ isComputerActionTurn: false, isCommandTurn: false }).modelId).toBe('gemini-3.6-flash');
  });
});
