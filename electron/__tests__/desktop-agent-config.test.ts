import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../desktop-agent-types';

// ============================================================================
// TYPES & CONFIG (CU-101 to CU-120)
// ============================================================================

describe('Desktop Agent Types & Config', () => {
  it('CU-101: DEFAULT_CONFIG has maxSteps=120 (tope duro; el presupuesto real lo fija el plan)', () => {
    expect(DEFAULT_CONFIG.maxSteps).toBe(120);
  });

  it('CU-102: DEFAULT_CONFIG has maxTotalSteps=500', () => {
    expect(DEFAULT_CONFIG.maxTotalSteps).toBe(500);
  });

  it('CU-103: DEFAULT_CONFIG has screenshotWidth=1024', () => {
    expect(DEFAULT_CONFIG.screenshotWidth).toBe(1024);
  });

  it('CU-104: DEFAULT_CONFIG has screenshotHeight=768', () => {
    expect(DEFAULT_CONFIG.screenshotHeight).toBe(768);
  });

  it('CU-105: DEFAULT_CONFIG has somEnabled=true', () => {
    expect(DEFAULT_CONFIG.somEnabled).toBe(true);
  });

  it('CU-106: DEFAULT_CONFIG has somFallbackToGrid=true', () => {
    expect(DEFAULT_CONFIG.somFallbackToGrid).toBe(true);
  });

  it('CU-107: DEFAULT_CONFIG has hierarchicalPlanningEnabled=true', () => {
    expect(DEFAULT_CONFIG.hierarchicalPlanningEnabled).toBe(true);
  });

  it('CU-108: DEFAULT_CONFIG has verificationEnabled=true', () => {
    expect(DEFAULT_CONFIG.verificationEnabled).toBe(true);
  });

  it('CU-109: DEFAULT_CONFIG has summarizeEveryNSteps=15', () => {
    expect(DEFAULT_CONFIG.summarizeEveryNSteps).toBe(15);
  });

  it('CU-110: DEFAULT_CONFIG has maxRawHistorySteps=8', () => {
    expect(DEFAULT_CONFIG.maxRawHistorySteps).toBe(8);
  });

  it('CU-111: DEFAULT_CONFIG has defaultActionDelay=300', () => {
    expect(DEFAULT_CONFIG.defaultActionDelay).toBe(300);
  });

  it('CU-112: DEFAULT_CONFIG has waitForChangeTimeout=8000', () => {
    expect(DEFAULT_CONFIG.waitForChangeTimeout).toBe(8000);
  });

  it('CU-113: DEFAULT_CONFIG has maxConsecutiveFailures=3', () => {
    expect(DEFAULT_CONFIG.maxConsecutiveFailures).toBe(3);
  });

  it('CU-114: DEFAULT_CONFIG has stuckDetectionThreshold=4', () => {
    expect(DEFAULT_CONFIG.stuckDetectionThreshold).toBe(4);
  });

  it('CU-115: DEFAULT_CONFIG serializa tareas desktop visuales (maxConcurrentAgents=1)', () => {
    expect(DEFAULT_CONFIG.maxConcurrentAgents).toBe(1);
  });

  it('CU-116: DEFAULT_CONFIG has planningEnabled=true', () => {
    expect(DEFAULT_CONFIG.planningEnabled).toBe(true);
  });

  it('CU-117: DEFAULT_CONFIG has gridEnabled=true', () => {
    expect(DEFAULT_CONFIG.gridEnabled).toBe(true);
  });

  it('CU-118: DEFAULT_CONFIG has zoomEnabled=true', () => {
    expect(DEFAULT_CONFIG.zoomEnabled).toBe(true);
  });

  it('CU-119: DEFAULT_CONFIG has progressReportEveryNSteps=25', () => {
    expect(DEFAULT_CONFIG.progressReportEveryNSteps).toBe(25);
  });

  it('CU-120: DEFAULT_CONFIG has autoRecoverFromDialogs=true', () => {
    expect(DEFAULT_CONFIG.autoRecoverFromDialogs).toBe(true);
  });

  it('CU-121: DEFAULT_CONFIG activa determinista-primero y contexto de entorno', () => {
    expect(DEFAULT_CONFIG.deterministicFirstEnabled).toBe(true);
    expect(DEFAULT_CONFIG.environmentContextEnabled).toBe(true);
    expect(DEFAULT_CONFIG.environmentRefreshEveryNSteps).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.installedAppsIndexTtlMs).toBeGreaterThan(0);
  });

  it('CU-122: DEFAULT_CONFIG usa captura active-monitor con binding de layout', () => {
    expect(DEFAULT_CONFIG.captureStrategy).toBe('active-monitor');
    expect(DEFAULT_CONFIG.layoutBindingEnabled).toBe(true);
    expect(DEFAULT_CONFIG.legacyScaleFallbackEnabled).toBe(false);
    expect(DEFAULT_CONFIG.minRenderScale).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.maxScreenshotEdge).toBeGreaterThanOrEqual(DEFAULT_CONFIG.screenshotWidth);
  });

  it('CU-123: DEFAULT_CONFIG define presupuesto y timeout de cola', () => {
    expect(DEFAULT_CONFIG.defaultStepBudget).toBeLessThanOrEqual(DEFAULT_CONFIG.maxSteps);
    expect(DEFAULT_CONFIG.queueTimeoutMs).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.keywordRoutingEnabled).toBe(true);
  });

  it('CU-124: DEFAULT_CONFIG usa un único modelo conversacional y de Computer Use', () => {
    expect(new Set([
      DEFAULT_CONFIG.model,
      DEFAULT_CONFIG.fallbackModel,
      DEFAULT_CONFIG.proactiveModel,
      DEFAULT_CONFIG.computerUseModel,
      DEFAULT_CONFIG.computerUseFallbackModel,
      DEFAULT_CONFIG.computerUseEconomyModel,
    ])).toEqual(new Set(['gemini-3.6-flash']));
  });
});
