/* global AbortSignal, fetch, process */

// Sonda sin credenciales: comprueba que la petición llega al endpoint nuevo.
// Una respuesta esperada no acredita un inicio de sesión con una cuenta real.
const sites = [
  ['Learning', 'https://soflia.ai'],
  ['Engine', 'https://soflia-coursegen.netlify.app'],
];

const results = await Promise.all(sites.map(async ([site, origin]) => {
  try {
    const response = await fetch(`${origin}/api/auth/hub-session`, {
      method: 'POST', credentials: 'omit', redirect: 'manual', cache: 'no-store',
      headers: { Origin: origin, 'X-PulseHub-Session': '1', 'Content-Type': 'application/json' },
      body: '{"replace":false}', signal: AbortSignal.timeout(15000),
    });
    const raw = await response.text();
    let data;
    if (raw.length <= 4096) {
      try { data = JSON.parse(raw); } catch { /* HTML u otra respuesta antigua. */ }
    }
    const ready = response.status === 401 && data?.success === false;
    const state = ready ? 'endpoint-disponible' :
      [404, 405].includes(response.status) ? 'endpoint-ausente' :
      response.status === 401 && (data?.error === 'UNAUTHENTICATED' || data?.code === 'UNAUTHORIZED') ? 'bloqueado-por-middleware-anterior' :
      response.status >= 300 && response.status < 400 ? 'redireccion-no-admitida' : 'respuesta-no-esperada';
    return { site, origin, status: response.status, ready, state };
  } catch { return { site, origin, ready: false, state: 'sin-respuesta' }; }
}));

process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), authenticated: false, results }, null, 2)}\n`);
process.exitCode = results.every(result => result.ready) ? 0 : 1;
