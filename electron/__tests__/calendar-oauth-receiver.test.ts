import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { createOAuthProof, validOAuthCode, validateOAuthDestination } from '../calendar/oauth-proof';
import { createOAuthReceiver } from '../calendar/oauth-receiver';

const receivers: ReturnType<typeof createOAuthReceiver>[] = [];
afterEach(async () => { await Promise.all(receivers.splice(0).map(receiver => receiver.cancel())); });
async function receiver(assertCurrent = () => {}, timeoutMs = 300000) {
  const proof = createOAuthProof();
  const value = createOAuthReceiver({ state: proof.state, assertCurrent, port: 0, timeoutMs }); receivers.push(value);
  expect(await value.ready).toBe(true);
  return { ...value, proof, port: value.address()!.port };
}
function request(port: number, target: string, options: { method?: string; host?: string } = {}) {
  return new Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: target, method: options.method ?? 'GET',
      headers: { Host: options.host ?? `localhost:${port}` }, agent: false }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', text => { body += text; });
      response.once('end', () => resolve({ status: response.statusCode!, body, headers: response.headers }));
    });
    req.once('error', reject); req.end();
  });
}

describe('Prueba y fronteras OAuth', () => {
  it('genera state/verifier distintos, inmutables y challenge S256 verificable', () => {
    const proofs = Array.from({ length: 4 }, () => createOAuthProof());
    expect(new Set(proofs.map(proof => proof.state)).size).toBe(4);
    expect(new Set(proofs.map(proof => proof.verifier)).size).toBe(4);
    for (const proof of proofs) {
      expect(Object.isFrozen(proof)).toBe(true);
      expect(proof.state).toMatch(/^[\w-]{43}$/);
      expect(proof.challenge).toBe(createHash('sha256').update(proof.verifier).digest('base64url'));
    }
  });
  it.each(['', 'https://ajeno.invalid/codigo', '//ajeno.invalid', 'a b', 'a\n', 'a'.repeat(8193)])('rechaza código vacío, URL o fuera de contrato: caso %#', code => {
    expect(validOAuthCode(code)).toBe(false);
  });
  it('vincula origen, ruta, clientId, state, challenge y redirect de autorización', () => {
    const proof = createOAuthProof();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: 'ficticio', response_type: 'code', state: proof.state,
      redirect_uri: 'http://localhost:8234/callback', code_challenge: proof.challenge, code_challenge_method: 'S256' }).toString();
    expect(() => validateOAuthDestination(url.href, 'google', proof, 'ficticio')).not.toThrow();
    for (const [field, value] of [['state', 'ajeno'], ['code_challenge', 'ajeno'], ['client_id', 'otro'], ['redirect_uri', 'http://ajeno.invalid/'], ['response_type', 'token']]) {
      const changed = new URL(url); changed.searchParams.set(field, value);
      expect(() => validateOAuthDestination(changed.href, 'google', proof, 'ficticio')).toThrow();
    }
    for (const modified of [url.href.replace('accounts.google.com', 'accounts.google.com.ajeno.invalid'), url.href.replace('https:', 'http:'), url.href + '#fragmento', url.href + '&state=duplicado', url.href.replace('/o/oauth2/v2/auth', '/otra')]) {
      expect(() => validateOAuthDestination(modified, 'google', proof, 'ficticio')).toThrow();
    }
  });
});

