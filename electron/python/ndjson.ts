/** Framing por bytes: crecimiento amortizado, UTF-8 estricto y cuota por línea. */
export class BoundedNdjson {
  private buffer = Buffer.alloc(4096);
  private length = 0;
  constructor(private readonly maximum: number) {}
  clear(): void { this.buffer = Buffer.alloc(4096); this.length = 0; }
  push(chunk: Buffer, line: (text: string) => boolean): void {
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf(10, offset); const end = newline < 0 ? chunk.length : newline;
      const size = end - offset;
      if (this.length + size > this.maximum) throw new Error('Línea NDJSON demasiado grande.');
      if (this.length + size > this.buffer.length) {
        const next = Buffer.alloc(Math.min(this.maximum, Math.max(this.length + size, this.buffer.length * 2)));
        this.buffer.copy(next, 0, 0, this.length); this.buffer = next;
      }
      chunk.copy(this.buffer, this.length, offset, end); this.length += size;
      if (newline < 0) return;
      const text = new TextDecoder('utf-8', { fatal: true }).decode(this.buffer.subarray(0, this.length)).trim();
      this.length = 0; offset = newline + 1;
      if (this.buffer.length > 65_536) this.buffer = Buffer.alloc(4096);
      if (text && !line(text)) return;
    }
  }
}
