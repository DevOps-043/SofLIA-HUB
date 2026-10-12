import { inflateRawSync } from 'node:zlib';

/** Lee únicamente textos de diapositivas del ZIP que produjo el generador local. */
export function readPresentationText(buffer: Buffer): string {
  return readPresentationSlides(buffer).join('\n\n').slice(0, 30000);
}

export function readPresentationSlides(buffer: Buffer): string[] {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > buffer.length) throw new Error('Presentación Office inválida.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  if (count > 2000) throw new Error('Presentación demasiado grande.');
  const slides: Array<{ number: number; text: string }> = [];
  for (let index = 0; index < count; index++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Índice Office inválido.');
    const method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extra = buffer.readUInt16LE(offset + 30);
    const comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extra + comment;
    if (offset > buffer.length) throw new Error('Índice Office truncado.');
    const match = /^ppt\/slides\/slide(\d+)\.xml$/.exec(name);
    if (!match) continue;
    if (size > 1_000_000 || local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) throw new Error('Diapositiva inválida.');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + compressed > buffer.length) throw new Error('Diapositiva truncada.');
    const payload = buffer.subarray(start, start + compressed);
    const xml = (method === 8 ? inflateRawSync(payload, { maxOutputLength: 1_000_000 }) : method === 0 ? payload : Buffer.alloc(0)).toString('utf8');
    const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(item => item[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')).join('\n');
    if (!text) throw new Error('La diapositiva no tiene texto comprobable.');
    slides.push({ number: Number(match[1]), text });
  }
  if (!slides.length || slides.length > 120) throw new Error('La presentación no contiene diapositivas válidas.');
  return slides.sort((a, b) => a.number - b.number).map(slide => slide.text.slice(0, 10000));
}

