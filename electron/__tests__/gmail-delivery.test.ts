import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { appendFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarService } from '../calendar-service';
import type { GmailClient } from '../gmail/types';
import { sendGmailEmail, type GmailSendAuthorization } from '../gmail/delivery';
import { prepareGmailAttachments } from '../gmail/attachments';
import { GMAIL_DELIVERY_LIMITS } from '../../src/shared/gmail-delivery';

let root: string;
const input = () => ({ to: ['Destino <dest@example.test>'], subject: 'Informe', body: 'Contenido del informe' });
function fixture() {
  const send = vi.fn().mockResolvedValue({ data: { id: 'enviado-1' } });
  const getClient = vi.fn(async () => ({ client: { users: { messages: { send } } } as unknown as GmailClient }));
  const connection = { provider: 'google', userId: 'usuario', email: 'cuenta@example.test', isActive: true };
  const calendar = { userId: 'usuario', contextRevision: 0, connections: new Map([['google', connection]]) } as unknown as CalendarService;
  const deliver = (params: unknown, approve: GmailSendAuthorization['approve'] = vi.fn(async () => true)) => sendGmailEmail(getClient, calendar, params as Parameters<typeof sendGmailEmail>[2], { userId: 'usuario', assertCurrent: () => {}, approve });
  return { calendar, send, getClient, deliver };
}
async function file(name: string, contents = 'documento completo') {
  const target = path.join(root, name); await fs.writeFile(target, contents); return target;
}

beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-gmail-delivery-')); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });

