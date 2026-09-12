import { createHash } from 'node:crypto';
import type { BrowserPrivacyCategory } from './platform-types';

export interface BrowserTrackingRuleList {
  version: number;
  generatedAt: string;
  checksum: string;
  rules: Array<{ host: string; category: BrowserPrivacyCategory }>;
}

export type BrowserTrackingDecision = { blocked: false } | { blocked: true; category: BrowserPrivacyCategory };
const MAX_RULES = 20_000;
const TRACKING_PARAMETERS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid', 'dclid']);
/** Client Hints de alta entropía que permiten perfilar el dispositivo. Se
 * eliminan sólo en modo estricto: los hints de baja entropía y User-Agent
 * normalizado siguen disponibles para no romper compatibilidad. */
const HIGH_ENTROPY_CLIENT_HINTS = new Set([
  'sec-ch-ua-full-version', 'sec-ch-ua-full-version-list', 'sec-ch-ua-platform-version',
  'sec-ch-ua-arch', 'sec-ch-ua-bitness', 'sec-ch-ua-model', 'device-memory',
  'dpr', 'viewport-width', 'downlink', 'ect', 'rtt',
]);

export class BrowserTrackingRuleEngine {
  private rules = new Map<string, BrowserPrivacyCategory>();
  private version = 0;

  install(list: BrowserTrackingRuleList): void {
    if (!Number.isSafeInteger(list.version) || list.version <= this.version || !Array.isArray(list.rules) || list.rules.length > MAX_RULES) {
      throw new Error('La lista de protección es inválida o no es más reciente.');
    }
    const canonical = JSON.stringify(list.rules);
    const checksum = createHash('sha256').update(canonical).digest('hex');
    if (checksum !== list.checksum) throw new Error('La lista de protección no supera la verificación de integridad.');
    const next = new Map<string, BrowserPrivacyCategory>();
    for (const rule of list.rules) {
      const host = normalizeRuleHost(rule.host);
      if (!['tracker', 'advertising', 'third-party-cookie', 'tracking-parameter', 'fingerprinting', 'malware'].includes(rule.category)) throw new Error('La lista contiene una categoría desconocida.');
      next.set(host, rule.category);
    }
    this.rules = next;
    this.version = list.version;
  }

  evaluate(rawUrl: string): BrowserTrackingDecision {
    let hostname: string;
    try { hostname = new URL(rawUrl).hostname.toLowerCase(); } catch { return { blocked: false }; }
    for (const [host, category] of this.rules) {
      if (hostname === host || hostname.endsWith(`.${host}`)) return { blocked: true, category };
    }
    return { blocked: false };
  }

  getVersion(): number { return this.version; }
}

export function stripTrackingParameters(rawUrl: string): { url: string; removed: string[] } {
  const url = new URL(rawUrl);
  const removed: string[] = [];
  for (const key of [...url.searchParams.keys()]) {
    if (!TRACKING_PARAMETERS.has(key.toLowerCase())) continue;
    url.searchParams.delete(key);
    removed.push(key);
  }
  return { url: url.toString(), removed };
}

export function mitigateFingerprintingRequestHeaders(headers: Record<string, unknown>): string[] {
  return removeHeadersCaseInsensitive(headers, HIGH_ENTROPY_CLIENT_HINTS);
}

export function mitigateFingerprintingResponseHeaders(headers: Record<string, string[]>): string[] {
  return removeHeadersCaseInsensitive(headers, new Set(['accept-ch', 'critical-ch']));
}

export function createTrackingRuleList(version: number, rules: BrowserTrackingRuleList['rules']): BrowserTrackingRuleList {
  return { version, generatedAt: new Date().toISOString(), checksum: createHash('sha256').update(JSON.stringify(rules)).digest('hex'), rules };
}

function normalizeRuleHost(raw: string): string {
  const host = raw.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || host.includes('..')) throw new Error('La lista contiene un host inválido.');
  return host;
}

function removeHeadersCaseInsensitive(headers: Record<string, unknown>, names: Set<string>): string[] {
  const removed: string[] = [];
  for (const key of Object.keys(headers)) {
    if (!names.has(key.toLowerCase())) continue;
    delete headers[key];
    removed.push(key);
  }
  return removed;
}
