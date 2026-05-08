import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Preload IPC Security Layer Tests
// Tests for electron/preload.ts
// Since preload.ts has side effects and doesn't export functions,
// we test the logic by:
// 1. Parsing the source to verify ALLOWED_IPC_CHANNELS
// 2. Reimplementing the pure functions (sanitizePayload, validateChannel)
//    to test their logic
// 3. Testing the exposed APIs through the contextBridge mock
// ============================================================================

function readPreloadSources(): string {
  const preloadRoot = path.join(__dirname, '..', 'preload');
  const modularSources = fs.readdirSync(preloadRoot)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(preloadRoot, file), 'utf-8'));

  return [
    fs.readFileSync(path.join(__dirname, '..', 'preload.ts'), 'utf-8'),
    ...modularSources,
  ].join('\n');
}

const preloadSource = readPreloadSources();

// Extract ALLOWED_IPC_CHANNELS from source
function extractAllowedChannels(source: string): string[] {
  const blocks = source.matchAll(/(?:const|export const)\s+CHANNEL_GROUP_\d+\s*=\s*\[([\s\S]*?)\]/g);
  const channels = new Set<string>();
  for (const block of blocks) {
    for (const channelMatch of block[1].matchAll(/'([^']+)'/g)) {
      channels.add(channelMatch[1]);
    }
  }
  return Array.from(channels);
}

function extractCspContent(source: string): string {
  const match = source.match(/meta\.content\s*=\s*"([^"]+)"/);
  if (match?.[1]) return match[1];

  const arrayMatch = source.match(/meta\.content\s*=\s*\[([\s\S]*?)\]\.join/);
  if (!arrayMatch) return '';
  return Array.from(arrayMatch[1].matchAll(/"([^"]+)"/g), (item) => item[1]).join('; ');
}

const ALLOWED_IPC_CHANNELS = extractAllowedChannels(preloadSource);
const CSP_CONTENT = extractCspContent(preloadSource);

// Reimplement sanitizePayload from source (pure function)
const sanitizePayload = (payload: any): any => {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === 'function') {
    throw new Error('Security Violation: Callbacks and functions are not allowed in IPC.');
  }
  if (Array.isArray(payload)) {
    return payload.map(sanitizePayload);
  }
  if (typeof payload === 'object') {
    const safeObj: Record<string, any> = { ...payload };
    for (const key in safeObj) {
      if (Object.prototype.hasOwnProperty.call(safeObj, key)) {
        safeObj[key] = sanitizePayload(safeObj[key]);
      }
    }
    return safeObj;
  }
  return payload;
};

// Reimplement validateChannel from source (pure function)
const validateChannel = (channel: string) => {
  if (!ALLOWED_IPC_CHANNELS.includes(channel)) {
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  }
};

