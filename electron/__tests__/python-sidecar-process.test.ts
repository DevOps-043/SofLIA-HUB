import { spawn } from 'node:child_process';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SidecarConnection } from '../python/sidecar-connection';

const processes: { connection: SidecarConnection; closed: Promise<unknown> }[] = [];
function fixture(protocol: number) {
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', VITE_DEV_SERVER_URL: '', APP_ROOT: '', VITE_PUBLIC: '',
    ...Object.fromEntries(['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap(key => process.env[key] ? [[key, process.env[key]!]] : [])) };
  const child = spawn(process.execPath, [path.resolve('test/fixtures/sidecar-protocol.cjs'), String(protocol)], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env });
  const closed = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  const connection = new SidecarConnection(child, { protocol, readyTimeoutMs: 3000, onMessage: () => {}, onClosed: () => {} });
  processes.push({ connection, closed }); return { connection, child, closed };
}
afterEach(async () => { for (const f of processes.splice(0)) { await f.connection.stop(); await f.closed; } });
describe('Stdio real con proveedor Node ficticio', () => {
  it.each([1, 4])('protocolo %s conserva Unicode fragmentado, IDs y una sola petición', async protocol => {
    const f = fixture(protocol); await f.connection.start();
    expect(await f.connection.request('fragment', { text: 'Dictado íntegro á 🚀' }, 3000)).toMatchObject({ ok: true, text: 'Dictado íntegro á 🚀', received: 1, protocol });
    expect(await f.connection.request('ping', {}, 3000)).toMatchObject({ received: 2 });
  });
  it('salida en medio de petición rechaza y cierra el hijo real', async () => {
    const f = fixture(4); await f.connection.start();
    await expect(f.connection.request('crash', {}, 3000)).rejects.toMatchObject({ code: 'SIDECAR_CRASHED' });
    expect(await f.closed).toMatchObject({ code: 3 }); expect(f.connection.running).toBe(false);
  });
  it('timeout real no repite el comando y deja disponible la generación', async () => {
    const f = fixture(4); await f.connection.start();
    await expect(f.connection.request('slow', {}, 50)).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(await f.connection.request('ping', {}, 3000)).toMatchObject({ received: 2, pong: true });
  });
  it('UTF-8 inválido retira el hijo sin interpretar bytes como evento', async () => {
    const f = fixture(4); await f.connection.start();
    await expect(f.connection.request('invalid', {}, 3000)).rejects.toMatchObject({ code: 'SIDECAR_PROTOCOL_ERROR' });
    await f.closed; expect(f.connection.running).toBe(false);
  });
});
