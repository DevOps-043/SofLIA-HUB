import { describe, expect, it, vi } from 'vitest';
import { runDesktopActionWithRetry } from '../desktop-agent/desktop-action-runner';
import { rejectUnsafeCoordinateFallback } from '../desktop-agent/task-execution-action';
import { DeterministicActionError } from '../desktop-agent/action-errors';
import { DEFAULT_CONFIG } from '../desktop-agent-types';
import type { DesktopActionPayload, RecoveryContext } from '../desktop-agent-types';

function baseInput(executeAction: (a: DesktopActionPayload) => Promise<void>) {
  const recovery: RecoveryContext = { consecutiveFailures: 0, sameScreenCount: 0, lastScreenHash: '', totalRecoveries: 0, lastRecoveryStep: -10 };
  return {
    action: { action: 'click_element_by_name', elementName: 'JUGAR', message: 'x' } as DesktopActionPayload,
    currentStep: 0,
    currentHash: 'hash-igual',
    config: { ...DEFAULT_CONFIG, maxRetryPerAction: 2, verificationEnabled: false },
    recovery,
    refineAction: (a: DesktopActionPayload) => a,
    executeAction,
    delay: vi.fn(async () => {}),
    takeScreenshotRaw: vi.fn(async () => 'hash-igual'),
    quickHash: (s: string) => s,
    getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  };
}

