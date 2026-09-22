import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { performance } from 'node:perf_hooks';
import { Buffer } from 'node:buffer';
import { setTimeout, clearTimeout } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MAX_OUTPUT_BYTES = 32 * 1024;
const TIMEOUT_MS = 15_000;

export function sidecarEnvironment(source = process.env) {
  const allowed = new Set(['systemroot', 'windir', 'path', 'pathext', 'temp', 'tmp']);
  return Object.fromEntries(Object.entries(source).filter(([key]) => allowed.has(key.toLowerCase())));
}

/** Prueba solamente el protocolo: no abre audio ni descarga modelos. */
export function smokeSidecar(python, sidecar, protocol, environment = sidecarEnvironment()) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const child = spawn(python, ['-I', '-B', '-u', '-X', 'utf8', sidecar], {
      cwd: path.dirname(sidecar), env: environment, windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buffer = '';
    let outputBytes = 0;
    let stage = 'ready';
    let pingStarted = 0;
    let settled = false;
    const result = { sidecar: path.basename(path.dirname(sidecar)), protocol };

    function fail(message) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      reject(new Error(`${result.sidecar}: ${message}`));
    }

    function send(payload) {
      child.stdin.write(`${JSON.stringify(payload)}\n`);
    }

    const timer = setTimeout(() => fail('tiempo de espera agotado'), TIMEOUT_MS);
    child.on('error', () => fail('no se pudo iniciar el runtime Python'));
    child.stdin.on('error', () => fail('se cerro stdin antes de completar el protocolo'));
    child.stderr.on('data', chunk => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) fail('salida superior al limite permitido');
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (settled) return;
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > MAX_OUTPUT_BYTES) return fail('salida superior al limite permitido');
      buffer += chunk;
      while (buffer.includes('\n') && !settled) {
        const newline = buffer.indexOf('\n');
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let message;
        try { message = JSON.parse(line); } catch { return fail('stdout no contiene NDJSON valido'); }
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
          return fail('respuesta no estructurada');
        }
        if (stage === 'ready') {
          if (message.event !== 'ready' || message.protocol !== protocol) return fail('ready incompatible');
          result.readyMs = Math.round(performance.now() - started);
          stage = 'ping';
          pingStarted = performance.now();
          send({ id: 1, cmd: 'ping' });
        } else if (stage === 'ping') {
          const data = message.data || message;
          if (message.id !== 1 || message.ok !== true || data.pong !== true || data.protocol !== protocol
              || typeof data.python !== 'string') return fail('ping incompatible');
          result.pingMs = Math.round(performance.now() - pingStarted);
          result.python = data.python;
          stage = 'unknown';
          send({ id: 2, cmd: 'comando_de_prueba_inexistente' });
        } else if (stage === 'unknown') {
          if (message.id !== 2 || message.ok !== false || !message.error) return fail('no rechazo el comando desconocido');
          if (protocol === 1 && message.error.code !== 'UNKNOWN_COMMAND') return fail('codigo de rechazo incompatible');
          result.unknownCommandRejected = true;
          stage = 'shutdown';
          send({ id: 3, cmd: 'shutdown' });
        } else if (stage === 'shutdown') {
          const data = message.data || message;
          if (message.id !== 3 || message.ok !== true || data.bye !== true) return fail('shutdown incompatible');
          stage = 'complete';
          child.stdin.end();
        } else {
          return fail('respuesta inesperada despues del cierre');
        }
      }
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      if (code !== 0 || signal || stage !== 'complete' || buffer.trim()) {
        return fail('el proceso termino sin completar el protocolo');
      }
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, exitCode: code, shutdown: true });
    });
  });
}

export async function runSmoke(root = ROOT) {
  const python = path.join(root, 'python-runtime', process.platform === 'win32' ? 'python.exe' : 'bin/python3');
  const results = [];
  for (const [directory, protocol] of [['sidecar', 4], ['tools_sidecar', 1]]) {
    results.push(await smokeSidecar(python, path.join(root, 'python', directory, 'main.py'), protocol));
  }
  return { ok: true, microphoneOpened: false, modelsLoaded: false, results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) {
    console.error('Este smoke no admite argumentos. Usa el runtime privado del worktree actual.');
    process.exitCode = 1;
  } else {
    runSmoke().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
      console.error(`Smoke de Python fallido: ${error.message}`);
      process.exitCode = 1;
    });
  }
}
