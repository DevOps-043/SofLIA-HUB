import { describe, expect, it } from 'vitest';
import { legacyAccess, legacyGroup, legacyHistory, legacyNumbers, legacyPersonalization } from '../communication-hub/legacy-contract';
import { normalizeWhatsAppConfig } from '../whatsapp/personalization';
import type { WhatsAppConfig } from '../whatsapp/types';
const actor = { userId: 'usuario', organizationId: 'org' };
describe('Contrato cerrado de proveedores heredados', () => {
  it.each([{ groupPolicy: ['open'] }, { groupActivation: ['always'] }, { groupPrefix: 'x'.repeat(41) }, { allowedGroups: ['https://ajeno.invalid'] }, { actor: { userId: 'otro' } }, { connected: true }])('rechaza grupos inválidos %#', value => expect(() => legacyGroup(value, actor)).toThrow());
  it.each([{ masterPermissions: ['superadmin'] }, { contactPermissions: { '../id': ['shell'] } }, { masterNumber: 'http://ajeno.invalid' }, { apiKey: 'no' }])('rechaza permisos inválidos %#', value => expect(() => legacyAccess(value, actor)).toThrow());
  it.each([{ globalPersonalization: { tone: ['custom'] } }, { groupPersonalizations: { '../id': {} } }, { whitelistEnabled: 'no' }, { globalPersonalization: { customInstructions: 'x'.repeat(1601) } }])('rechaza personalización inválida %#', value => expect(() => legacyPersonalization(value, actor)).toThrow());
  it.each([{ limit: 101 }, { kind: ['text'] }, { direction: ['outgoing'] }, { since: 'no-fecha' }, { path: '/tmp/no' }])('rechaza historial inválido %#', value => expect(() => legacyHistory(value, actor)).toThrow());
  it('respeta límites de lista y copia datos', () => { expect(() => legacyNumbers(Array(101).fill('5215555555555'))).toThrow(); const list = ['5215555555555']; expect(legacyNumbers(list)).not.toBe(list); });
  it('no acepta arrays como política recuperada del archivo', () => { const config = normalizeWhatsAppConfig({ groupPolicy: ['open'], groupActivation: ['always'] } as unknown as WhatsAppConfig); expect(config.groupPolicy).toBe('disabled'); expect(config.groupActivation).toBe('mention'); });
});