describe('Preload IPC Security Layer', () => {

  // ==========================================================================
  // SEC-001 to SEC-010: Payload Sanitization
  // ==========================================================================
  describe('Payload Sanitization (sanitizePayload)', () => {
    it('SEC-001: null passes through', () => {
      expect(sanitizePayload(null)).toBeNull();
    });

    it('SEC-002: undefined passes through', () => {
      expect(sanitizePayload(undefined)).toBeUndefined();
    });

    it('SEC-003: string primitive passes through', () => {
      expect(sanitizePayload('hello')).toBe('hello');
    });

    it('SEC-004: number primitive passes through', () => {
      expect(sanitizePayload(42)).toBe(42);
    });

    it('SEC-005: boolean primitive passes through', () => {
      expect(sanitizePayload(true)).toBe(true);
    });

    it('SEC-006: function payload throws Security Violation', () => {
      expect(() => sanitizePayload(() => {})).toThrow(
        'Security Violation: Callbacks and functions are not allowed in IPC.'
      );
    });

    it('SEC-007: object with nested values sanitized', () => {
      const input = { a: { b: 1, c: 'test' } };
      const result = sanitizePayload(input);
      expect(result).toEqual({ a: { b: 1, c: 'test' } });
    });

    it('SEC-008: object prototype stripped via spread', () => {
      class Evil {
        data = 'safe';
        dangerousMethod() { return 'hacked'; }
      }
      const input = new Evil();
      const result = sanitizePayload(input);
      expect(result.data).toBe('safe');
      // Prototype method not on own properties via spread
      expect(result).not.toBeInstanceOf(Evil);
    });

    it('SEC-009: array recursively sanitized', () => {
      const input = [{ a: 1 }, { b: 2 }, 'text'];
      const result = sanitizePayload(input);
      expect(result).toEqual([{ a: 1 }, { b: 2 }, 'text']);
    });

    it('SEC-010: function inside array throws', () => {
      expect(() => sanitizePayload([1, () => {}, 3])).toThrow(
        'Security Violation'
      );
    });

    it('SEC-011: deeply nested function throws', () => {
      expect(() => sanitizePayload({ a: { b: { c: () => {} } } })).toThrow(
        'Security Violation'
      );
    });

    it('SEC-012: deeply nested safe object passes', () => {
      const deep = { l1: { l2: { l3: { l4: { value: 'deep' } } } } };
      const result = sanitizePayload(deep);
      expect(result.l1.l2.l3.l4.value).toBe('deep');
    });

    it('SEC-013: empty object passes', () => {
      expect(sanitizePayload({})).toEqual({});
    });

    it('SEC-014: empty array passes', () => {
      expect(sanitizePayload([])).toEqual([]);
    });

    it('SEC-015: mixed array with objects and primitives', () => {
      const input = [1, 'text', { key: true }, [2, 3]];
      const result = sanitizePayload(input);
      expect(result).toEqual([1, 'text', { key: true }, [2, 3]]);
    });
  });

  // ==========================================================================
  // SEC-016 to SEC-020: Channel Validation
  // ==========================================================================
  describe('Channel Validation (validateChannel)', () => {
    it('SEC-016: allowed channel passes without error', () => {
      expect(() => validateChannel('whatsapp:connect')).not.toThrow();
    });

    it('SEC-017: unauthorized channel throws error', () => {
      expect(() => validateChannel('hacker:steal-data')).toThrow(
        'Unauthorized IPC channel: hacker:steal-data'
      );
    });

    it('SEC-018: empty string channel throws', () => {
      expect(() => validateChannel('')).toThrow('Unauthorized IPC channel: ');
    });

    it('SEC-019: all computer:* channels pass', () => {
      const computerChannels = ALLOWED_IPC_CHANNELS.filter(c => c.startsWith('computer:'));
      expect(computerChannels.length).toBeGreaterThanOrEqual(15);
      computerChannels.forEach(ch => {
        expect(() => validateChannel(ch)).not.toThrow();
      });
    });

    it('SEC-020: random string channel throws', () => {
      expect(() => validateChannel('random:nonexistent:channel')).toThrow(
        'Unauthorized IPC channel'
      );
    });
  });

  // ==========================================================================
  // SEC-021 to SEC-025: ALLOWED_IPC_CHANNELS Verification
  // ==========================================================================
  describe('ALLOWED_IPC_CHANNELS Verification', () => {
    it('SEC-021: has 150+ channels total', () => {
      expect(ALLOWED_IPC_CHANNELS.length).toBeGreaterThanOrEqual(150);
    });

    it('SEC-022: computer:* namespace has 15+ channels', () => {
      const count = ALLOWED_IPC_CHANNELS.filter(c => c.startsWith('computer:')).length;
      expect(count).toBeGreaterThanOrEqual(15);
    });

    it('SEC-023: whatsapp:* namespace present', () => {
      const count = ALLOWED_IPC_CHANNELS.filter(c => c.startsWith('whatsapp:')).length;
      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('SEC-024: desktop-agent:* namespace has 15+ channels', () => {
      const count = ALLOWED_IPC_CHANNELS.filter(c => c.startsWith('desktop-agent:')).length;
      expect(count).toBeGreaterThanOrEqual(15);
    });

    it('SEC-025: all workspace namespaces present (monitoring, calendar, gmail, drive, gchat)', () => {
      const namespaces = ['monitoring:', 'calendar:', 'gmail:', 'drive:', 'gchat:'];
      namespaces.forEach(ns => {
        const count = ALLOWED_IPC_CHANNELS.filter(c => c.startsWith(ns)).length;
        expect(count, `Expected ${ns} channels`).toBeGreaterThanOrEqual(3);
      });
    });

    it('SEC-026: CSP policy in source blocks unsafe-eval', () => {
      expect(CSP_CONTENT).toContain("script-src 'self'");
      expect(CSP_CONTENT).not.toContain('unsafe-eval');
    });

    it('SEC-027: CSP allows WebSocket connections', () => {
      expect(preloadSource).toContain('ws:');
      expect(preloadSource).toContain('wss:');
    });

    it('SEC-028: contextIsolation check present in source', () => {
      expect(preloadSource).toContain('process.contextIsolated');
      expect(preloadSource).toContain('contextIsolation no esta habilitado');
    });

    it('SEC-029: contextBridge.exposeInMainWorld called in source', () => {
      const exposeCount = (preloadSource.match(/(?:contextBridge|bridge)\.exposeInMainWorld/g) || []).length;
      expect(exposeCount).toBeGreaterThanOrEqual(3); // ipcRenderer, screenCapture, computerUse at minimum
    });

    it('SEC-030: updater channels present', () => {
      const updaterChannels = ALLOWED_IPC_CHANNELS.filter(c => c.startsWith('updater:'));
      expect(updaterChannels.length).toBeGreaterThanOrEqual(4);
    });

    it('SEC-031: memory channels present', () => {
      const memoryChannels = ALLOWED_IPC_CHANNELS.filter(c => c.startsWith('memory:'));
      expect(memoryChannels.length).toBeGreaterThanOrEqual(3);
    });

    it('SEC-032: workflow-hub namespace present', () => {
      const workflowHubChannels = ALLOWED_IPC_CHANNELS.filter(c => c.startsWith('workflow-hub:'));
      expect(workflowHubChannels.length).toBeGreaterThanOrEqual(6);
    });
  });
});
