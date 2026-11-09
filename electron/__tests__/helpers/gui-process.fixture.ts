import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { vi } from 'vitest';

/** Hijo simulado; nunca inicia PowerShell, xdotool, Python ni osascript. */
export function guiProcessFixture() {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(() => true), pid: 123,
  });
  const data: Buffer[] = []; child.stdin.on('data', chunk => data.push(Buffer.from(chunk)));
  return { child, input: () => Buffer.concat(data).toString('utf8'), close: (code: number | null = 0, signal: string | null = null) => child.emit('close', code, signal) };
}
