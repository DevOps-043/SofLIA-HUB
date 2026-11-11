export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export interface JsonSnapshotLimits { nodes?: number; depth?: number; array?: number; keys?: number }
/** Un enum JSON requiere string real: String(array) no valida su tipo. */
export function isJsonStringChoice(value: unknown, choices: readonly string[]): boolean { return typeof value === 'string' && choices.includes(value); }

/** Snapshot JSON sin getters/prototipos y con presupuestos fijados por el consumidor. */
export function boundedJsonSnapshot(value: unknown, maxBytes: number, limits: JsonSnapshotLimits = {}): JsonValue {
  let nodes = 0, bytes = 0;
  const visit = (item: unknown, depth: number): JsonValue => {
    if (++nodes > (limits.nodes ?? 20000) || depth > (limits.depth ?? 12)) throw new Error('Solicitud de investigación excesiva.');
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (typeof item === 'string') {
      if (item.length > maxBytes) throw new Error('Solicitud de investigación excesiva.');
      bytes += new TextEncoder().encode(item).byteLength;
      if (bytes > maxBytes) throw new Error('Solicitud de investigación excesiva.');
      return item;
    }
    if (!item || typeof item !== 'object') throw new Error('Datos de investigación no válidos.');
    if (Array.isArray(item)) {
      if (item.length > (limits.array ?? 1000)) throw new Error('Solicitud de investigación excesiva.');
      const result: JsonValue[] = [];
      for (let index = 0; index < item.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        if (!descriptor || !('value' in descriptor)) throw new Error('Datos de investigación no válidos.');
        result.push(visit(descriptor.value, depth + 1));
      }
      return result;
    }
    if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new Error('Datos de investigación no válidos.');
    const descriptors = Object.getOwnPropertyDescriptors(item), keys = Reflect.ownKeys(descriptors);
    if (keys.length > (limits.keys ?? 200)) throw new Error('Solicitud de investigación excesiva.');
    const result: JsonObject = {};
    for (const key of keys) {
      if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Datos de investigación no válidos.');
      if (key.length > maxBytes) throw new Error('Solicitud de investigación excesiva.');
      bytes += new TextEncoder().encode(key).byteLength;
      if (bytes > maxBytes) throw new Error('Solicitud de investigación excesiva.');
      const descriptor = descriptors[key]; if (!('value' in descriptor)) throw new Error('Datos de investigación no válidos.');
      if (descriptor.value === undefined) continue;
      result[key] = visit(descriptor.value, depth + 1);
    }
    return result;
  };
  const snapshot = visit(value, 0);
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > maxBytes) throw new Error('Solicitud de investigación excesiva.');
  return snapshot;
}
