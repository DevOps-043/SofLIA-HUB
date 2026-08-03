import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../desktop-agent/agent-config';
import {
  COMPUTER_USE_MODEL_DEFAULTS,
  nextComputerUseProfile,
  resolveComputerUseModel,
} from '../desktop-agent/gemini-cu/model-registry';
import { splitKeyCombination } from '../desktop-agent/keyboard-controls';

describe('Registro de modelos de Computer Use', () => {
  it('CUM-001: el perfil recomendado es el modelo de Computer Use de Google', () => {
    expect(COMPUTER_USE_MODEL_DEFAULTS.recommended).toBe('gemini-3.6-flash');
    expect(resolveComputerUseModel(DEFAULT_CONFIG).model).toBe('gemini-3.6-flash');
    expect(resolveComputerUseModel(DEFAULT_CONFIG).provider).toBe('google');
  });

  it('CUM-002: los perfiles de respaldo resuelven a sus modelos', () => {
    expect(resolveComputerUseModel(DEFAULT_CONFIG, 'compatibility').model).toBe('gemini-3.5-flash');
    expect(resolveComputerUseModel(DEFAULT_CONFIG, 'economy').model).toBe('gemini-3.5-flash-lite');
  });

  it('CUM-003: la configuracion del usuario gana sobre el default del registro', () => {
    const config = { ...DEFAULT_CONFIG, computerUseModel: 'gemini-4.0-flash' };

    expect(resolveComputerUseModel(config).model).toBe('gemini-4.0-flash');
  });

  it('CUM-004: un modelo en blanco cae al default en vez de llamar a la API sin modelo', () => {
    const config = { ...DEFAULT_CONFIG, computerUseModel: '   ', computerUseFallbackModel: '  ' };

    expect(resolveComputerUseModel(config).model).toBe('gemini-3.6-flash');
    expect(resolveComputerUseModel(config, 'compatibility').model).toBe('gemini-3.5-flash');
  });

  it('CUM-005: la degradacion de perfil se agota en economy', () => {
    expect(nextComputerUseProfile('recommended')).toBe('compatibility');
    expect(nextComputerUseProfile('compatibility')).toBe('economy');
    expect(nextComputerUseProfile('economy')).toBeNull();
  });

  it('CUM-006: el motor CU y la deteccion de inyeccion vienen activados', () => {
    expect(DEFAULT_CONFIG.computerUseEngine).toBe('gemini');
    expect(DEFAULT_CONFIG.computerUsePromptInjectionDetection).toBe(true);
    // La captura por monitor activo es lo que mantiene legibles los controles
    // y hace convertible la coordenada en un escritorio de 3 pantallas.
    expect(DEFAULT_CONFIG.captureStrategy).toBe('active-monitor');
  });
});

describe('Combinaciones de teclas de Computer Use', () => {
  it('CUK-001: desglosa un combo arbitrario en sus teclas', () => {
    expect(splitKeyCombination('ctrl+shift+n')).toEqual(['ctrl', 'shift', 'n']);
    expect(splitKeyCombination('alt+f4')).toEqual(['alt', 'f4']);
  });

  it('CUK-002: una tecla suelta no se altera', () => {
    expect(splitKeyCombination('enter')).toEqual(['enter']);
    expect(splitKeyCombination(' Escape ')).toEqual(['Escape']);
  });

  it('CUK-003: el signo mas como tecla se conserva', () => {
    expect(splitKeyCombination('ctrl++')).toEqual(['ctrl', '+']);
  });

  it('CUK-004: una cadena vacia no produce teclas fantasma', () => {
    expect(splitKeyCombination('')).toEqual([]);
    expect(splitKeyCombination('   ')).toEqual([]);
  });
});
