import { describe, expect, it, vi } from 'vitest';
import { applyGmailOrganizationPlan, undoGmailOrganizationPlan, previewGmailOrganization } from '../../services/gmail-service';

describe('Contratos del renderer para planes Gmail', () => {
  it('preserva conteos parciales e incertidumbre sin reintentar', async () => {
    const result = { success: false, planId: 'plan', groupsApplied: 1, messagesLabeled: 100, removeFromInbox: true,
      labelsCreated: [], labelsReused: [], partial: true, uncertain: true, recoveryRequired: true, error: 'Revisa Gmail' };
    const apply = vi.fn(async () => result); Object.assign(window, { gmail: { applyOrganizationPlan: apply } });
    expect(await applyGmailOrganizationPlan('plan', { removeFromInbox: true })).toBe(result);
    expect(apply).toHaveBeenCalledExactlyOnceWith('plan', { removeFromInbox: true });
  });
  it('preserva conflicto de reversión y progreso confirmado', async () => {
    const result = { success: false, planId: 'plan', messagesRestored: 5, labelsDeleted: 0, partial: true, conflict: true, recoveryRequired: true };
    const undo = vi.fn(async () => result); Object.assign(window, { gmail: { undoOrganizationPlan: undo } });
    expect(await undoGmailOrganizationPlan()).toBe(result); expect(undo).toHaveBeenCalledExactlyOnceWith(undefined);
  });
  it('preview transporta las opciones y no altera la proyección pública', async () => {
    const result = { success: true, planId: 'plan', groups: [{ labelName: 'Empresa', count: 2 }] };
    const preview = vi.fn(async () => result); Object.assign(window, { gmail: { previewOrganization: preview } });
    expect(await previewGmailOrganization({ maxMessages: 250 })).toBe(result);
    expect(preview).toHaveBeenCalledExactlyOnceWith({ maxMessages: 250 });
  });
});
