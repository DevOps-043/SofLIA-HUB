import { vi } from 'vitest';

const irisMocks = vi.hoisted(() => ({
  mockResponses: [] as Array<{ data: any; error: any }>,
  mockEq: vi.fn(),
  mockIs: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
}));

export function enqueueResponse(data: any, error: any = null) {
  irisMocks.mockResponses.push({ data, error });
}

export function createQueryBuilder() {
  const query: any = {
    eq: vi.fn((...args: any[]) => {
      irisMocks.mockEq(...args);
      return query;
    }),
    is: vi.fn((...args: any[]) => {
      irisMocks.mockIs(...args);
      return query;
    }),
    order: vi.fn((...args: any[]) => {
      irisMocks.mockOrder(...args);
      return query;
    }),
    limit: vi.fn((...args: any[]) => {
      irisMocks.mockLimit(...args);
      return query;
    }),
    select: vi.fn((...args: any[]) => {
      irisMocks.mockSelect(...args);
      return query;
    }),
    then: (resolve: any, reject: any) =>
      Promise.resolve(irisMocks.mockResponses.shift() ?? { data: [], error: null }).then(resolve, reject),
  };
  return query;
}

vi.mock('../../lib/iris-client', () => ({
  irisSupa: { from: (...args: any[]) => irisMocks.mockFrom(...args) },
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

export function resetIrisDataMocks() {
  vi.clearAllMocks();
  irisMocks.mockResponses.length = 0;
  irisMocks.mockFrom.mockImplementation(() => createQueryBuilder());
}

export function getIrisDataMocks() {
  return irisMocks;
}
