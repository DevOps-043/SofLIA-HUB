export { openNativeResponses as getOpenAI } from './native-responses';
/** Compatibilidad del llamador: las leases y su revocación pertenecen a main. */
export function resetOpenAIClient(): void { /* No conservar claves ni cliente global en renderer. */ }
