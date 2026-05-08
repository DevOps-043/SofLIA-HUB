/**
 * Tests RS-006 to RS-008: iris-data.ts IRIS data service.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueResponse, getIrisDataMocks, resetIrisDataMocks } from './iris-data.setup';

const { mockFrom } = getIrisDataMocks();

describe('iris-data', () => {
  beforeEach(() => {
    resetIrisDataMocks();
  });

  it('RS-006: getTeams returns an array of teams', async () => {
    enqueueResponse([
      { team_id: 't-1', name: 'Equipo Alpha', slug: 'alpha', status: 'active', visibility: 'public', owner_id: 'u-1', created_at: '2026-01-01', updated_at: '2026-01-01' },
      { team_id: 't-2', name: 'Equipo Beta', slug: 'beta', status: 'active', visibility: 'private', owner_id: 'u-2', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]);

    const { getTeams } = await import('../../services/iris-data');
    const teams = await getTeams();

    expect(mockFrom).toHaveBeenCalledWith('teams');
    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Equipo Alpha');
    expect(teams[1].team_id).toBe('t-2');
  });

  it('RS-007: getProjects returns projects filtered by team', async () => {
    const mockTeams = [
      { team_id: 't-1', name: 'Alpha', slug: 'alpha', status: 'active', visibility: 'public', owner_id: 'u-1', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];
    enqueueResponse(mockTeams);
    enqueueResponse([
      { project_id: 'p-1', project_key: 'PRJ-1', project_name: 'Proyecto Uno', team_id: 't-1', project_status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]);

    const { resolveSearchCandidate } = await import('../../shared/iris-resolution');
    vi.mocked(resolveSearchCandidate).mockReturnValue({
      match: mockTeams[0],
      reason: 'exact',
      candidates: [],
    } as any);

    const { getProjects } = await import('../../services/iris-data');
    expect(Array.isArray(await getProjects('t-1'))).toBe(true);
  });

  it('RS-008: getIssues returns issues for a project', async () => {
    enqueueResponse([
      { issue_id: 'i-1', title: 'Bug critico', project_id: 'p-1', team_id: 't-1', updated_at: '2026-01-01' },
      { issue_id: 'i-2', title: 'Feature request', project_id: 'p-1', team_id: 't-1', updated_at: '2026-01-02' },
    ]);

    const { getIssues } = await import('../../services/iris-data');
    const issues = await getIssues({ projectId: 'p-1' });

    expect(Array.isArray(issues)).toBe(true);
    expect(issues).toHaveLength(2);
    expect(issues[0].title).toBe('Bug critico');
  });
});
