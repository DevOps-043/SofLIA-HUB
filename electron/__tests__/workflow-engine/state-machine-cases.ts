import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRESENTATION_TRANSITIONS,
  WorkflowEngine as FixtureWorkflowEngine,
} from '../workflow-engine.fixture';

describe('FixtureWorkflowEngine state machine', () => {
  let engine: FixtureWorkflowEngine;

  beforeEach(() => {
    engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
      traceId: 'trace-abc-123',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('WF-001: accepts a valid transition', () => {
    const result = engine.transition('PROCESSING_PROPOSAL');
    expect(result.success).toBe(true);
    expect(engine.getState()).toBe('PROCESSING_PROPOSAL');
  });

  it('WF-002: rejects an invalid transition without changing state', () => {
    const result = engine.transition('COMPLETED');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid transition');
    expect(result.error).toContain('AWAITING_DATA');
    expect(result.error).toContain('COMPLETED');
    expect(engine.getState()).toBe('AWAITING_DATA');
  });

  it('WF-003: blocks HITL transitions without approval', () => {
    engine.transition('PROCESSING_PROPOSAL');
    engine.transition('AWAITING_APPROVAL');
    const result = engine.transition('GENERATING_PRESENTATION');
    expect(result.success).toBe(false);
    expect(result.error).toContain('requires human approval');
    expect(result.error).toContain('HITL');
    expect(engine.getState()).toBe('AWAITING_APPROVAL');
  });

  it('WF-004: allows HITL transitions after approval', () => {
    engine.transition('PROCESSING_PROPOSAL');
    engine.transition('AWAITING_APPROVAL');
    engine.approve('AWAITING_APPROVAL->GENERATING_PRESENTATION');
    const result = engine.transition('GENERATING_PRESENTATION');
    expect(result.success).toBe(true);
    expect(engine.getState()).toBe('GENERATING_PRESENTATION');
  });

  it('WF-005: treats duplicate idempotency keys as safe no-ops', () => {
    expect(engine.transition('PROCESSING_PROPOSAL', 'paso-1').success).toBe(true);
    expect(engine.transition('PROCESSING_PROPOSAL', 'paso-1').success).toBe(true);
    expect(engine.getState()).toBe('PROCESSING_PROPOSAL');
    expect(engine.transition('AWAITING_APPROVAL', 'paso-2').success).toBe(true);
    expect(engine.getState()).toBe('AWAITING_APPROVAL');
  });

  it('WF-006: preserves trace_id across the lifecycle', () => {
    expect(engine.getTraceId()).toBe('trace-abc-123');
    engine.transition('PROCESSING_PROPOSAL');
    engine.transition('AWAITING_APPROVAL');
    engine.approve('AWAITING_APPROVAL->GENERATING_PRESENTATION');
    engine.transition('GENERATING_PRESENTATION');
    engine.transition('COMPLETED');
    expect(engine.getTraceId()).toBe('trace-abc-123');
  });

  it('WF-007: cancel moves the workflow to CANCELLED', () => {
    engine.transition('PROCESSING_PROPOSAL');
    engine.cancel();
    expect(engine.getState()).toBe('CANCELLED');
    expect(engine.transition('AWAITING_APPROVAL').success).toBe(false);
  });

  it('WF-008: timeout moves the workflow to TIMED_OUT', () => {
    const shortEngine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
      traceId: 'trace-timeout',
      timeoutMs: 100,
    });
    let fakeTime = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

    expect(shortEngine.transition('PROCESSING_PROPOSAL').success).toBe(true);
    fakeTime += 200;
    const result = shortEngine.transition('AWAITING_APPROVAL');
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(shortEngine.getState()).toBe('TIMED_OUT');
  });
});
