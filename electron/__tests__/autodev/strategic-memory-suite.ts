import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyMemory, selectStrategy, type StrategicMemory } from './strategic-memory-model';

describe('AutoDev Strategic Memory', () => {
  let memory: StrategicMemory;

  beforeEach(() => {
    memory = createEmptyMemory();
  });

  it('AD-001: loads empty strategic memory from JSON', () => {
    const loaded: StrategicMemory = JSON.parse(JSON.stringify(memory));
    expect(loaded.roadmap).toEqual([]);
    expect(loaded.capabilities).toEqual([]);
    expect(loaded.retrospectives).toEqual([]);
  });

  it('AD-002: save to JSON preserves all data fields', () => {
    memory.roadmap.push({ id: 'g1', description: 'Add tests', priority: 'high', status: 'pending', createdAt: '2026-01-01' });
    expect(JSON.parse(JSON.stringify(memory)).roadmap[0].description).toBe('Add tests');
  });

  it('AD-003: can add a roadmap goal', () => {
    memory.roadmap.push({ id: 'g1', description: 'Improve CRM', priority: 'critical', status: 'pending', createdAt: '2026-03-01' });
    expect(memory.roadmap[0].priority).toBe('critical');
  });

  it('AD-004: can update a roadmap goal status to completed', () => {
    memory.roadmap.push({ id: 'g1', description: 'Fix bug', priority: 'high', status: 'pending', createdAt: '2026-03-01' });
    memory.roadmap[0].status = 'completed';
    memory.roadmap[0].completedAt = '2026-03-15';
    expect(memory.roadmap[0].completedAt).toBe('2026-03-15');
  });

  it('AD-005: can remove a roadmap goal', () => {
    memory.roadmap.push({ id: 'g1', description: 'Goal 1', priority: 'low', status: 'pending', createdAt: '2026-01-01' });
    memory.roadmap.push({ id: 'g2', description: 'Goal 2', priority: 'medium', status: 'pending', createdAt: '2026-01-02' });
    memory.roadmap = memory.roadmap.filter((goal) => goal.id !== 'g1');
    expect(memory.roadmap[0].id).toBe('g2');
  });

  it('AD-006/007: capabilities and retrospectives are mutable', () => {
    memory.capabilities.push({ feature: 'Desktop Agent', status: 'partial' });
    memory.capabilities[0].status = 'functional';
    memory.retrospectives.push({ runId: 'run-001', impactScore: 4, lessonsLearned: ['Cache'], mistakes: [], filesTouched: [] });
    expect(memory.capabilities[0].status).toBe('functional');
    expect(memory.retrospectives[0].lessonsLearned).toContain('Cache');
  });

  it('AD-008: selects user-driven strategy when unresolved complaints exist', () => {
    memory.userPatterns.push({ description: 'no funciona el calendario', frequency: 3, type: 'complaint' });
    expect(selectStrategy(memory)).toBe('user-driven');
  });

  it('AD-009: selects gap-filling when missing capabilities detected', () => {
    memory.capabilities.push({ feature: 'OCR', status: 'missing' });
    expect(selectStrategy(memory)).toBe('gap-filling');
  });

  it('AD-010: rotates strategy when recent runs had low impact', () => {
    memory.retrospectives.push({ runId: 'r1', impactScore: 1, lessonsLearned: [], mistakes: [], filesTouched: [] });
    memory.retrospectives.push({ runId: 'r2', impactScore: 2, lessonsLearned: [], mistakes: [], filesTouched: [] });
    memory.retrospectives.push({ runId: 'r3', impactScore: 2, lessonsLearned: [], mistakes: [], filesTouched: [] });
    expect(selectStrategy(memory)).toBe('innovation');
  });
});
