import { describe, expect, it } from 'vitest';
import { buildBuiltinToolsetCatalog } from '../dynamic-tool/home-assistant';
import { parseToolContract } from '../mcp-manager/tool-contract';

describe('Home Assistant governed toolset', () => {
  it('DYN-001: genera tres herramientas con entrada/salida cerrada y política runtime', () => {
    const files = buildBuiltinToolsetCatalog()['home-assistant'].buildFiles();
    expect(files).toHaveLength(3);
    for (const file of files) {
      expect(file.content).toContain('outputSchema:');
      expect(file.content).toContain('runtime:');
      expect(file.content).toContain('"additionalProperties": false');
      expect(file.content).toContain('"allowedAgents": [');
      expect(file.content).toContain('"whatsapp-agent"');
      expect(file.content).toContain('runtimeContext.signal');
    }
  });

  it('DYN-002: solo la mutación exige HITL y ninguna herramienta permite grupos', () => {
    const files = buildBuiltinToolsetCatalog()['home-assistant'].buildFiles();
    const callService = files.find((file) => file.fileName.includes('call_service'))!;
    const reads = files.filter((file) => file !== callService);

    expect(callService.content).toContain('"risk": "write"');
    expect(callService.content).toContain('"hitl": "required"');
    for (const file of reads) {
      expect(file.content).toContain('"risk": "read"');
      expect(file.content).toContain('"hitl": "never"');
    }
    for (const file of files) expect(file.content).toContain('"allowInGroups": false');
  });

  it('DYN-003: los módulos generados satisfacen el parser ejecutable real', async () => {
    const files = buildBuiltinToolsetCatalog()['home-assistant'].buildFiles();
    for (const file of files) {
      const url = `data:text/javascript;base64,${Buffer.from(file.content).toString('base64')}`;
      const module = await import(url);
      expect(() => parseToolContract(module.default)).not.toThrow();
    }
  });
});
