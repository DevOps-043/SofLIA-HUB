import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fixture, owner, guard, plan, cipher } from './gmail-plans/fixtures';
import { GmailPlanStore } from '../gmail/plan-storage';
import { replacePrivateFile } from '../storage/private-files';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-plan-flow-')); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });

describe('Organización Gmail con cuenta y checkpoints', () => {
  it('preview guarda sólo lo necesario, sin remitentes/asuntos en el plan persistido', async () => {
    const fx = fixture(root);
    const preview = await fx.service.previewOrganizationPlan({ minGroupSize: 1 }, fx.auth);
    expect(preview).toMatchObject({ success: true, scannedMessages: 2, groupedMessages: 2 });
    expect(preview.groups?.[0].sampleSubjects).toContain('Asunto privado de prueba');
    const saved = await fx.store.account(owner).load(preview.planId!, guard);
    expect(JSON.stringify(saved)).not.toMatch(/Asunto privado|persona@empresa|sampleSubjects|"messages"/);
  });
  it('preview incompleto por un detalle fallido no genera un plan parcial', async () => {
    const fx = fixture(root); fx.get.mockRejectedValueOnce(new Error('detalle privado'));
    expect(await fx.service.previewOrganizationPlan({ minGroupSize: 1 }, fx.auth)).toMatchObject({ success: false });
    expect(await fs.readdir(root)).toEqual([]);
  });
  it.each([{ maxMessages: 0 }, { maxMessages: 1001 }, { pageLimit: 51 }, { removeFromInbox: 'false' }, { extra: true }])('rechaza opciones cerradas: %j', async options => {
    const fx = fixture(root);
    expect(await fx.service.previewOrganizationPlan(options as never, fx.auth)).toMatchObject({ success: false });
    expect(fx.acquire).not.toHaveBeenCalled(); expect(await fs.readdir(root)).toEqual([]);
  });
  it('aplica, registra el delta actual y revierte sin repetir operaciones completas', async () => {
    const fx = fixture(root); const value = plan(); await fx.store.account(owner).save(value, guard);
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: true, groupsApplied: 1, messagesLabeled: 2 });
    expect([...fx.current.values()]).toEqual([['Label_1'], ['Label_1']]);
    const applied = await fx.store.account(owner).load(value.id, guard);
    expect(applied.applyResult?.messageChanges['msg-0']).toEqual({ addedLabelIds: ['Label_1'], removedLabelIds: ['INBOX'], expectedLabelIds: ['Label_1'] });
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: true, messagesLabeled: 2 });
    expect(fx.batchModify).toHaveBeenCalledOnce(); expect(fx.createLabel).toHaveBeenCalledOnce();
    expect(await fx.service.undoOrganizationPlan(value.id, fx.auth)).toMatchObject({ success: true, messagesRestored: 2, labelsDeleted: 1 });
    expect([...fx.current.values()]).toEqual([['INBOX'], ['INBOX']]);
    expect(await fx.service.undoOrganizationPlan(undefined, fx.auth)).toMatchObject({ success: true, messagesRestored: 2, labelsDeleted: 1 });
    expect(fx.modify).toHaveBeenCalledTimes(2); expect(fx.deleteLabel).toHaveBeenCalledOnce();
  });
  it('el delta se captura al aplicar y conserva etiquetas añadidas después del preview', async () => {
    const fx = fixture(root); const value = plan(); await fx.store.account(owner).save(value, guard);
    fx.current.set('msg-0', ['Otra']);
    await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth);
    await fx.service.undoOrganizationPlan(value.id, fx.auth);
    expect(fx.current.get('msg-0')).toEqual(['Otra']);
  });
  it('cancelar aplicar no guarda estado en curso ni toca Gmail', async () => {
    const fx = fixture(root); const value = plan(); await fx.store.account(owner).save(value, guard);
    fx.auth.approve.mockResolvedValueOnce(false);
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: false, cancelled: true });
    expect(fx.acquire).not.toHaveBeenCalled(); expect((await fx.store.account(owner).load(value.id, guard)).status).toBe('preview');
  });
  it.each(['usuario', 'revisión', 'conexión', 'email'])('cambiar %s durante aprobación impide efectos', async mode => {
    const fx = fixture(root); const value = plan(); await fx.store.account(owner).save(value, guard);
    fx.auth.approve.mockImplementationOnce(async () => {
      if (mode === 'usuario') fx.calendar.userId = 'otro';
      if (mode === 'revisión') fx.calendar.contextRevision++;
      if (mode === 'conexión') fx.calendar.connections.set('google', { ...fx.calendar.connections.get('google')! });
      if (mode === 'email') fx.calendar.connections.get('google')!.email = 'otra@example.test';
      return true;
    });
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: false });
    expect(fx.acquire).not.toHaveBeenCalled();
  });
  it('persiste intención y deltas antes de cada lote, conserva el primero confirmado tras fallo del segundo', async () => {
    const fx = fixture(root, { count: 101 }); const value = plan(101); await fx.store.account(owner).save(value, guard);
    const original = fx.batchModify.getMockImplementation()!;
    fx.batchModify.mockImplementationOnce(async args => {
      const checkpoint = await fx.store.account(owner).load(value.id, guard);
      expect(checkpoint.pending?.kind).toBe('modify'); expect(Object.keys(checkpoint.pending?.changes ?? {})).toHaveLength(100);
      return original(args);
    }).mockRejectedValueOnce(new Error('error privado del proveedor'));
    const result = await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth);
    expect(result).toMatchObject({ success: false, partial: true, uncertain: true, recoveryRequired: true, messagesLabeled: 100, groupsApplied: 0 });
    expect(JSON.stringify(result)).not.toContain('error privado');
    const saved = await fx.store.account(owner).load(value.id, guard);
    expect(saved.status).toBe('partial'); expect(saved.pending?.messageIds).toEqual(['msg-100']);
    expect(saved.applyResult?.messagesLabeled).toBe(100);
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: false, uncertain: true, messagesLabeled: 100 });
    expect(await fx.service.undoOrganizationPlan(value.id, fx.auth)).toMatchObject({ success: false, uncertain: true });
    expect(fx.batchModify).toHaveBeenCalledTimes(2); expect(fx.modify).not.toHaveBeenCalled();
  });
  it('un fallo del checkpoint previo al lote impide la mutación y permite revertir lo confirmado', async () => {
    const crypto = cipher(); let rejectBatch = false;
    const storage = new GmailPlanStore({ root: () => root, cipher: crypto, replace: async (file, bytes, assert, max) => {
      const json = await crypto.decrypt(bytes.subarray(Buffer.byteLength('SOFLIA-GMAIL-PLAN-1\n')));
      if (rejectBatch && JSON.parse(json.result).plan.pending?.kind === 'modify') throw new Error('disco ocupado');
      await replacePrivateFile(file, bytes, assert, max);
    } });
    const fx = fixture(root, { store: storage }); const value = plan(); await storage.account(owner).save(value, guard); rejectBatch = true;
    const result = await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth);
    expect(result).toMatchObject({ success: false, partial: true, messagesLabeled: 0, labelsCreated: [{ id: 'Label_1' }] });
    expect(result.uncertain).toBeUndefined(); expect(fx.batchModify).not.toHaveBeenCalled();
    expect(await fx.service.undoOrganizationPlan(value.id, fx.auth)).toMatchObject({ success: true, labelsDeleted: 1 });
  });
  it('un fallo al guardar después del efecto deja intención y conteo conocido sin replay', async () => {
    const crypto = cipher(); let fail = true;
    const storage = new GmailPlanStore({ root: () => root, cipher: crypto, replace: async (file, bytes, assert, max) => {
      const json = JSON.parse((await crypto.decrypt(bytes.subarray(Buffer.byteLength('SOFLIA-GMAIL-PLAN-1\n')))).result);
      if (fail && json.plan.applyResult?.messagesLabeled === 2 && !json.plan.pending) { fail = false; throw new Error('fallo posterior'); }
      await replacePrivateFile(file, bytes, assert, max);
    } });
    const fx = fixture(root, { store: storage }); const value = plan(); await storage.account(owner).save(value, guard);
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: false, partial: true, uncertain: true, messagesLabeled: 2 });
    expect((await storage.account(owner).load(value.id, guard)).pending?.kind).toBe('modify');
    await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth); expect(fx.batchModify).toHaveBeenCalledOnce();
  });
  it('una diferencia remota durante undo detiene el plan antes de sobrescribirla', async () => {
    const fx = fixture(root); const value = plan(); await fx.store.account(owner).save(value, guard);
    await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth);
    fx.current.set('msg-1', ['Label_1', 'CambioManual']);
    expect(await fx.service.undoOrganizationPlan(value.id, fx.auth)).toMatchObject({ success: false, partial: true, conflict: true, messagesRestored: 1 });
    expect(fx.current.get('msg-1')).toEqual(['Label_1', 'CambioManual']); expect(fx.modify).toHaveBeenCalledOnce(); expect(fx.deleteLabel).not.toHaveBeenCalled();
  });
  it('undo conserva una etiqueta creada que ahora contiene otro mensaje', async () => {
    const fx = fixture(root); const value = plan(); await fx.store.account(owner).save(value, guard);
    await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth); fx.current.set('nuevo', ['Label_1']);
    expect(await fx.service.undoOrganizationPlan(value.id, fx.auth)).toMatchObject({ success: true, labelsDeleted: 0, labelsRetained: 1 });
    expect(fx.deleteLabel).not.toHaveBeenCalled(); expect(fx.current.get('nuevo')).toEqual(['Label_1']);
  });
  it('la cuenta queda ocupada durante aprobación y vuelve a liberarse al cancelar', async () => {
    const fx = fixture(root); const value = plan(); await fx.store.account(owner).save(value, guard);
    let answer!: (value: boolean) => void; let shown!: () => void;
    const ready = new Promise<void>(resolve => { shown = resolve; });
    fx.auth.approve.mockImplementationOnce(() => { shown(); return new Promise(resolve => { answer = resolve; }); });
    const first = fx.service.applyOrganizationPlan(value.id, undefined, fx.auth); await ready;
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: false });
    answer(false); await first;
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: true });
  });

  it('un cambio de cuenta después del primer checkpoint bloquea el siguiente lote y cierra sólo el registro anterior', async () => {
    const crypto = cipher(); const state: { calendar?: ReturnType<typeof fixture>['calendar'] } = {};
    const storage = new GmailPlanStore({ root: () => root, cipher: crypto, replace: async (file, bytes, assert, max) => {
      await replacePrivateFile(file, bytes, assert, max);
      const saved = JSON.parse((await crypto.decrypt(bytes.subarray(Buffer.byteLength('SOFLIA-GMAIL-PLAN-1\n')))).result).plan;
      if (state.calendar && saved.applyResult?.messagesLabeled === 100 && !saved.pending) {
        state.calendar.userId = 'usuario-B'; state.calendar.contextRevision++;
      }
    } });
    const fx = fixture(root, { store: storage, count: 101 }); state.calendar = fx.calendar;
    const value = plan(101); await storage.account(owner).save(value, guard);
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: false, partial: true, messagesLabeled: 100 });
    expect(fx.batchModify).toHaveBeenCalledOnce(); expect(fx.acquire).toHaveBeenCalledOnce();
    expect((await storage.account(owner).load(value.id, guard)).status).toBe('partial');
    expect((await fs.readdir(path.join(root, 'gmail-private-plans')))).toHaveLength(1);
  });

  it('un efecto pendiente conservado tras reinicio bloquea apply y undo sin elegir un plan más antiguo', async () => {
    const fx = fixture(root); const old = plan(0);
    old.status = 'applied'; old.applyResult = { appliedAt: '2020-01-01T00:00:00.000Z', labelsCreated: [], labelsReused: [], messageChanges: {}, removeFromInbox: true, messagesLabeled: 0, completedGroups: [] };
    await fx.store.account(owner).save(old, guard);
    const value = plan(); value.status = 'applying'; value.applyResult = { ...old.applyResult, appliedAt: new Date().toISOString() };
    value.pending = { kind: 'create-label', labelName: 'Empresa' }; await fx.store.account(owner).save(value, guard);
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: false, uncertain: true });
    expect(await fx.service.undoOrganizationPlan(undefined, fx.auth)).toMatchObject({ success: false, planId: value.id, uncertain: true });
    expect(fx.acquire).not.toHaveBeenCalled(); expect(fx.auth.approve).not.toHaveBeenCalled();
  });

  it('un fallo del estado final conserva avances y permite undo sin volver a aplicar', async () => {
    const crypto = cipher(); let fail = true;
    const storage = new GmailPlanStore({ root: () => root, cipher: crypto, replace: async (file, bytes, assert, max) => {
      const saved = JSON.parse((await crypto.decrypt(bytes.subarray(Buffer.byteLength('SOFLIA-GMAIL-PLAN-1\n')))).result).plan;
      if (fail && saved.status === 'applied') { fail = false; throw new Error('estado final no publicado'); }
      await replacePrivateFile(file, bytes, assert, max);
    } });
    const fx = fixture(root, { store: storage }); const value = plan(); await storage.account(owner).save(value, guard);
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: false, messagesLabeled: 2 });
    expect((await storage.account(owner).load(value.id, guard)).status).toBe('partial');
    expect(await fx.service.undoOrganizationPlan(value.id, fx.auth)).toMatchObject({ success: true, messagesRestored: 2 });
    expect(fx.batchModify).toHaveBeenCalledOnce();
  });

  it('si cambia la sesión durante undo no restaura el siguiente mensaje', async () => {
    const fx = fixture(root); const value = plan(); await fx.store.account(owner).save(value, guard);
    await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth);
    const original = fx.modify.getMockImplementation()!;
    fx.modify.mockImplementationOnce(async args => { const result = await original(args); fx.calendar.contextRevision++; return result; });
    expect(await fx.service.undoOrganizationPlan(value.id, fx.auth)).toMatchObject({ success: false, partial: true, uncertain: true });
    expect(fx.modify).toHaveBeenCalledOnce(); expect(fx.deleteLabel).not.toHaveBeenCalled();
    expect((await fx.store.account(owner).load(value.id, guard)).pending?.kind).toBe('restore');
  });

  it('limita a ocho las lecturas simultáneas del estado previo y acota cada petición', async () => {
    const fx = fixture(root, { count: 17 }); const value = plan(17); await fx.store.account(owner).save(value, guard);
    const original = fx.get.getMockImplementation()!; let active = 0, maximum = 0;
    fx.get.mockImplementation(async args => {
      active++; maximum = Math.max(active, maximum); await new Promise(resolve => setImmediate(resolve));
      const result = await original(args); active--; return result;
    });
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: true, messagesLabeled: 17 });
    expect(maximum).toBe(8);
    expect(fx.get).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ timeout: 15000, retry: false, signal: expect.any(AbortSignal) }));
  });

  it('el presupuesto de trabajo vencido impide iniciar otro lote', async () => {
    const fx = fixture(root, { count: 101 }); const value = plan(101); await fx.store.account(owner).save(value, guard);
    const original = fx.batchModify.getMockImplementation()!;
    fx.batchModify.mockImplementationOnce(async args => {
      const result = await original(args); const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now + 90001); return result;
    });
    expect(await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth)).toMatchObject({ success: false, uncertain: true });
    expect(fx.batchModify).toHaveBeenCalledOnce();
  });
});
