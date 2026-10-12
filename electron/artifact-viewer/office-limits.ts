import { VIEWER_LIMITS } from '../../src/shared/artifact-viewer';
import { inflateRawSync } from 'node:zlib';

/** Acota la expansión ZIP antes de entregar Office a los lectores existentes. */
export function assertOfficeLimits(buffer: Buffer): void {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > buffer.length) throw new Error('Archivo Office inválido.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const directoryStart = offset;
  const directorySize = buffer.readUInt32LE(end + 12);
  // El lector ZIP posterior no puede descubrir entradas fuera del índice validado.
  if (buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0 ||
      buffer.readUInt16LE(end + 8) !== count || directoryStart + directorySize !== end ||
      end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length) throw new Error('Índice Office incoherente.');
  if (count > 2000 || count === 0) throw new Error('Archivo Office demasiado complejo.');
  let expanded = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Índice Office inválido.');
    const size = buffer.readUInt32LE(offset + 24);
    const compressed = buffer.readUInt32LE(offset + 20);
    const method = buffer.readUInt16LE(offset + 10);
    const local = buffer.readUInt32LE(offset + 42);
    if (size === 0xffffffff || compressed === 0xffffffff || local === 0xffffffff || buffer.readUInt16LE(offset + 34) !== 0 ||
        local + 30 > directoryStart || buffer.readUInt32LE(local) !== 0x04034b50 || (buffer.readUInt16LE(offset + 8) & 1) ||
        buffer.readUInt16LE(local + 8) !== method || buffer.readUInt16LE(local + 6) !== buffer.readUInt16LE(offset + 8)) throw new Error('Entrada Office inválida.');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + compressed > directoryStart || expanded + size > VIEWER_LIMITS.officeExpandedBytes) throw new Error('Archivo Office fuera de límite.');
    const payload = buffer.subarray(start, start + compressed);
    const actual = method === 0 ? payload : method === 8 ? inflateRawSync(payload, { maxOutputLength: VIEWER_LIMITS.officeExpandedBytes - expanded }) : null;
    if (!actual || actual.length !== size) throw new Error('Entrada Office alterada.');
    expanded += actual.length;
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
    if (offset > end) throw new Error('Índice Office truncado.');
  }
  if (offset !== end) throw new Error('Índice Office con entradas sin validar.');
}

/** Usar tras assertOfficeLimits; solo extrae la parte solicitada y la acota de nuevo. */
export function readOfficePart(buffer: Buffer, part: string, maximum: number): Buffer | null {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let offset = buffer.readUInt32LE(end + 16);
  for (let index = 0; index < buffer.readUInt16LE(end + 10); index++) {
    const nameLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === part) {
      const size = buffer.readUInt32LE(offset + 24); const method = buffer.readUInt16LE(offset + 10);
      if (size > maximum) return null;
      const local = buffer.readUInt32LE(offset + 42);
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + buffer.readUInt32LE(offset + 20));
      return method === 8 ? inflateRawSync(data, { maxOutputLength: maximum }) : data;
    }
    offset += 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return null;
}
