import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mailboxFixture } from './gmail-mailbox/fixtures';
import { guard, owner, plan } from './gmail-plans/fixtures';
import { gmailExecutionContext } from '../gmail/execution-context';
import { selectGmailLabelMessages } from '../gmail/batch';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-mailbox-')); });
afterEach(async () => { vi.restoreAllMocks(); vi.useRealTimers(); await fs.rm(root, { recursive: true, force: true }); });

describe('Buzón Gmail con contexto y avance explícitos', () => {
  it.each(['../correo', '', '__proto__', 'constructor'])('rechaza ID antes de adquirir cliente: %s', async id => {
    const fx = mailboxFixture(root);
    expect(await fx.service.trashMessage(id, fx.auth)).toMatchObject({ success: false });
    expect(fx.acquire).not.toHaveBeenCalled(); expect(fx.trash).not.toHaveBeenCalled();
  });
  it.each([{ maxResults: 0 }, { maxResults: 101 }, { extra: true }, { query: 'x'.repeat(4097) }])('rechaza opciones de lectura: %#', async options => {
    const fx = mailboxFixture(root);
    expect(await fx.service.getMessages(options as never, fx.auth)).toMatchObject({ success: false });
    expect(fx.acquire).not.toHaveBeenCalled();
  });
  it('rechaza propietario incorrecto antes de adquirir cliente', async () => {
    const fx = mailboxFixture(root); fx.calendar.connections.get('google')!.userId = 'otro';
    expect(await fx.service.getLabels(fx.auth)).toMatchObject({ success: false }); expect(fx.acquire).not.toHaveBeenCalled();
  });
  it('no devuelve contenido si cambia sesión durante una lectura', async () => {
    const fx = mailboxFixture(root);
    fx.labelsList.mockImplementationOnce(async () => { fx.calendar.contextRevision++; return { data: { labels: [{ id: 'Work_1', name: 'Privada', type: 'user' }] } }; });
    const result = await fx.service.getLabels(fx.auth);
    expect(result).toMatchObject({ success: false }); expect(result.labels).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('Privada');
  });
  it('una lectura de detalles incompleta no anuncia éxito ni devuelve otra selección', async () => {
    const fx = mailboxFixture(root); fx.get.mockResolvedValueOnce(await fx.get.getMockImplementation()!({ id: 'otro-mensaje' }));
    expect(await fx.service.getMessages(undefined, fx.auth)).toMatchObject({ success: false });
  });
  it('un mensaje individual de ID diferente no vuelve al renderer', async () => {
    const fx = mailboxFixture(root); fx.get.mockResolvedValueOnce(await fx.get.getMockImplementation()!({ id: 'otro-mensaje' }));
    const result = await fx.service.getMessage('msg-0', fx.auth);
    expect(result.success).toBe(false); expect(result.message).toBeUndefined();
  });
  it('cancelar papelera no adquiere cliente ni muta', async () => {
    const fx = mailboxFixture(root); fx.auth.approve.mockResolvedValueOnce(false);
    expect(await fx.service.trashMessage('msg-0', fx.auth)).toMatchObject({ success: false, cancelled: true });
    expect(fx.acquire).not.toHaveBeenCalled(); expect(fx.current.get('msg-0')).toContain('INBOX');
  });
  it('resuelve todas las referencias antes de crear una etiqueta', async () => {
    const fx = mailboxFixture(root);
    expect(await fx.service.modifyLabels('msg-0', ['Nueva'], ['Inexistente'], fx.auth)).toMatchObject({ success: false, effectsConfirmed: 0 });
    expect(fx.createLabel).not.toHaveBeenCalled(); expect(fx.auth.approve).not.toHaveBeenCalled();
  });
  it('rechaza añadir y quitar la misma etiqueta mediante nombre e ID', async () => {
    const fx = mailboxFixture(root);
    expect(await fx.service.modifyLabels('msg-0', ['Trabajo'], ['Work_1'], fx.auth)).toMatchObject({ success: false });
    expect(fx.modify).not.toHaveBeenCalled();
  });
  it('confirma las etiquetas nuevas, comparte cliente y devuelve sus creaciones', async () => {
    const fx = mailboxFixture(root);
    expect(await fx.service.modifyLabels('msg-0', ['Nueva', 'Trabajo'], ['INBOX'], fx.auth)).toMatchObject({ success: true, effectsConfirmed: 2, labelsCreated: [{ id: 'Label_1', name: 'Nueva' }] });
    expect(fx.auth.approve.mock.calls[0][0]).toContain('Crear: Nueva');
    expect(fx.acquire).toHaveBeenCalledOnce(); expect(fx.current.get('msg-0')).toEqual(['Work_1', 'Label_1']);
    expect(vi.mocked(fx.client.users.messages.modify).mock.calls[0][1]).toMatchObject({ timeout: 15000, retry: false, signal: expect.any(AbortSignal) });
  });
  it('un fallo posterior a crear etiqueta conserva el avance y sanea el error', async () => {
    const fx = mailboxFixture(root); fx.modify.mockRejectedValueOnce(new Error('token-privado-prueba'));
    const result = await fx.service.modifyLabels('msg-0', ['Nueva'], ['INBOX'], fx.auth);
    expect(result).toMatchObject({ success: false, effectsConfirmed: 1, partial: true, uncertain: true, recoveryRequired: true, labelsCreated: [{ name: 'Nueva' }] });
    expect(JSON.stringify(result)).not.toContain('token-privado-prueba');
  });
  it.each(['INBOX', 'SENT', 'TRASH'])('no borra etiqueta de sistema: %s', async id => {
    const fx = mailboxFixture(root);
    expect(await fx.service.deleteLabel(id, fx.auth)).toMatchObject({ success: false }); expect(fx.deleteLabel).not.toHaveBeenCalled();
  });
  it('crear una etiqueta existente no repite efecto ni exige permiso nuevo', async () => {
    const fx = mailboxFixture(root);
    expect(await fx.service.createLabel('Trabajo', fx.auth)).toMatchObject({ success: true, label: { id: 'Work_1' }, effectsConfirmed: 0 });
    expect(fx.createLabel).not.toHaveBeenCalled(); expect(fx.auth.approve).not.toHaveBeenCalled();
  });
  it('crear por nombre no confunde el texto con el ID de otra etiqueta', async () => {
    const fx = mailboxFixture(root);
    expect(await fx.service.createLabel('Work_1', fx.auth)).toMatchObject({ success: true, label: { id: 'Label_1', name: 'Work_1' } });
    expect(fx.createLabel).toHaveBeenCalledOnce();
  });
  it('rechaza una referencia que coincide con el ID y nombre de etiquetas diferentes', async () => {
    const fx = mailboxFixture(root); fx.labels.set('Ambigua', { id: 'Ambigua', name: 'Work_1' });
    expect(await fx.service.modifyLabels('msg-0', ['Work_1'], [], fx.auth)).toMatchObject({ success: false });
    expect(fx.modify).not.toHaveBeenCalled(); expect(fx.createLabel).not.toHaveBeenCalled();
  });
  it('una respuesta de creación inválida queda incierta y no se usa para modificar', async () => {
    const fx = mailboxFixture(root); fx.createLabel.mockResolvedValueOnce({ data: { id: '', name: 'Nueva' } });
    expect(await fx.service.modifyLabels('msg-0', ['Nueva'], [], fx.auth)).toMatchObject({ success: false, uncertain: true });
    expect(fx.modify).not.toHaveBeenCalled();
  });
  it('no consume el presupuesto de trabajo durante la confirmación humana', async () => {
    const fx = mailboxFixture(root); vi.useFakeTimers(); const initial = Date.now(); vi.setSystemTime(initial);
    fx.auth.approve.mockImplementationOnce(async () => { vi.setSystemTime(initial + 119000); return true; });
    expect(await fx.service.modifyLabels('msg-0', ['Trabajo'], ['INBOX'], fx.auth)).toMatchObject({ success: true });
  });
  it('comparte exclusión con los planes y libera la cuenta al cancelar', async () => {
    const fx = mailboxFixture(root); const value = plan(0); await fx.store.account(owner).save(value, guard);
    let release!: (value: boolean) => void, entered!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    fx.auth.approve.mockImplementationOnce(() => { entered(); return new Promise<boolean>(resolve => { release = resolve; }); });
    const pending = fx.service.trashMessage('msg-0', fx.auth); await waiting;
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: false });
    release(false); await pending;
    expect(await fx.service.trashMessage('msg-0', fx.auth)).toMatchObject({ success: true });
  });
  it('procesa una selección paginada una vez aunque conserve la etiqueta de origen', async () => {
    const fx = mailboxFixture(root, 101);
    const result = await fx.service.batchModifyByLabel('Work_1', { addLabels: ['Otra'], removeLabels: [] }, fx.auth);
    expect(result).toMatchObject({ success: true, processed: 101, sourceEmpty: false, labelDeleted: false });
    expect(result.remaining).toBeUndefined(); expect(fx.batchModify).toHaveBeenCalledTimes(2);
    const ids = fx.batchModify.mock.calls.flatMap(([args]) => args.requestBody.ids);
    expect(new Set(ids).size).toBe(101); expect(ids).toHaveLength(101);
    expect(fx.list.mock.calls.slice(0, 2).map(([args]) => args.pageToken)).toEqual([undefined, '100']);
  });
  it('permite archivar un snapshot de Recibidos sin borrar su etiqueta de sistema', async () => {
    const fx = mailboxFixture(root);
    expect(await fx.service.batchModifyByLabel('INBOX', { addLabels: [], removeLabels: ['INBOX'] }, fx.auth))
      .toMatchObject({ success: true, processed: 2, sourceEmpty: true, remaining: 0, labelDeleted: false });
    expect(fx.current.get('msg-0')).toEqual(['Work_1']); expect(fx.deleteLabel).not.toHaveBeenCalled();
  });
  it('no permite borrar una etiqueta de sistema después de un lote', async () => {
    const fx = mailboxFixture(root);
    expect(await fx.service.batchModifyByLabel('INBOX', { addLabels: [], removeLabels: ['INBOX'], deleteLabel: true }, fx.auth))
      .toMatchObject({ success: false, processed: 0, effectsConfirmed: 0 });
    expect(fx.batchModify).not.toHaveBeenCalled(); expect(fx.deleteLabel).not.toHaveBeenCalled();
  });
  it('un fallo en el segundo lote conserva cien confirmados y no borra la etiqueta', async () => {
    const fx = mailboxFixture(root, 201); fx.batchModify.mockImplementationOnce(async () => {
      for (let index = 0; index < 100; index++) fx.current.set('msg-' + index, ['INBOX']); return { data: {} };
    }).mockRejectedValueOnce(new Error('secreto-ficticio'));
    expect(await fx.service.batchModifyByLabel('Work_1', { deleteLabel: true }, fx.auth)).toMatchObject({ success: false, processed: 100,
      effectsConfirmed: 1, partial: true, uncertain: true, recoveryRequired: true, labelDeleted: false });
    expect(fx.batchModify).toHaveBeenCalledTimes(2); expect(fx.deleteLabel).not.toHaveBeenCalled();
  });
  it('conserva una etiqueta con correo nuevo después del snapshot aprobado', async () => {
    const fx = mailboxFixture(root);
    fx.auth.approve.mockImplementationOnce(async () => { fx.current.set('nuevo', ['Work_1']); return true; });
    expect(await fx.service.batchModifyByLabel('Work_1', { deleteLabel: true }, fx.auth)).toMatchObject({ success: false, processed: 2, partial: true, conflict: true, sourceEmpty: false });
    expect(fx.current.get('nuevo')).toEqual(['Work_1']); expect(fx.deleteLabel).not.toHaveBeenCalled();
  });
  it('rechaza borrar tras un lote que no retira la etiqueta origen, antes de mutar', async () => {
    const fx = mailboxFixture(root);
    expect(await fx.service.batchModifyByLabel('Work_1', { addLabels: ['Otra'], removeLabels: [], deleteLabel: true }, fx.auth)).toMatchObject({ success: false, effectsConfirmed: 0 });
    expect(fx.auth.approve).not.toHaveBeenCalled(); expect(fx.batchModify).not.toHaveBeenCalled();
  });
  it('detecta paginación que repite mensajes antes del primer efecto', async () => {
    const fx = mailboxFixture(root);
    fx.list.mockResolvedValue({ data: { messages: [{ id: 'msg-0' }], nextPageToken: 'repetido' } });
    expect(await fx.service.batchModifyByLabel('Work_1', undefined, fx.auth)).toMatchObject({ success: false, effectsConfirmed: 0 });
    expect(fx.auth.approve).not.toHaveBeenCalled(); expect(fx.batchModify).not.toHaveBeenCalled();
  });
  it('rechaza selección excesiva sin truncar ni mutar', async () => {
    const fx = mailboxFixture(root);
    const context = gmailExecutionContext(fx.calendar, async () => ({ client: fx.client }), fx.auth);
    await expect(selectGmailLabelMessages(context, 'Work_1', 1)).rejects.toThrow('cuota');
    expect(fx.batchModify).not.toHaveBeenCalled();
  });
  it('un fallo de borrado de etiqueta no se anuncia como éxito del lote', async () => {
    const fx = mailboxFixture(root); fx.deleteLabel.mockRejectedValueOnce(new Error('fallo-privado'));
    expect(await fx.service.batchModifyByLabel('Work_1', { deleteLabel: true }, fx.auth)).toMatchObject({ success: false, processed: 2, remaining: 0, partial: true, uncertain: true, labelDeleted: false });
  });
  it('un fallo de la última verificación conserva los lotes confirmados y remaining desconocido', async () => {
    const fx = mailboxFixture(root); const list = fx.list.getMockImplementation()!;
    fx.list.mockImplementation(async args => { if (args.maxResults === 1) throw new Error('verificación privada'); return list(args); });
    const result = await fx.service.batchModifyByLabel('Work_1', undefined, fx.auth);
    expect(result).toMatchObject({ success: false, processed: 2, partial: true, effectsConfirmed: 1 });
    expect(result.remaining).toBeUndefined(); expect(result.uncertain).toBeUndefined();
  });
  it('el error de preflight en otra página no aplica una selección truncada', async () => {
    const fx = mailboxFixture(root, 101); const list = fx.list.getMockImplementation()!;
    fx.list.mockImplementation(async args => { if (args.pageToken) throw new Error('segunda página'); return list(args); });
    expect(await fx.service.batchModifyByLabel('Work_1', undefined, fx.auth)).toMatchObject({ success: false, processed: 0, effectsConfirmed: 0 });
    expect(fx.batchModify).not.toHaveBeenCalled(); expect(fx.auth.approve).not.toHaveBeenCalled();
  });
  it('rechaza limpiar más de cien etiquetas antes de aprobar o mutar', async () => {
    const fx = mailboxFixture(root);
    for (let index = 0; index < 100; index++) fx.labels.set('Extra_' + index, { id: 'Extra_' + index, name: 'Extra ' + index });
    expect(await fx.service.emptyAndDeleteAllLabels(fx.auth)).toMatchObject({ success: false, labelsProcessed: 0, effectsConfirmed: 0 });
    expect(fx.auth.approve).not.toHaveBeenCalled(); expect(fx.batchModify).not.toHaveBeenCalled(); expect(fx.deleteLabel).not.toHaveBeenCalled();
  });
  it('limpieza completa selecciona todo antes de aprobar y devuelve éxito verificado', async () => {
    const fx = mailboxFixture(root);
    const result = await fx.service.emptyAndDeleteAllLabels(fx.auth);
    expect(result).toMatchObject({ success: true, labelsProcessed: 2, labelsDeleted: 2, totalMessagesMovedToInbox: 2,
      remainingLabels: [], remainingLabelsVerified: true, errors: [] });
    expect(fx.auth.approve).toHaveBeenCalledOnce(); expect(fx.labels.has('INBOX')).toBe(true);
  });
  it('un listado sin tipo no permite anunciar que se limpiaron todas las etiquetas', async () => {
    const fx = mailboxFixture(root);
    fx.labelsList.mockResolvedValueOnce({ data: { labels: [{ id: 'Work_1', name: 'Trabajo' }] } } as never);
    expect(await fx.service.emptyAndDeleteAllLabels(fx.auth)).toMatchObject({ success: false, effectsConfirmed: 0, remainingLabelsVerified: false });
    expect(fx.deleteLabel).not.toHaveBeenCalled(); expect(fx.auth.approve).not.toHaveBeenCalled();
  });
  it('limpieza detiene el resto tras un fallo y conserva conteos/etiquetas restantes', async () => {
    const fx = mailboxFixture(root); fx.deleteLabel.mockImplementationOnce(async () => { fx.labels.delete('Work_1'); return { data: {} }; })
      .mockRejectedValueOnce(new Error('fallo-privado'));
    const result = await fx.service.emptyAndDeleteAllLabels(fx.auth);
    expect(result).toMatchObject({ success: false, labelsProcessed: 2, labelsDeleted: 1, totalMessagesMovedToInbox: 2,
      partial: true, uncertain: true, remainingLabels: ['Otra'], remainingLabelsVerified: false });
    expect(result.errors).toHaveLength(1); expect(JSON.stringify(result)).not.toContain('fallo-privado');
  });
  it('el avance de limpieza distingue IDs aunque el proveedor repita un nombre', async () => {
    const fx = mailboxFixture(root, 0); fx.labels.set('Other_1', { id: 'Other_1', name: 'Trabajo' });
    fx.deleteLabel.mockImplementationOnce(async () => { fx.labels.delete('Work_1'); return { data: {} }; }).mockRejectedValueOnce(new Error('fallo'));
    expect(await fx.service.emptyAndDeleteAllLabels(fx.auth)).toMatchObject({ success: false, labelsDeleted: 1, remainingLabels: ['Trabajo'], partial: true });
  });
  it('un cambio entre el acuse conocido y el siguiente lote conserva cien confirmados', async () => {
    const fx = mailboxFixture(root, 101); const apply = fx.batchModify.getMockImplementation()!;
    fx.batchModify.mockImplementationOnce(async args => {
      const response = await apply(args);
      queueMicrotask(() => queueMicrotask(() => { fx.calendar.contextRevision++; }));
      return response;
    });
    const result = await fx.service.batchModifyByLabel('Work_1', undefined, fx.auth);
    expect(result).toMatchObject({ success: false, processed: 100, effectsConfirmed: 1, partial: true, recoveryRequired: true });
    expect(fx.batchModify).toHaveBeenCalledOnce();
  });
  it('no inicia el segundo lote si cambia la conexión tras el primero', async () => {
    const fx = mailboxFixture(root, 101);
    fx.batchModify.mockImplementationOnce(async () => { fx.calendar.contextRevision++; return { data: {} }; });
    expect(await fx.service.batchModifyByLabel('Work_1', undefined, fx.auth)).toMatchObject({ success: false, uncertain: true, processed: 0 });
    expect(fx.batchModify).toHaveBeenCalledOnce();
  });
});
