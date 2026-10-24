const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
  txt: 'text/plain', md: 'text/plain', csv: 'text/csv', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export function projectFileMime(extension: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(TYPES, extension) ? TYPES[extension] : undefined;
}
/** Misma comprobación para bytes entrantes/salientes; no constituye antivirus ni parser OOXML. */
export class ProjectFileContentValidator {
  private prefix = Buffer.alloc(0);
  private readonly text: TextDecoder | null;
  constructor(private readonly mime: string) { this.text = mime.startsWith('text/') ? new TextDecoder('utf-8', { fatal: true }) : null; }
  update(bytes: Buffer): void {
    if (this.prefix.length < 512) this.prefix = Buffer.concat([this.prefix, bytes.subarray(0, 512 - this.prefix.length)]);
    if (this.text) { if (bytes.includes(0)) throw new Error('Texto binario.'); this.text.decode(bytes, { stream: true }); }
  }
  finish(): void {
    this.text?.decode(); const bytes = this.prefix; const mime = this.mime;
    const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
    const valid = mime === 'image/jpeg' ? starts(0xff, 0xd8, 0xff) : mime === 'image/png' ? starts(0x89, 0x50, 0x4e, 0x47)
      : mime === 'image/gif' ? starts(0x47, 0x49, 0x46, 0x38) : mime === 'image/webp' ? starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45
        : mime === 'application/pdf' ? starts(0x25, 0x50, 0x44, 0x46) : mime.includes('openxmlformats') ? starts(0x50, 0x4b, 0x03, 0x04) : mime.startsWith('text/');
    if (!valid) throw new Error('Firma de archivo inválida.');
  }
}
