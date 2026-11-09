import fs from 'node:fs/promises';
import path from 'node:path';
import type { Stats } from 'node:fs';
import { GMAIL_DELIVERY_LIMITS, hasUnsafeGmailHeader } from '../../src/shared/gmail-delivery';

export interface PreparedGmailAttachment { filename: string; path: string; content: Buffer }

function sameFile(left: Stats, right: Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size
    && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

/** Lee una copia acotada; un fallo invalida todo el mensaje, sin omitir archivos. */
export async function prepareGmailAttachments(paths: string[], assertCurrent: () => void): Promise<PreparedGmailAttachment[]> {
  const prepared: PreparedGmailAttachment[] = [];
  let total = 0;
  for (const input of paths) {
    assertCurrent();
    if (!path.isAbsolute(input) || /^[\\/]{2}/.test(input) || hasUnsafeGmailHeader(input)) throw new Error('invalid_attachment');
    const filename = path.basename(input);
    if (!filename || filename.length > 255 || filename.includes(':')) throw new Error('invalid_attachment');
    const before = await fs.lstat(input);
    const canonical = await fs.realpath(input);
    assertCurrent();
    const remaining = Math.min(GMAIL_DELIVERY_LIMITS.attachmentBytes, GMAIL_DELIVERY_LIMITS.totalAttachmentBytes - total);
    if (!before.isFile() || before.isSymbolicLink() || before.size > remaining || /^[\\/]{2}/.test(canonical)) throw new Error('invalid_attachment');
    const handle = await fs.open(canonical, 'r');
    try {
      assertCurrent();
      const opened = await handle.stat();
      const linked = await fs.lstat(input);
      assertCurrent();
      if (!opened.isFile() || linked.isSymbolicLink() || !sameFile(before, opened) || !sameFile(linked, opened)) throw new Error('attachment_changed');
      const chunks: Buffer[] = [];
      let length = 0;
      while (length <= remaining) {
        const buffer = Buffer.alloc(Math.min(64 * 1024, remaining + 1 - length));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
        assertCurrent();
        if (!bytesRead) break;
        chunks.push(buffer.subarray(0, bytesRead));
        length += bytesRead;
      }
      const after = await handle.stat();
      assertCurrent();
      if (length > remaining || length !== before.size || !sameFile(opened, after)) throw new Error('attachment_changed');
      prepared.push({ filename, path: canonical, content: Buffer.concat(chunks, length) });
      total += length;
    } finally { await handle.close(); }
  }
  return prepared;
}
