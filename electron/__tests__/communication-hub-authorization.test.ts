import { describe, expect, it } from 'vitest';
import { authorizeChannelTool, authorizeHubAdminAction, getCapabilitiesForRole } from '../communication-hub/authorization';
import type { ResolvedChannelPrincipal } from '../communication-hub/types';

function principal(overrides: Partial<ResolvedChannelPrincipal> = {}): ResolvedChannelPrincipal {
  const role = overrides.role || 'member';
  const scope = overrides.scope || (role === 'member' ? 'personal' : 'organization');
  return {
    provider: 'whatsapp',
    scope,
    source: 'sofia',
    active: true,
    userId: 'user-1',
    organizationId: 'org-1',
    role,
    memberships: [{ organizationId: 'org-1', role, status: 'active' }],
    capabilities: getCapabilitiesForRole(role, scope),
    ...overrides,
  };
}

describe('CommunicationHub authorization', () => {
  it('allows members to use their personal agent and local own-device control outside groups', () => {
    const result = authorizeChannelTool(principal(), {
      provider: 'whatsapp',
      channelId: 'dm',
      toolName: 'use_computer',
      isGroup: false,
    });

    expect(result.allowed).toBe(true);
  });

  it('blocks members from organization-only remote node administration', () => {
    const result = authorizeChannelTool(principal(), {
      provider: 'whatsapp',
      channelId: 'dm',
      toolName: 'register_remote_node',
      isGroup: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredCapability).toBe('remote_nodes');
  });

  it('blocks channel tools when SOFIA membership is not active', () => {
    const result = authorizeChannelTool(principal({ active: false, capabilities: [] }), {
      provider: 'telegram',
      channelId: 'chat-1',
      toolName: 'gmail_read',
      isGroup: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('membresia activa');
  });

  it('blocks members from organization channel administration', () => {
    const result = authorizeHubAdminAction(principal(), 'channels:update-policy');

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('owner o admin');
  });

  it('allows admins to manage organization channel capabilities outside groups', () => {
    const result = authorizeChannelTool(principal({ role: 'admin', scope: 'organization' }), {
      provider: 'whatsapp',
      channelId: 'dm',
      toolName: 'register_remote_node',
      isGroup: false,
    });

    expect(result.allowed).toBe(true);
  });

  it('hard-blocks dangerous tools in group context even for owners', () => {
    const result = authorizeChannelTool(principal({ role: 'owner', scope: 'organization' }), {
      provider: 'whatsapp',
      channelId: 'group',
      toolName: 'execute_command',
      isGroup: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('grupos');
  });
});
