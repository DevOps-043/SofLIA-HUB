import { describe, expect, it } from 'vitest';
import { tools } from './context';

describe('WA_TOOL_DECLARATIONS structure and integrity', () => {
  it('WA-051: has 60+ tool declarations', () => {
    expect(tools.length).toBeGreaterThanOrEqual(60);
  });

  it('WA-052: every tool has a non-empty name', () => {
    for (const tool of tools) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
    }
  });

  it('WA-053: every tool has a non-empty description', () => {
    for (const tool of tools) {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('WA-054: every tool has parameters', () => {
    for (const tool of tools) {
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.parameters).toBe('object');
    }
  });

  it('WA-055: has no duplicate tool names', () => {
    const names = tools.map((tool: any) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('WA-056: every description documents intent', () => {
    for (const tool of tools) {
      expect(tool.description.trim().length).toBeGreaterThan(15);
    }
  });

  it('WA-057: every parameters.type is OBJECT', () => {
    for (const tool of tools) {
      expect(tool.parameters.type).toBe('OBJECT');
    }
  });

  it('WA-058: required fields are a subset of properties', () => {
    for (const tool of tools) {
      const required: string[] | undefined = tool.parameters.required;
      if (!required) continue;
      const propKeys = Object.keys(tool.parameters.properties || {});
      for (const field of required) expect(propKeys).toContain(field);
    }
  });
});
