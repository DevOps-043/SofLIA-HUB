import { spawn } from 'node:child_process';

export function mediaProcess(executable: string, args: string[], signal: AbortSignal, input?: (write: (data: Buffer) => Promise<void>) => Promise<void>, captureErrors = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '', failure: unknown;
    const stop = () => child.kill();
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    child.stdout.on('data', chunk => { output = (output + String(chunk)).slice(-1024 * 1024); });
    child.stderr.on('data', chunk => { errors = (errors + String(chunk)).slice(-64000); });
    child.on('error', reject);
    child.stdin.on('error', error => { failure = error; stop(); });
    child.on('close', code => {
      signal.removeEventListener('abort', stop);
      if (signal.aborted) reject(new Error('Producción cancelada o fuera de tiempo.'));
      else if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`Falló el motor de medios (${code}): ${errors.slice(-2000)}`));
      else resolve(captureErrors ? output + errors : output);
    });
    if (!input) child.stdin.end();
    else void input(async data => {
      if (signal.aborted) throw new Error('Producción cancelada.');
      await new Promise<void>((ok, fail) => child.stdin.write(data, error => error ? fail(error) : ok()));
    }).then(() => child.stdin.end(), error => { failure = error; stop(); });
  });
}