describe('Receptor TCP local real', () => {
  it('no refleja datos y entrega código sólo tras retirar el listener', async () => {
    const flow = await receiver();
    const code = 'codigo-ficticio-privado';
    const response = await request(flow.port, '/callback?' + new URLSearchParams({ state: flow.proof.state, code }));
    expect(response.status).toBe(200); expect(response.body).not.toContain(code);
    expect(response.headers['cache-control']).toBe('no-store'); expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(await flow.result).toBe(code); expect(flow.address()).toBeNull();
    const probe = net.createServer(); await new Promise<void>((resolve, reject) => probe.once('error', reject).listen(flow.port, '127.0.0.1', resolve));
    await new Promise<void>(resolve => probe.close(() => resolve()));
  });
  it.each([
    { target: '/otra?code=ficticio', status: 404 },
    { target: '/callback?state=ajeno&code=ficticio', status: 403 },
    { target: '/callback?state=STATE&state=STATE&code=ficticio', status: 403 },
    { target: '/callback?state=STATE&code=a&code=b', status: 400 },
    { target: '/callback?state=STATE&code=https%3A%2F%2Fajeno.invalid', status: 400 },
    { target: '/callback?state=STATE&code=ficticio&error=denegado', status: 400 },
    { target: '/callback?state=STATE&code=%00', status: 400 },
    { target: '/callback?state=STATE&code=%ZZ', status: 400 },
    { target: '/callback?state=STATE&code=ficticio', status: 405, method: 'POST' },
    { target: '/callback?state=STATE&code=ficticio', status: 403, host: 'ajeno.invalid' },
    { target: '//ajeno.invalid/callback?state=STATE&code=ficticio', status: 400 },
    { target: '/callback?state=STATE&code=ficticio' + '&extra=a'.repeat(31), status: 400 },
  ])('rechaza petición ajena sin consumir el intento: caso %#', async item => {
    const flow = await receiver(); const target = item.target.split('STATE').join(flow.proof.state);
    const response = await request(flow.port, target, item);
    expect(response.status).toBe(item.status); expect(flow.isPending()).toBe(true);
    await request(flow.port, `/callback?state=${flow.proof.state}&code=legitimo`);
    expect(await flow.result).toBe('legitimo');
  });
  it('error OAuth válido cancela sin reflejar descripción del proveedor', async () => {
    const flow = await receiver();
    const response = await request(flow.port, `/callback?state=${flow.proof.state}&error=access_denied&error_description=privado`);
    expect(response.status).toBe(200); expect(response.body).not.toContain('privado'); expect(await flow.result).toBeNull();
  });
  it('cancela antes de listening y espera cierre físico sin dejar puerto', async () => {
    const flow = createOAuthReceiver({ state: createOAuthProof().state, assertCurrent: () => {}, port: 0 }); receivers.push(flow);
    const cancelled = flow.cancel(); expect(await flow.ready).toBe(false);
    expect(await cancelled).toBeNull(); expect(flow.address()).toBeNull();
    expect(await flow.cancel()).toBeNull();
  });
  it('puerto ocupado no deja promesa o listener sin retirar', async () => {
    const blocker = net.createServer(); await new Promise<void>(resolve => blocker.listen(0, '127.0.0.1', resolve));
    try {
      const port = (blocker.address() as net.AddressInfo).port;
      const flow = createOAuthReceiver({ state: createOAuthProof().state, assertCurrent: () => {}, port }); receivers.push(flow);
      expect(await flow.ready).toBe(false); expect(await flow.result).toBeNull(); expect(flow.address()).toBeNull();
    } finally { await new Promise<void>(resolve => blocker.close(() => resolve())); }
  });
  it('timeout retira el listener sin callback', async () => {
    const flow = await receiver(() => {}, 30);
    expect(await flow.result).toBeNull(); expect(flow.address()).toBeNull();
  });
  it('contexto revocado no entrega código', async () => {
    let valid = true; const flow = await receiver(() => { if (!valid) throw new Error('Revocado'); }); valid = false;
    expect((await request(flow.port, `/callback?state=${flow.proof.state}&code=legitimo`)).status).toBe(403);
    expect(await flow.result).toBeNull(); expect(flow.address()).toBeNull();
  });
  it('cancelar destruye también conexiones incompletas propias', async () => {
    const flow = await receiver();
    const socket = net.connect(flow.port, '127.0.0.1');
    const errors: Array<Error & { code?: string }> = [];
    socket.on('error', error => errors.push(error));
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
    socket.write('GET /callback HTTP/1.1\r\nHost: localhost');
    const closed = new Promise<void>(resolve => socket.once('close', () => resolve()));
    expect(await flow.cancel()).toBeNull(); await closed; expect(flow.address()).toBeNull();
    expect(errors.every(error => ['ECONNRESET', 'EPIPE'].includes(error.code ?? ''))).toBe(true);
  });
});
