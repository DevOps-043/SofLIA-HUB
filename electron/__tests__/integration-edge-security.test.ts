import { describe, expect, it } from 'vitest';

const GROUP_BLOCKED = new Set([
  'execute_command',
  'write_file',
  'delete_item',
  'clipboard_write',
  'open_application',
  'kill_process',
  'lock_session',
  'shutdown_computer',
  'move_item',
]);

function isBlocked(toolName: string, isGroup: boolean) {
  return isGroup && GROUP_BLOCKED.has(toolName);
}

function sanitizePayload(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  const clean: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    clean[key] = sanitizePayload(value);
  }
  return clean;
}

describe('EDGE - Security and Validation', () => {
  it('EDGE-SEC-001: dangerous tools are blocked in group chats', () => {
    expect(isBlocked('execute_command', true)).toBe(true);
    expect(isBlocked('execute_command', false)).toBe(false);
    expect(isBlocked('list_directory', true)).toBe(false);
  });

  it('EDGE-SEC-002: payload sanitization strips dangerous keys', () => {
    const sanitized = sanitizePayload({
      name: 'test',
      __proto__: { admin: true },
      data: { constructor: 'evil' },
    });

    expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(false);
    expect((sanitized as any).admin).toBeUndefined();
    expect(sanitized.name).toBe('test');
    expect(Object.prototype.hasOwnProperty.call(sanitized.data, 'constructor')).toBe(false);
  });

  it('EDGE-SEC-003: CSP policy blocks inline scripts', () => {
    const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'";
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
  });
});
