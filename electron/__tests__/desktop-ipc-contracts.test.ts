import { describe, expect, it } from 'vitest';
import { desktopInputs, desktopInputSnapshot, desktopConfigSchema } from '../../src/shared/desktop-input';
import { DEFAULT_CONFIG } from '../desktop-agent-types';

const fixtures: Record<keyof typeof desktopInputs, unknown[]> = {
  'execute-task': ['Tarea ficticia', { maxSteps: 5, backend: 'browser', startUrl: 'https://example.invalid', browserProfile: 'qa', browserIsolated: false, resetBrowserProfile: false, useRealBrowser: true, queueTimeoutMs: 1000 }],
  'execute-parallel': [[{ task: 'Tarea 1', backend: 'desktop', maxSteps: 3 }, { task: 'Tarea 2', backend: 'uia' }]],
  'get-active-tasks': [], 'abort-task': ['agent-test'], abort: [], 'get-status': [], 'get-config': [],
  'list-browser-profiles': [], 'reset-browser-profile': ['perfil-qa'], 'set-config': [{ maxSteps: 20, captureStrategy: 'all-monitors' }],
  'start-observation': ['Objetivo', 'Reglas'], 'stop-observation': [], click: [-30, 40], 'double-click': [2, 3], 'right-click': [4, 5],
  drag: [1, 2, 3, 4], type: ['Texto +%{}'], key: ['ctrl+shift+n'], scroll: ['down', 5], 'focus-window': ['Editor'], 'list-windows': [], 'take-screenshot': [true], 'run-calibration': [],
};
describe('Contratos públicos Desktop Agent', () => {
  it.each(Object.keys(fixtures) as (keyof typeof fixtures)[])('conserva parámetros de %s y rechaza extras', name => {
    expect(desktopInputs[name].parse(desktopInputSnapshot(fixtures[name]))).toEqual(fixtures[name]);
    expect(() => desktopInputs[name].parse(desktopInputSnapshot([...fixtures[name], 'extra']))).toThrow();
  });
  it.each(['execute-task', 'take-screenshot'] as const)('opciones omitidas siguen admitidas en %s', name => {
    const args = name === 'execute-task' ? ['Tarea'] : [];
    expect(() => desktopInputs[name].parse(desktopInputSnapshot(args))).not.toThrow();
  });
  it('todos los campos de config completa siguen admitidos para roundtrip de ajustes', () => {
    expect(desktopConfigSchema.parse(DEFAULT_CONFIG)).toEqual(DEFAULT_CONFIG);
    expect(desktopInputs['set-config'].parse([DEFAULT_CONFIG])).toEqual([DEFAULT_CONFIG]);
  });
});