describe('runDesktopActionWithRetry: reintentos', () => {
  it('AR-001: un fallo determinista se ejecuta UNA sola vez (sin reintentos)', async () => {
    const executeAction = vi.fn(async () => { throw new DeterministicActionError('no expone elementos'); });
    const result = await runDesktopActionWithRetry(baseInput(executeAction));
    expect(executeAction).toHaveBeenCalledTimes(1);
    expect(result.actionSuccess).toBe(false);
    expect(result.entry.errorMessage).toContain('no expone elementos');
  });

  it('AR-002: un fallo transitorio SI se reintenta hasta maxRetryPerAction+1 veces', async () => {
    const executeAction = vi.fn(async () => { throw new Error('fallo transitorio de PowerShell'); });
    const result = await runDesktopActionWithRetry(baseInput(executeAction));
    expect(executeAction).toHaveBeenCalledTimes(3); // 1 intento + 2 reintentos
    expect(result.actionSuccess).toBe(false);
  });

  it('AR-003: exito en el primer intento no reintenta', async () => {
    const executeAction = vi.fn(async () => {});
    const result = await runDesktopActionWithRetry(baseInput(executeAction));
    expect(executeAction).toHaveBeenCalledTimes(1);
    expect(result.actionSuccess).toBe(true);
  });

  it('AR-004: verificacion sin cambio recuerda el target resuelto para no repetirlo', async () => {
    const executeAction = vi.fn(async () => {});
    const rememberFailedTarget = vi.fn();
    const input = {
      ...baseInput(executeAction),
      config: { ...DEFAULT_CONFIG, maxRetryPerAction: 0, verificationEnabled: true },
      consumeResolvedTarget: () => ({
        kind: 'text' as const,
        text: 'JUGAR',
        source: 'ocr' as const,
        centroImagen: { x: 558, y: 660 },
        centroFisico: { x: -1145, y: 306 },
      }),
      rememberFailedTarget,
    };

    const result = await runDesktopActionWithRetry(input);

    expect(result.entry.verificationFailed).toBe(true);
    expect(result.entry.resolvedTarget?.text).toBe('JUGAR');
    expect(rememberFailedTarget).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'JUGAR' }),
      expect.objectContaining({ action: 'click_element_by_name' }),
      'verification_failed_same_screen',
    );
  });

  it('AR-005: fallo determinista de click_element_by_name recuerda la pista como target fallido', async () => {
    const executeAction = vi.fn(async () => { throw new DeterministicActionError('texto no encontrado'); });
    const rememberFailedTarget = vi.fn();
    const result = await runDesktopActionWithRetry({
      ...baseInput(executeAction),
      action: { action: 'click_element_by_name', elementName: 'JUGAR', x: 540, y: 640, message: 'jugar' } as DesktopActionPayload,
      rememberFailedTarget,
    });

    expect(result.actionSuccess).toBe(false);
    expect(result.entry.resolvedTarget).toMatchObject({
      kind: 'text',
      text: 'JUGAR',
      centroImagen: { x: 540, y: 640 },
    });
    expect(rememberFailedTarget).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'JUGAR', centroImagen: { x: 540, y: 640 } }),
      expect.objectContaining({ action: 'click_element_by_name' }),
      'deterministic_semantic_target_failed',
    );
  });

  it('AR-006: accion insegura se rechaza antes de ejecutar el click crudo', async () => {
    const executeAction = vi.fn(async () => {});
    const result = await runDesktopActionWithRetry({
      ...baseInput(executeAction),
      action: { action: 'click', x: 540, y: 640, message: 'click directo' } as DesktopActionPayload,
      rejectUnsafeAction: () => 'click crudo bloqueado',
    });

    expect(executeAction).not.toHaveBeenCalled();
    expect(result.actionSuccess).toBe(false);
    expect(result.entry.errorMessage).toBe('click crudo bloqueado');
  });

  it('AR-007: target fallido queda bloqueado para no repetir click crudo cercano', () => {
    const service = {
      currentStep: 3,
      failedActionTargets: [{
        kind: 'text',
        text: 'JUGAR',
        action: 'click_element_by_name',
        centroImagen: { x: 540, y: 640 },
        failedAtStep: 2,
        expiresAtStep: 8,
        reason: 'deterministic_semantic_target_failed',
      }],
    };

    const reason = rejectUnsafeCoordinateFallback(service, {
      action: 'click',
      x: 545,
      y: 638,
      message: 'click directo al mismo lugar',
    } as DesktopActionPayload);

    expect(reason).toContain('Click crudo bloqueado');
  });

  it('AR-008: si una marca [N] del Set-of-Marks cubre el punto, el click NO se bloquea', () => {
    const service = {
      currentStep: 3,
      currentUIElements: [{ id: 5, name: '', controlType: 'icon', boundingRect: { x: 0, y: 0, width: 0, height: 0 }, isEnabled: true }],
      // La marca mapeada a imagen cubre (545, 638).
      mapDesktopRectToScreenshotRect: () => ({ x: 500, y: 600, width: 120, height: 80 }),
      failedActionTargets: [{
        kind: 'text', text: 'JUGAR', action: 'click_element_by_name',
        centroImagen: { x: 540, y: 640 }, failedAtStep: 2, expiresAtStep: 8,
        reason: 'deterministic_semantic_target_failed',
      }],
    };

    const reason = rejectUnsafeCoordinateFallback(service, {
      action: 'click', x: 545, y: 638, message: 'click sobre la marca',
    } as DesktopActionPayload);

    expect(reason).toBeNull();
  });

  it('AR-009: un zoom sobre la region DESPUES del fallo desbloquea el click (autonomia)', () => {
    const service = {
      currentStep: 4,
      lastZoomAt: { x: 542, y: 641, step: 3 }, // zoom tras el fallo (paso 2), cerca del punto
      failedActionTargets: [{
        kind: 'text', text: 'JUGAR', action: 'click_element_by_name',
        centroImagen: { x: 540, y: 640 }, failedAtStep: 2, expiresAtStep: 8,
        reason: 'deterministic_semantic_target_failed',
      }],
    };

    const reason = rejectUnsafeCoordinateFallback(service, {
      action: 'click', x: 545, y: 638, message: 'click tras zoom',
    } as DesktopActionPayload);

    expect(reason).toBeNull();
  });

  it('AR-010: un zoom lejano (o previo al fallo) NO desbloquea', () => {
    const service = {
      currentStep: 4,
      lastZoomAt: { x: 100, y: 100, step: 3 }, // lejos del punto bloqueado
      failedActionTargets: [{
        kind: 'text', text: 'JUGAR', action: 'click_element_by_name',
        centroImagen: { x: 540, y: 640 }, failedAtStep: 2, expiresAtStep: 8,
        reason: 'deterministic_semantic_target_failed',
      }],
    };

    const reason = rejectUnsafeCoordinateFallback(service, {
      action: 'click', x: 545, y: 638, message: 'click tras zoom lejano',
    } as DesktopActionPayload);

    expect(reason).toContain('Click crudo bloqueado');
  });
});
