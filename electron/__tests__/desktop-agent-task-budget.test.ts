import { describe, expect, it } from 'vitest';
import { requiresNativeLaunchBudget, resolveTaskStepBudget } from '../desktop-agent/task-budget';

const CONFIG = { maxSteps: 60, defaultStepBudget: 40 };

describe('Presupuesto de pasos del Desktop Agent', () => {
  it('TB-001: respeta el maxSteps explicito del llamador acotado al tope duro', () => {
    expect(resolveTaskStepBudget({ requestedMaxSteps: 25, config: CONFIG })).toBe(25);
    expect(resolveTaskStepBudget({ requestedMaxSteps: 500, config: CONFIG })).toBe(60);
    expect(resolveTaskStepBudget({ requestedMaxSteps: 0, config: CONFIG })).toBe(1);
  });

  it('TB-002: con plan, presupuesta el doble de los pasos estimados (minimo 15)', () => {
    expect(resolveTaskStepBudget({ planEstimatedSteps: 3, config: CONFIG })).toBe(15);
    expect(resolveTaskStepBudget({ planEstimatedSteps: 12, config: CONFIG })).toBe(24);
    expect(resolveTaskStepBudget({ planEstimatedSteps: 100, config: CONFIG })).toBe(60);
  });

  it('TB-003: sin plan ni maxSteps usa el presupuesto por defecto', () => {
    expect(resolveTaskStepBudget({ config: CONFIG })).toBe(40);
    expect(resolveTaskStepBudget({ planEstimatedSteps: null, config: CONFIG })).toBe(40);
  });

  it('TB-004: valores invalidos del plan caen al presupuesto por defecto', () => {
    expect(resolveTaskStepBudget({ planEstimatedSteps: Number.NaN, config: CONFIG })).toBe(40);
    expect(resolveTaskStepBudget({ planEstimatedSteps: -5, config: CONFIG })).toBe(40);
  });

  it('TB-005: tareas de launcher/juego tienen minimo 35 pasos aunque el plan estime poco', () => {
    const task = 'Abre y Ejecuta Minecraft Java en su ultima version';
    expect(requiresNativeLaunchBudget(task)).toBe(true);
    expect(resolveTaskStepBudget({ task, planEstimatedSteps: 2, config: CONFIG })).toBe(35);
    expect(resolveTaskStepBudget({ task, requestedMaxSteps: 10, config: CONFIG })).toBe(35);
  });
});
