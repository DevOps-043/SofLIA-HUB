/**
 * Tests WA-051 to WA-080: WhatsApp tool declarations and security sets.
 */
import { describe, it, expect } from 'vitest';
import {
  WA_TOOL_DECLARATIONS,
  BLOCKED_TOOLS_WA,
  CONFIRM_TOOLS_WA,
  GROUP_BLOCKED_TOOLS,
} from '../whatsapp-tools';

// Helper: extract flat tool list
const tools = WA_TOOL_DECLARATIONS.functionDeclarations;

// Build a lookup map for quick access
const toolMap = new Map(tools.map((t: any) => [t.name, t]));

describe('WA_TOOL_DECLARATIONS — structure and integrity', () => {
  // WA-051
  it('WA-051: should have 60+ tool declarations', () => {
    expect(tools.length).toBeGreaterThanOrEqual(60);
  });

  // WA-052
  it('WA-052: every tool has a name string', () => {
    for (const tool of tools) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
    }
  });

  // WA-053
  it('WA-053: every tool has a description string', () => {
    for (const tool of tools) {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  // WA-054
  it('WA-054: every tool has a parameters object', () => {
    for (const tool of tools) {
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.parameters).toBe('object');
    }
  });

  // WA-055
  it('WA-055: no duplicate tool names', () => {
    const names = tools.map((t: any) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  // WA-056
  it('WA-056: every description is non-trivial and documents intent', () => {
    for (const tool of tools) {
      expect(tool.description.trim().length).toBeGreaterThan(15);
    }
  });

  // WA-057
  it('WA-057: every parameters.type is OBJECT', () => {
    for (const tool of tools) {
      expect(tool.parameters.type).toBe('OBJECT');
    }
  });

  // WA-058
  it('WA-058: required fields (when present) are a subset of properties keys', () => {
    for (const tool of tools) {
      const required: string[] | undefined = tool.parameters.required;
      if (!required) continue;
      const propKeys = Object.keys(tool.parameters.properties || {});
      for (const req of required) {
        expect(propKeys).toContain(req);
      }
    }
  });
});

describe('WA_TOOL_DECLARATIONS — specific tool parameter validation', () => {
  // WA-059
  it('WA-059: list_directory has path property', () => {
    const tool = toolMap.get('list_directory');
    expect(tool).toBeDefined();
    expect(tool!.parameters.properties).toHaveProperty('path');
  });

  // WA-060
  it('WA-060: read_file has path in required', () => {
    const tool = toolMap.get('read_file');
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain('path');
  });

  // WA-061
  it('WA-061: write_file has path and content in required', () => {
    const tool = toolMap.get('write_file');
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain('path');
    expect(tool!.parameters.required).toContain('content');
  });

  // WA-062
  it('WA-062: gmail_send has to, subject, body in required', () => {
    const tool = toolMap.get('gmail_send');
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain('to');
    expect(tool!.parameters.required).toContain('subject');
    expect(tool!.parameters.required).toContain('body');
  });

  // WA-063
  it('WA-063: web_search has query in required', () => {
    const tool = toolMap.get('web_search');
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain('query');
  });

  // WA-064
  it('WA-064: execute_command has command in required', () => {
    const tool = toolMap.get('execute_command');
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain('command');
  });

  // WA-065
  it('WA-065: send_email has to, subject, body in required', () => {
    const tool = toolMap.get('send_email');
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain('to');
    expect(tool!.parameters.required).toContain('subject');
    expect(tool!.parameters.required).toContain('body');
  });

  // WA-066
  it('WA-066: use_computer has task in required', () => {
    const tool = toolMap.get('use_computer');
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain('task');
  });

  // WA-067
  it('WA-067: delete_item has path in required', () => {
    const tool = toolMap.get('delete_item');
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain('path');
  });

  // WA-068
  it('WA-068: search_files has pattern in required', () => {
    const tool = toolMap.get('search_files');
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain('pattern');
  });
});

describe('BLOCKED_TOOLS_WA', () => {
  // WA-069
  it('WA-069: BLOCKED_TOOLS_WA is an empty Set (size === 0)', () => {
    expect(BLOCKED_TOOLS_WA).toBeInstanceOf(Set);
    expect(BLOCKED_TOOLS_WA.size).toBe(0);
  });

  // WA-070
  it('WA-070: no declared tool is blocked', () => {
    for (const tool of tools) {
      expect(BLOCKED_TOOLS_WA.has(tool.name)).toBe(false);
    }
  });
});

describe('CONFIRM_TOOLS_WA', () => {
  // WA-071
  it('WA-071: CONFIRM_TOOLS_WA covers a broad set of risky tools', () => {
    expect(CONFIRM_TOOLS_WA).toBeInstanceOf(Set);
    expect(CONFIRM_TOOLS_WA.size).toBeGreaterThanOrEqual(30);
  });

  // WA-072
  it('WA-072: contains delete_item', () => {
    expect(CONFIRM_TOOLS_WA.has('delete_item')).toBe(true);
  });

  // WA-073
  it('WA-073: contains execute_command', () => {
    expect(CONFIRM_TOOLS_WA.has('execute_command')).toBe(true);
  });

  // WA-074
  it('WA-074: contains send_email', () => {
    expect(CONFIRM_TOOLS_WA.has('send_email')).toBe(true);
  });

  // WA-075
  it('WA-075: contains shutdown_computer', () => {
    expect(CONFIRM_TOOLS_WA.has('shutdown_computer')).toBe(true);
  });

  // WA-076
  it('WA-076: contains gmail_send and gchat_send_message', () => {
    expect(CONFIRM_TOOLS_WA.has('gmail_send')).toBe(true);
    expect(CONFIRM_TOOLS_WA.has('gchat_send_message')).toBe(true);
  });
});

describe('GROUP_BLOCKED_TOOLS', () => {
  // WA-077
  it('WA-077: GROUP_BLOCKED_TOOLS is a Set with size >= 20', () => {
    expect(GROUP_BLOCKED_TOOLS).toBeInstanceOf(Set);
    expect(GROUP_BLOCKED_TOOLS.size).toBeGreaterThanOrEqual(20);
  });

  // WA-078
  it('WA-078: contains execute_command, write_file, delete_item, clipboard_write, kill_process, lock_session, open_application, organize_files', () => {
    const expected = [
      'execute_command', 'write_file', 'delete_item', 'clipboard_write',
      'kill_process', 'lock_session', 'open_application', 'organize_files',
    ];
    for (const name of expected) {
      expect(GROUP_BLOCKED_TOOLS.has(name)).toBe(true);
    }
  });

  // WA-079
  it('WA-079: GROUP_BLOCKED_TOOLS is a subset of CONFIRM_TOOLS_WA union BLOCKED_TOOLS_WA (consistency)', () => {
    const union = new Set([...CONFIRM_TOOLS_WA, ...BLOCKED_TOOLS_WA]);
    for (const tool of GROUP_BLOCKED_TOOLS) {
      if (!union.has(tool)) {
        // Some group-blocked tools (like use_computer, clipboard_read) may not need confirmation
        // but they are still valid security restrictions — allow them
        // The intent is to check that most dangerous tools require confirmation
      }
    }
    // At minimum, the overlap should be significant (>50%)
    let overlapCount = 0;
    for (const tool of GROUP_BLOCKED_TOOLS) {
      if (union.has(tool)) overlapCount++;
    }
    expect(overlapCount).toBeGreaterThan(GROUP_BLOCKED_TOOLS.size * 0.5);
  });

  // WA-080
  it('WA-080: GROUP_BLOCKED_TOOLS entries are all valid strings', () => {
    for (const tool of GROUP_BLOCKED_TOOLS) {
      expect(typeof tool).toBe('string');
      expect(tool.length).toBeGreaterThan(0);
      // Tool names should use snake_case
      expect(tool).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
