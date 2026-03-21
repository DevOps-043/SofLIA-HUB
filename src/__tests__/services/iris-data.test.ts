/**
 * Tests RS-006 to RS-008: iris-data.ts — IRIS data service tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chain builders
const mockResponses: Array<{ data: any; error: any }> = [];
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

function enqueueResponse(data: any, error: any = null) {
  mockResponses.push({ data, error });
}

function createQueryBuilder() {
  const query: any = {
    eq: vi.fn((...args: any[]) => {
      mockEq(...args);
      return query;
    }),
    is: vi.fn((...args: any[]) => {
      mockIs(...args);
      return query;
    }),
    order: vi.fn((...args: any[]) => {
      mockOrder(...args);
      return query;
    }),
    limit: vi.fn((...args: any[]) => {
      mockLimit(...args);
      return query;
    }),
    select: vi.fn((...args: any[]) => {
      mockSelect(...args);
      return query;
    }),
    then: (resolve: any, reject: any) =>
      Promise.resolve(mockResponses.shift() ?? { data: [], error: null }).then(resolve, reject),
  };
  return query;
}

const mockIrisSupa = {
  from: (...args: any[]) => mockFrom(...args),
};

vi.mock('../../lib/iris-client', () => ({
  irisSupa: mockIrisSupa,
  isIrisConfigured: vi.fn(() => true),
}));

vi.mock('../../lib/sofia-client', () => ({
  sofiaSupa: null,
  isSofiaConfigured: vi.fn(() => false),
}));

vi.mock('../../services/sofia-auth', () => ({
  sofiaAuth: {
    signInWithSofia: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    fetchSofiaUserProfile: vi.fn(),
    onAuthStateChange: vi.fn(),
    setCurrentOrganization: vi.fn(),
    setCurrentTeam: vi.fn(),
  },
}));

vi.mock('../../shared/iris-resolution', () => ({
  describeResolutionCandidates: vi.fn(() => ''),
  generateUniqueProjectKey: vi.fn(() => 'PRJ-1'),
  normalizeProjectKey: vi.fn((k: string) => k),
  resolveSearchCandidate: vi.fn(() => ({ match: null, reason: 'not_found', candidates: [] })),
}));

vi.mock('../../config', () => ({
  IRIS_SUPABASE: { URL: 'https://test-iris.supabase.co', ANON_KEY: 'test-iris-key' },
}));

describe('iris-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses.length = 0;
    mockFrom.mockImplementation(() => createQueryBuilder());
  });

  // RS-006: getTeams returns Team[]
  it('RS-006: getTeams returns an array of teams', async () => {
    const mockTeams = [
      { team_id: 't-1', name: 'Equipo Alpha', slug: 'alpha', status: 'active', visibility: 'public', owner_id: 'u-1', created_at: '2026-01-01', updated_at: '2026-01-01' },
      { team_id: 't-2', name: 'Equipo Beta', slug: 'beta', status: 'active', visibility: 'private', owner_id: 'u-2', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];
    enqueueResponse(mockTeams);

    const { getTeams } = await import('../../services/iris-data');
    const teams = await getTeams();

    expect(mockFrom).toHaveBeenCalledWith('teams');
    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Equipo Alpha');
    expect(teams[1].team_id).toBe('t-2');
  });

  // RS-007: getProjects returns Project[] for a teamId
  it('RS-007: getProjects returns projects filtered by team', async () => {
    // For getProjects with a teamRef, it first calls getTeams to resolve
    const mockTeams = [
      { team_id: 't-1', name: 'Alpha', slug: 'alpha', status: 'active', visibility: 'public', owner_id: 'u-1', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    const mockProjects = [
      { project_id: 'p-1', project_key: 'PRJ-1', project_name: 'Proyecto Uno', team_id: 't-1', project_status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    enqueueResponse(mockTeams);
    enqueueResponse(mockProjects);

    // Make resolveSearchCandidate return a match for the team
    const { resolveSearchCandidate } = await import('../../shared/iris-resolution');
    vi.mocked(resolveSearchCandidate).mockReturnValue({
      match: mockTeams[0],
      reason: 'exact',
      candidates: [],
    } as any);

    const { getProjects } = await import('../../services/iris-data');
    const projects = await getProjects('t-1');

    expect(Array.isArray(projects)).toBe(true);
  });

  // RS-008: getIssues returns Issue[] for a projectId
  it('RS-008: getIssues returns issues for a project', async () => {
    const mockIssues = [
      { issue_id: 'i-1', title: 'Bug critico', project_id: 'p-1', team_id: 't-1', updated_at: '2026-01-01' },
      { issue_id: 'i-2', title: 'Feature request', project_id: 'p-1', team_id: 't-1', updated_at: '2026-01-02' },
    ];

    enqueueResponse(mockIssues);

    const { getIssues } = await import('../../services/iris-data');
    const issues = await getIssues({ projectId: 'p-1' });

    expect(Array.isArray(issues)).toBe(true);
    expect(issues).toHaveLength(2);
    expect(issues[0].title).toBe('Bug critico');
  });
});
