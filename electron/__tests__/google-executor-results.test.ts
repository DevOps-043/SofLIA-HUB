import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mailboxFixture } from './gmail-mailbox/fixtures';
import { executeGoogleTool } from '../whatsapp-executors/google-executors';
import type { ToolExecutorContext } from '../whatsapp-executors/types';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-google-results-')); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
const context = (gmailService: ReturnType<typeof mailboxFixture>['service']) => ({ gmailService } as unknown as ToolExecutorContext);

describe('Resultados Google sin estado Gmail transversal', () => {
  it('conserva una modificación y no añade un estado implícito para otras herramientas', async () => {
    const fx = mailboxFixture(root);
    const result = await executeGoogleTool('gmail_modify_labels', { message_id: 'msg-0', remove_labels: ['Work_1'] }, context(fx.service));
    expect(Object.keys(result!)).toEqual(['response']);
    expect(result?.response.functionResponse).toMatchObject({ name: 'gmail_modify_labels', response: { success: true, effectsConfirmed: 1 } });
    expect(fx.current.get('msg-1')).toContain('Work_1'); expect(fx.list).not.toHaveBeenCalled();
  });
  it('conserva los datos de la página sin ordenar leer más mensajes', async () => {
    const fx = mailboxFixture(root, 21);
    const result = await executeGoogleTool('gmail_get_messages', { max_results: 10 }, context(fx.service));
    const data = result?.response.functionResponse.response;
    expect(data).toMatchObject({ success: true, count: 10, next_page_token: '10', likely_has_more: true });
    expect(data).not.toHaveProperty('warning'); expect(fx.list).toHaveBeenCalledOnce();
  });
  it.each([0, '', null, 'false'])('no coerciona un flag de borrado inválido: %j', async delete_label => {
    const fx = mailboxFixture(root);
    const result = await executeGoogleTool('gmail_batch_empty_label', { label_id: 'Work_1', delete_label }, context(fx.service));
    expect(result?.response.functionResponse.response).toMatchObject({ success: false, processed: 0 });
    expect(fx.acquire).not.toHaveBeenCalled(); expect(fx.batchModify).not.toHaveBeenCalled(); expect(fx.deleteLabel).not.toHaveBeenCalled();
  });
  it('propaga el resultado parcial real del lote sin perder su referencia', async () => {
    const fx = mailboxFixture(root, 101); fx.batchModify.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error('ficticio'));
    const result = await executeGoogleTool('gmail_batch_empty_label', { label_id: 'Work_1' }, context(fx.service));
    expect(result?.response.functionResponse.response).toMatchObject({ success: false, processed: 100, partial: true, uncertain: true, recoveryRequired: true });
  });
  it.each(['gmail_get_labels', 'gmail_read_message', 'gmail_preview_organization'])('sanea una excepción inesperada del ejecutor: %s', async name => {
    const fx = mailboxFixture(root);
    const method = name === 'gmail_get_labels' ? 'getLabels' : name === 'gmail_read_message' ? 'getMessage' : 'previewOrganizationPlan';
    vi.spyOn(fx.service, method).mockRejectedValueOnce(new Error('credencial-privada-ficticia'));
    const result = await executeGoogleTool(name, { message_id: 'msg-0' }, context(fx.service));
    expect(result?.response.functionResponse.response.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain('credencial-privada-ficticia');
  });
  it.each([
    ['gmail_create_label', 'createLabel', { name: 'Nueva' }],
    ['gmail_delete_label', 'deleteLabel', { label_id: 'Work_1' }],
    ['gmail_empty_all_labels', 'emptyAndDeleteAllLabels', {}],
    ['gmail_apply_organization_plan', 'applyOrganizationPlan', { plan_id: 'gmail-plan-12345678-1234-4234-9234-123456789abc' }],
    ['gmail_undo_organization_plan', 'undoOrganizationPlan', { plan_id: 'gmail-plan-12345678-1234-4234-9234-123456789abc' }],
  ] as const)('conserva cancelación de %s sin consultas de seguimiento', async (name, method, args) => {
    const fx = mailboxFixture(root), cancelled = { success: false, cancelled: true, effectsConfirmed: 0,
      ...(method === 'emptyAndDeleteAllLabels' ? { labelsProcessed: 0, labelsDeleted: 0, totalMessagesMovedToInbox: 0, remainingLabels: [], errors: ['Operación cancelada.'] } : {}),
      ...(method === 'applyOrganizationPlan' ? { planId: 'plan_id' in args ? args.plan_id : '', groupsApplied: 0, messagesLabeled: 0, removeFromInbox: true, labelsCreated: [], labelsReused: [] } : {}),
      ...(method === 'undoOrganizationPlan' ? { planId: 'plan_id' in args ? args.plan_id : '', messagesRestored: 0, labelsDeleted: 0 } : {}) };
    const called = vi.spyOn(fx.service, method).mockResolvedValueOnce(cancelled);
    const result = await executeGoogleTool(name, args, context(fx.service));
    expect(result?.response.functionResponse.response).toBe(cancelled); expect(called).toHaveBeenCalledOnce();
    expect(fx.list).not.toHaveBeenCalled(); expect(fx.labelsList).not.toHaveBeenCalled();
  });
  it.each([
    ['google_calendar_delete', 'calendarService', 'deleteEvent', { event_id: 'evento' }],
    ['drive_create_folder', 'driveService', 'createFolder', { name: 'Carpeta' }],
    ['gchat_send_message', 'gchatService', 'sendMessage', { space_name: 'espacio', text: 'Ficticio' }],
  ] as const)('los servicios hermanos conservan su resultado: %s', async (name, service, method, args) => {
    const payload = { success: true, id: 'resultado-ficticio' }, execute = vi.fn(async () => payload);
    const ctx = { [service]: { [method]: execute } } as unknown as ToolExecutorContext;
    const result = await executeGoogleTool(name, args, ctx);
    expect(result).toEqual({ response: { functionResponse: { name, response: payload } } });
    expect(execute).toHaveBeenCalledOnce();
  });
  it('rechaza un nombre ajeno sin ejecutar otro dominio', async () => {
    expect(await executeGoogleTool('shell_no_autorizado', {}, {} as ToolExecutorContext)).toBeNull();
  });
});
