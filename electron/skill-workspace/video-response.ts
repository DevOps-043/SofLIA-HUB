import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';

export function videoRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return { start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const suffix = !match[1];
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = suffix || !match[2] ? size - 1 : Math.min(size - 1, Number(match[2]));
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < size ? { start, end } : null;
}
export async function videoResponse(file: string, header: string | null): Promise<Response> {
  const stat = await fs.stat(file);
  if (!stat.isFile() || !stat.size || stat.size > 80 * 1024 * 1024) return new Response(null, { status: 404 });
  const range = videoRange(header, stat.size);
  if (!range) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
  const stream = createReadStream(file, range);
  return new Response(Readable.toWeb(stream) as ReadableStream, { status: header ? 206 : 200, headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(range.end - range.start + 1), 'Accept-Ranges': 'bytes', ...(header ? { 'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}` } : {}), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
