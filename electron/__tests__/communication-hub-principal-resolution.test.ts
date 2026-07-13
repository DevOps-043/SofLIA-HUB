import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rankUsersByPhoneMatch } from '../communication-hub/phone-match';
import { CommunicationHubService } from '../communication-hub/service';

const { getSofiaClientMock } = vi.hoisted(() => ({ getSofiaClientMock: vi.fn() }));

vi.mock('../iris/clients', () => ({
  getSofiaClient: getSofiaClientMock,
  getIrisClient: vi.fn(() => null),
  isIrisAvailable: vi.fn(() => false),
  getSofiaCredentials: vi.fn(() => null),
}));

type QueryResult = { data: unknown; error: { message: string } | null };

type QueryBuilder = {
  select: () => QueryBuilder;
  not: () => QueryBuilder;
  eq: (column: string, value: string) => QueryBuilder;
  then: (resolve: (value: QueryResult) => void) => Promise<void>;
};

function thenableQuery(result: QueryResult): QueryBuilder {
  const builder: QueryBuilder = {
    select: () => builder,
    not: () => builder,
    eq: () => builder,
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function buildSofiaClient(usersResult: QueryResult, membershipsByUserId: Record<string, QueryResult>) {
  let lastUserId = '';
  return {
    from: (table: string): QueryBuilder => {
      if (table === 'users') return thenableQuery(usersResult);
      const builder: QueryBuilder = {
        select: () => builder,
        not: () => builder,
        eq: (column, value) => {
          if (column === 'user_id') lastUserId = value;
          return builder;
        },
        then: (resolve) =>
          Promise.resolve(membershipsByUserId[lastUserId] || { data: [], error: null }).then(resolve),
      };
      return builder;
    },
  };
}

function buildService(masterNumber = ''): CommunicationHubService {
  return new CommunicationHubService({
    waService: { getStatus: () => ({ masterNumber, allowedNumbers: [] }) },
    telegramService: { getStatus: async () => ({}) },
  });
}

describe('rankUsersByPhoneMatch', () => {
  it('prioriza coincidencias exactas sobre coincidencias por sufijo', () => {
    const users = [
      { id: 'suffix', phone: '49476297' },
      { id: 'exact', phone: '+52 1 55 4947 6297' },
    ];
    const ranked = rankUsersByPhoneMatch(users, '5549476297');
    expect(ranked.map((user) => user.id)).toEqual(['exact', 'suffix']);
  });

  it('ignora usuarios sin telefono y devuelve vacio si no hay coincidencias', () => {
    const users = [
      { id: 'a', phone: null },
      { id: 'b', phone: '5215587654321' },
    ];
    expect(rankUsersByPhoneMatch(users, '5549476297')).toEqual([]);
    expect(rankUsersByPhoneMatch(users, '')).toEqual([]);
  });
});

describe('CommunicationHubService.resolvePrincipalFromWhatsApp', () => {
  beforeEach(() => {
    getSofiaClientMock.mockReset();
  });

  it('elige al usuario duplicado con membresia activa aunque no sea el primer match', async () => {
    const users = [
      { id: 'user-huerfano', phone: '5215549476297' },
      { id: 'user-activo', phone: '5215549476297', display_name: 'Activo' },
    ];
    getSofiaClientMock.mockReturnValue(buildSofiaClient(
      { data: users, error: null },
      {
        'user-huerfano': { data: [], error: null },
        'user-activo': { data: [{ organization_id: 'org-1', role: 'owner', status: 'active' }], error: null },
      },
    ));

    const principal = await buildService().resolvePrincipalFromWhatsApp('5215549476297');

    expect(principal.active).toBe(true);
    expect(principal.userId).toBe('user-activo');
    expect(principal.role).toBe('owner');
    expect(principal.capabilities).toContain('personal_agent');
  });

  it('devuelve principal inactivo si ningun usuario coincidente tiene membresia activa', async () => {
    const users = [{ id: 'user-huerfano', phone: '5215549476297' }];
    getSofiaClientMock.mockReturnValue(buildSofiaClient(
      { data: users, error: null },
      { 'user-huerfano': { data: [], error: null } },
    ));

    const principal = await buildService().resolvePrincipalFromWhatsApp('5215549476297');

    expect(principal.active).toBe(false);
    expect(principal.userId).toBe('user-huerfano');
  });

  it('cae al principal legacy cuando no hay usuario SOFIA con ese telefono', async () => {
    getSofiaClientMock.mockReturnValue(buildSofiaClient({ data: [], error: null }, {}));

    const principal = await buildService('5215549476297').resolvePrincipalFromWhatsApp('5215549476297');

    expect(principal.source).toBe('legacy');
    expect(principal.active).toBe(true);
    expect(principal.role).toBe('owner');
    expect(principal.capabilities).toContain('personal_agent');
  });
});
