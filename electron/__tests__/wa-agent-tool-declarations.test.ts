import { beforeEach, describe, expect, it, vi } from 'vitest';

const TOOL_COUNT = 40;

// La factoria de `vi.mock` se iza al inicio del modulo: no puede leer variables
// del ambito superior, asi que construye el catalogo ahi dentro.
vi.mock('../whatsapp-tools', () => ({
  WA_TOOL_DECLARATIONS: {
    functionDeclarations: Array.from({ length: 40 }, (_, index) => ({ name: `tool_${index}` })),
  },
  GROUP_BLOCKED_TOOLS: new Set<string>(),
}));

vi.mock('../dynamic-tool-service', () => ({
  dynamicToolService: { getGeminiFunctionDeclarations: vi.fn(async () => []) },
}));

vi.mock('../whatsapp/access-control', () => ({
  getWhatsAppToolAccessError: vi.fn(() => null),
}));

import { dynamicToolService } from '../dynamic-tool-service';
import type { CommunicationHubService } from '../communication-hub/service';
import { buildWhatsAppToolDeclarations } from '../wa-agent/tool-declarations';
import type { WhatsAppConfig } from '../whatsapp/types';
import { getWhatsAppToolAccessError } from '../whatsapp/access-control';

function createHub(principal: Record<string, unknown>) {
  const hub = { resolvePrincipalFromWhatsApp: vi.fn(async () => principal) };
  return hub as unknown as CommunicationHubService & typeof hub;
}

const ACTIVE_PRINCIPAL = {
  provider: 'whatsapp',
  scope: 'personal',
  source: 'sofia_profile',
  active: true,
  role: 'member',
  memberships: [],
  capabilities: [],
};

const BASE_PARAMS = {
  isGroup: false,
  senderNumber: '5215549476297',
  whatsappConfig: {} as unknown as WhatsAppConfig,
};

describe('buildWhatsAppToolDeclarations', () => {
  beforeEach(() => {
    vi.mocked(getWhatsAppToolAccessError).mockClear();
    vi.mocked(dynamicToolService.getGeminiFunctionDeclarations).mockClear();
  });

  it('resuelve el principal del hub una sola vez por turno, no una por herramienta', async () => {
    const communicationHub = createHub(ACTIVE_PRINCIPAL);

    await buildWhatsAppToolDeclarations({ ...BASE_PARAMS, communicationHub });

    // Cada resolucion consulta SOFIA Supabase: una por tool convertia un turno
    // en decenas de consultas antes de llamar al modelo.
    expect(communicationHub.resolvePrincipalFromWhatsApp).toHaveBeenCalledTimes(1);
  });

  it('con principal activo del hub no consulta el mapa de permisos legado', async () => {
    const communicationHub = createHub(ACTIVE_PRINCIPAL);

    const { functionDeclarations } = await buildWhatsAppToolDeclarations({ ...BASE_PARAMS, communicationHub });

    expect(functionDeclarations).toHaveLength(TOOL_COUNT);
    expect(getWhatsAppToolAccessError).not.toHaveBeenCalled();
  });

  it('un principal inactivo deja el catalogo vacio', async () => {
    const communicationHub = createHub({ ...ACTIVE_PRINCIPAL, active: false });

    const { functionDeclarations } = await buildWhatsAppToolDeclarations({ ...BASE_PARAMS, communicationHub });

    expect(functionDeclarations).toHaveLength(0);
    expect(dynamicToolService.getGeminiFunctionDeclarations).not.toHaveBeenCalled();
  });

  it('un principal legado cae al mapa de permisos local', async () => {
    const communicationHub = createHub({ ...ACTIVE_PRINCIPAL, source: 'legacy' });
    vi.mocked(getWhatsAppToolAccessError).mockReturnValue('sin permiso');

    const { functionDeclarations } = await buildWhatsAppToolDeclarations({ ...BASE_PARAMS, communicationHub });

    expect(functionDeclarations).toHaveLength(0);
    expect(getWhatsAppToolAccessError).toHaveBeenCalled();
    vi.mocked(getWhatsAppToolAccessError).mockReturnValue(null);
  });

  it('sin hub conectado decide el mapa de permisos local', async () => {
    const { functionDeclarations } = await buildWhatsAppToolDeclarations({ ...BASE_PARAMS, communicationHub: null });

    expect(functionDeclarations).toHaveLength(TOOL_COUNT);
    expect(getWhatsAppToolAccessError).toHaveBeenCalled();
  });
});
