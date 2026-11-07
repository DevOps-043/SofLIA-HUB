import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useWhatsAppSetupState } from '../../components/whatsapp-setup/useWhatsAppSetupState';
import { DEFAULT_WHATSAPP_STATUS, DEFAULT_WHATSAPP_PERSONALIZATION } from '../../components/whatsapp-setup/defaultStatus';
import type { WhatsAppApi, WhatsAppStatus } from '../../shared/legacy-communication';
const actor = { userId: 'usuario', organizationId: 'org' };
let api: { [K in keyof WhatsAppApi]: ReturnType<typeof vi.fn<WhatsAppApi[K]>> };
const status = () => ({ ...structuredClone(DEFAULT_WHATSAPP_STATUS), success: true, connected: true, allowedNumbers: ['5215555555555'], whitelistEnabled: true, contactPersonalizations: { '5215555555555': { ...DEFAULT_WHATSAPP_PERSONALIZATION } }, contactPermissions: { '5215555555555': ['files_read' as const] } });
beforeEach(() => {
  api = { connect: vi.fn(async () => ({ success: true })), disconnect: vi.fn(async () => ({ success: true })), getStatus: vi.fn(async () => status()), getConversationHistory: vi.fn(async () => ({ success: true, data: [] })), getConversationHistoryStats: vi.fn(async () => ({ success: false })), setAllowedNumbers: vi.fn(async () => ({ success: true })), setAccessConfig: vi.fn(async () => ({ success: true })), setGroupConfig: vi.fn(async () => ({ success: true })), setPersonalization: vi.fn(async () => ({ success: true })), setApiKey: vi.fn(async () => ({ success: true })), onQR: vi.fn(() => vi.fn()), onStatusChange: vi.fn(() => vi.fn()), removeListeners: vi.fn() };
  Object.defineProperty(window, 'whatsApp', { value: api, configurable: true });
});
afterEach(() => { Reflect.deleteProperty(window, 'whatsApp'); vi.restoreAllMocks(); });
async function fixture() { const hook = renderHook(() => useWhatsAppSetupState({ isOpen: true, actor, apiKey: 'clave-ficticia', historyEnabled: false })); await waitFor(() => expect(hook.result.current.status.connected).toBe(true)); return hook; }
describe('Panel WhatsApp y resultados confirmados', () => {
  it('abrir sólo consulta; no guarda una clave ni conecta', async () => { await fixture(); expect(api.setApiKey).not.toHaveBeenCalled(); expect(api.connect).not.toHaveBeenCalled(); });
  it('cancelar clave impide conectar', async () => { const { result } = await fixture(); api.setApiKey.mockResolvedValueOnce({ success: false, error: 'Cancelado' }); await act(() => result.current.handleConnect()); expect(api.connect).not.toHaveBeenCalled(); expect(result.current.connecting).toBe(false); expect(result.current.error).toBe('Cancelado'); });
  it('desconexión cancelada conserva estado', async () => { const { result } = await fixture(); api.disconnect.mockResolvedValueOnce({ success: false, error: 'Cancelado' }); await act(() => result.current.handleDisconnect()); expect(result.current.status.connected).toBe(true); expect(result.current.error).toBe('Cancelado'); });
  it('números cancelados conservan lista e input', async () => { const { result } = await fixture(); act(() => result.current.setNumberInput('5216666666666')); api.setAllowedNumbers.mockResolvedValueOnce({ success: false }); await act(() => result.current.handleAddNumber()); expect(result.current.status.allowedNumbers).toEqual(['5215555555555']); expect(result.current.numberInput).toBe('5216666666666'); });
  it('grupo cancelado conserva input y lista', async () => { const { result } = await fixture(); act(() => result.current.setGroupInput('123456@g.us')); api.setGroupConfig.mockResolvedValueOnce({ success: false }); await act(() => result.current.handleAddGroup()); expect(result.current.status.allowedGroups).toEqual([]); expect(result.current.groupInput).toBe('123456@g.us'); });
  it('segundo paso fallido conserva primer cambio confirmado sin inventar el segundo', async () => { const { result } = await fixture(); api.setAccessConfig.mockResolvedValueOnce({ success: false, error: 'Cancelado permisos' }); await act(() => result.current.handleRemoveNumber('5215555555555')); expect(result.current.status.allowedNumbers).toEqual([]); expect(result.current.status.whitelistEnabled).toBe(false); expect(result.current.status.contactPersonalizations).toEqual({}); expect(result.current.status.contactPermissions['5215555555555']).toEqual(['files_read']); expect(result.current.error).toContain('Cancelado'); });
  it('un error de transporte no deja conectando', async () => { const { result } = await fixture(); api.setApiKey.mockRejectedValueOnce(new Error('fallo privado')); await act(() => result.current.handleConnect()); expect(result.current.connecting).toBe(false); expect(result.current.error).not.toContain('privado'); expect(api.connect).not.toHaveBeenCalled(); });
  it('cierre descarta respuesta de carga tardía', async () => {
    let finish!: (s: WhatsAppStatus) => void; api.getStatus.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const { result, rerender } = renderHook(({ isOpen }) => useWhatsAppSetupState({ isOpen, actor, historyEnabled: false }), { initialProps: { isOpen: true } });
    await waitFor(() => expect(finish).toBeTypeOf('function')); rerender({ isOpen: false }); await act(async () => { finish(status()); }); expect(result.current.status.connected).toBe(false);
  });
  it('A/B/A descarta carga anterior y borra borradores', async () => {
    let finish!: (s: WhatsAppStatus) => void; api.getStatus.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ...status(), connected: false });
    const { result, rerender } = renderHook(({ userId }) => useWhatsAppSetupState({ isOpen: true, actor: { ...actor, userId }, historyEnabled: false }), { initialProps: { userId: 'usuario' } });
    await waitFor(() => expect(finish).toBeTypeOf('function')); act(() => result.current.setNumberInput('dato anterior')); rerender({ userId: 'otro' }); rerender({ userId: 'usuario' }); await act(async () => { finish(status()); }); expect(result.current.status.connected).toBe(false); expect(result.current.numberInput).toBe('');
  });
  it('limpia sólo suscripciones propias', async () => { const { unmount } = await fixture(); const offQR = api.onQR.mock.results[0].value, offStatus = api.onStatusChange.mock.results[0].value; unmount(); expect(offQR).toHaveBeenCalledOnce(); expect(offStatus).toHaveBeenCalledOnce(); expect(api.removeListeners).not.toHaveBeenCalled(); });
});