describe('Entrega íntegra Gmail', () => {
  it.each([
    null, {}, { ...input(), to: [] }, { ...input(), to: ['a@example.test, b@example.test'] },
    { ...input(), to: ['a@example.test <b@example.test>'] }, { ...input(), to: ['a@example.test\nBcc: oculto@example.test'] },
    { ...input(), subject: 'Hola\r\nBcc: oculto@example.test' }, { ...input(), subject: 'x'.repeat(301) },
    { ...input(), body: 'x'.repeat(200001) }, { ...input(), cc: Array(20).fill('a@example.test') },
    { ...input(), isHtml: 'false' }, { ...input(), attachmentPaths: Array(11).fill('/tmp/a') },
    { ...input(), extra: true }, { ...input(), to: [12] },
  ])('rechaza entradas inválidas antes de abrir archivos o pedir cliente: %#', async params => {
    const { deliver, send, getClient } = fixture();
    const read = vi.spyOn(fs, 'open');
    expect(await deliver(params)).toMatchObject({ success: false });
    expect(read).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled(); expect(getClient).not.toHaveBeenCalled();
  });

  it('un adjunto ausente impide enviar incluso si otro ya se preparó', async () => {
    const { deliver, send } = fixture();
    const first = await file('primero.txt');
    const approve = vi.fn(async () => true);
    expect(await deliver({ ...input(), attachmentPaths: [first, path.join(root, 'ausente.txt')] }, approve)).toMatchObject({ success: false });
    expect(approve).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });

  it.each(['relativa.txt', 'https://example.test/documento', '\\\\servidor\\documento'])('rechaza rutas no locales absolutas: %s', async target => {
    const { deliver, send } = fixture();
    expect(await deliver({ ...input(), attachmentPaths: [target] })).toMatchObject({ success: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('rechaza directorios y archivos por encima de la cuota antes de leerlos', async () => {
    const { deliver, send } = fixture();
    expect(await deliver({ ...input(), attachmentPaths: [root] })).toMatchObject({ success: false });
    const large = await file('grande.bin', '');
    await fs.truncate(large, GMAIL_DELIVERY_LIMITS.attachmentBytes + 1);
    const open = vi.spyOn(fs, 'open');
    expect(await deliver({ ...input(), attachmentPaths: [large] })).toMatchObject({ success: false });
    expect(open).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });

  it('rechaza enlaces finales sin leer su contenido', async () => {
    const target = await file('original.txt');
    const linked = path.join(root, 'enlace');
    // Junction es creable sin privilegios en Windows; el enlace final se deniega igual.
    await fs.symlink(process.platform === 'win32' ? root : target, linked, process.platform === 'win32' ? 'junction' : 'file');
    await expect(prepareGmailAttachments([linked], () => {})).rejects.toThrow();
  });

  it('incluye todos los bytes y mantiene la copia autorizada aunque cambie el archivo', async () => {
    const { deliver, send } = fixture();
    const target = await file('informe.txt', 'copia autorizada');
    const approve = vi.fn(async (detail: string) => {
      expect(detail).toContain(target); expect(detail).toContain(`${Buffer.byteLength('copia autorizada')} bytes`);
      await fs.writeFile(target, 'copia cambiada'); return true;
    });
    expect(await deliver({ ...input(), attachmentPaths: [target] }, approve)).toMatchObject({ success: true });
    const raw = Buffer.from(send.mock.calls[0][0].requestBody.raw, 'base64url').toString('utf8');
    expect(raw).toContain(Buffer.from('copia autorizada').toString('base64'));
    expect(raw).not.toContain(Buffer.from('copia cambiada').toString('base64'));
    expect(send).toHaveBeenCalledOnce();
  });

  it('preserva Unicode y BCC sin interpolar nombres en cabeceras', async () => {
    const { deliver, send } = fixture();
    const target = await file(process.platform === 'win32' ? 'revisión final.txt' : 'revisión "final".txt', 'datos');
    expect(await deliver({ ...input(), subject: 'Revisión 📄', body: 'Información útil', bcc: ['privado@example.test'], attachmentPaths: [target] })).toMatchObject({ success: true });
    const raw = Buffer.from(send.mock.calls[0][0].requestBody.raw, 'base64url').toString('utf8');
    expect(raw).toContain('Bcc: privado@example.test');
    expect(raw).toMatch(/Subject: =\?UTF-8\?[BQ]\?/i);
    expect(raw).toContain('Content-Disposition: attachment;');
    expect(raw).toContain('\r\n\r\n');
    expect(raw).not.toMatch(/(?<!\r)\n|\r(?!\n)/);
    expect(raw).not.toContain('filename="revisión "final".txt"');
    expect(raw.split('\r\n').every(line => Buffer.byteLength(line) <= 998)).toBe(true);
  });

  it('cancelar la aprobación no inicia transporte', async () => {
    const { deliver, send, getClient } = fixture();
    expect(await deliver(input(), vi.fn(async () => false))).toMatchObject({ success: false, cancelled: true });
    expect(send).not.toHaveBeenCalled(); expect(getClient).not.toHaveBeenCalled();
  });

  it.each(['revisión', 'conexión', 'dueño'])('el cambio de %s durante aprobación bloquea transporte', async mode => {
    const { deliver, send, calendar } = fixture();
    const approve = vi.fn(async () => {
      if (mode === 'revisión') calendar.contextRevision++;
      if (mode === 'conexión') calendar.connections.set('google', { ...calendar.connections.get('google')! });
      if (mode === 'dueño') calendar.userId = 'otra-cuenta';
      return true;
    });
    expect(await deliver(input(), approve)).toMatchObject({ success: false });
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['fallo', 'sin-id', 'logout'])('el resultado %s después de iniciar transporte es incierto y no se reintenta', async mode => {
    const { deliver, send, calendar } = fixture();
    send.mockImplementationOnce(async () => {
      if (mode === 'fallo') throw new Error('token-secreto y ruta privada');
      if (mode === 'logout') calendar.contextRevision++;
      return { data: mode === 'sin-id' ? {} : { id: 'enviado-1' } };
    });
    const result = await deliver(input());
    expect(result).toMatchObject({ success: false, uncertain: true });
    expect(JSON.stringify(result)).not.toContain('token-secreto'); expect(send).toHaveBeenCalledOnce();
  });

  it('una sesión vencida durante lectura cierra el handle y no confirma', async () => {
    const target = await file('lectura.txt', 'datos');
    const originalOpen = fs.open.bind(fs);
    const closed = vi.fn();
    vi.spyOn(fs, 'open').mockImplementation(async (...args: Parameters<typeof fs.open>) => {
      const handle = await originalOpen(...args);
      const close = handle.close.bind(handle);
      vi.spyOn(handle, 'close').mockImplementation(async () => { closed(); await close(); });
      return handle;
    });
    let calls = 0;
    await expect(prepareGmailAttachments([target], () => { if (++calls === 4) throw new Error('sesión vencida'); })).rejects.toThrow('sesión vencida');
    expect(closed).toHaveBeenCalledOnce();
  });

  it('detecta crecimiento mientras lee el archivo', async () => {
    const target = await file('creciente.txt', 'datos');
    let calls = 0;
    await expect(prepareGmailAttachments([target], () => { if (++calls === 5) appendFileSync(target, 'contenido tardío'); })).rejects.toThrow('attachment_changed');
  });

  it('limita el total aunque cada archivo individual esté dentro de cuota', async () => {
    const first = await file('primero.bin', ''); const second = await file('segundo.bin', ''); const third = await file('tercero.bin', 'x');
    await fs.truncate(first, GMAIL_DELIVERY_LIMITS.attachmentBytes);
    await fs.truncate(second, GMAIL_DELIVERY_LIMITS.attachmentBytes);
    const { deliver, send } = fixture();
    expect(await deliver({ ...input(), attachmentPaths: [first, second, third] })).toMatchObject({ success: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('el fallo de permisos no expone ruta y no envía', async () => {
    const target = await file('privado.txt');
    const { deliver, send } = fixture();
    vi.spyOn(fs, 'open').mockRejectedValueOnce(new Error('EACCES ' + target));
    const result = await deliver({ ...input(), attachmentPaths: [target] });
    expect(result).toMatchObject({ success: false });
    expect(JSON.stringify(result)).not.toContain(target); expect(send).not.toHaveBeenCalled();
  });
});
