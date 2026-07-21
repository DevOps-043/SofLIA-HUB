import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeToolExecutionError, type RuntimeToolExecutionContext, type ToolSchema } from '../mcp-manager';
import { getToolContractFingerprint, parseToolContract } from '../mcp-manager/tool-contract';
import { MCPManager, resetMcpMocks } from './mcp-manager.helpers';

const baseContext: RuntimeToolExecutionContext = {
  agentId: 'whatsapp-agent',
  channel: 'whatsapp',
  isGroup: false,
  approvedByHuman: false,
  traceId: '22222222-2222-4222-8222-222222222222',
  contractFingerprint: '0'.repeat(64),
  actorRef: 'wa:fedcba9876543210',
};

function makeExecutable(overrides: Partial<ToolSchema> = {}): ToolSchema {
  return {
    name: 'runtime_test_tool',
    description: 'Herramienta runtime gobernada para pruebas.',
    inputSchema: {
      type: 'object',
      properties: { value: { type: 'string' } },
      required: ['value'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
      required: ['success'],
      additionalProperties: false,
    },
    runtime: {
      owner: 'test-platform',
      risk: 'read',
      allowedAgents: ['whatsapp-agent'],
      hitl: 'never',
      allowInGroups: false,
      timeoutMs: 1_000,
      audit: true,
    },
    handler: vi.fn(async () => ({ success: true })),
    ...overrides,
  };
}

function register(mgr: InstanceType<typeof MCPManager>, tool: ToolSchema): void {
  // Acceso deliberado al registro para aislar el ejecutor del scanner.
  (mgr as unknown as { tools: Map<string, ToolSchema> }).tools.set(tool.name, tool);
}

function contextFor(
  tool: ToolSchema,
  overrides: Partial<RuntimeToolExecutionContext> = {},
): RuntimeToolExecutionContext {
  return {
    ...baseContext,
    contractFingerprint: getToolContractFingerprint(tool as Parameters<typeof getToolContractFingerprint>[0]),
    ...overrides,
  };
}

describe('MCPManager runtime policy enforcement', () => {
  beforeEach(resetMcpMocks);

  it('MCP-013: rechaza ejecutables legacy sin política ni salida', () => {
    expect(() => parseToolContract({
      name: 'legacy_tool',
      description: 'Herramienta legacy de prueba.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: () => ({ success: true }),
    })).toThrow();
  });

  it('MCP-014: rechaza write sin HITL y objetos abiertos', () => {
    const invalid = makeExecutable({
      inputSchema: { type: 'object', properties: {} },
      runtime: {
        owner: 'test-platform',
        risk: 'write',
        allowedAgents: ['whatsapp-agent'],
        hitl: 'never',
        allowInGroups: false,
        timeoutMs: 1_000,
        audit: true,
      },
    });
    expect(() => parseToolContract(invalid)).toThrow();

    expect(() => parseToolContract(makeExecutable({
      inputSchema: {
        type: 'object',
        properties: { payload: {} },
        required: ['payload'],
        additionalProperties: false,
      },
    }))).toThrow(/nodo opaco/);
  });

  it('MCP-015: valida argumentos estrictos antes del handler', async () => {
    const handler = vi.fn(async () => ({ success: true }));
    const tool = makeExecutable({ handler });
    const mgr = new MCPManager('/tmp/tools-test');
    register(mgr, tool);

    await expect(mgr.executeTool(tool.name, { value: 'ok', secret: 'no-debe-pasar' }, contextFor(tool)))
      .rejects.toMatchObject({ code: 'input_invalid' });
    expect(handler).not.toHaveBeenCalled();
    mgr.destroy();
  });

  it('MCP-016: deniega agente, grupo y HITL antes del handler', async () => {
    const handler = vi.fn(async () => ({ success: true }));
    const tool = makeExecutable({
      handler,
      runtime: {
        owner: 'test-platform',
        risk: 'write',
        allowedAgents: ['whatsapp-agent'],
        hitl: 'required',
        allowInGroups: false,
        timeoutMs: 1_000,
        audit: true,
      },
    });
    const mgr = new MCPManager('/tmp/tools-test');
    register(mgr, tool);

    await expect(mgr.executeTool(tool.name, { value: 'ok' }, contextFor(tool, { agentId: 'desktop-agent' })))
      .rejects.toMatchObject({ code: 'agent_denied', outcome: 'denied' });
    await expect(mgr.executeTool(tool.name, { value: 'ok' }, contextFor(tool, { isGroup: true, approvedByHuman: true })))
      .rejects.toMatchObject({ code: 'group_denied', outcome: 'denied' });
    await expect(mgr.executeTool(tool.name, { value: 'ok' }, contextFor(tool)))
      .rejects.toMatchObject({ code: 'approval_required', outcome: 'denied' });
    expect(handler).not.toHaveBeenCalled();
    mgr.destroy();
  });

  it('MCP-017: acepta HITL del host y valida la salida', async () => {
    const invalidHandler = vi.fn(async () => ({ success: true, leaked: 'x' }));
    const tool = makeExecutable({
      handler: invalidHandler,
      runtime: {
        owner: 'test-platform',
        risk: 'critical',
        allowedAgents: ['whatsapp-agent'],
        hitl: 'required',
        allowInGroups: false,
        timeoutMs: 1_000,
        audit: true,
      },
    });
    const mgr = new MCPManager('/tmp/tools-test');
    register(mgr, tool);

    await expect(mgr.executeTool(tool.name, { value: 'ok' }, contextFor(tool, { approvedByHuman: true })))
      .rejects.toMatchObject({ code: 'output_invalid' });
    expect(invalidHandler).toHaveBeenCalledOnce();
    mgr.destroy();
  });

  it('MCP-018: aborta por timeout y emite auditoría minimizada', async () => {
    let receivedSignal: AbortSignal | undefined;
    const tool = makeExecutable({
      runtime: {
        owner: 'test-platform',
        risk: 'read',
        allowedAgents: ['whatsapp-agent'],
        hitl: 'never',
        allowInGroups: false,
        timeoutMs: 15,
        audit: true,
      },
      handler: vi.fn(async (_args, context) => {
        receivedSignal = context.signal;
        await new Promise(() => undefined);
      }),
    });
    const mgr = new MCPManager('/tmp/tools-test');
    const audits: unknown[] = [];
    mgr.on('tool-audit', (event) => audits.push(event));
    register(mgr, tool);

    const executionContext = contextFor(tool);
    await expect(mgr.executeTool(tool.name, { value: 'secreto' }, executionContext))
      .rejects.toMatchObject({ code: 'timeout', outcome: 'timeout' });
    expect(receivedSignal?.aborted).toBe(true);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      traceId: executionContext.traceId,
      toolName: tool.name,
      actorRef: baseContext.actorRef,
      outcome: 'timeout',
      errorCode: 'timeout',
    });
    expect(JSON.stringify(audits[0])).not.toContain('secreto');
    mgr.destroy();
  });

  it('MCP-019: conserva códigos tipados de error runtime', () => {
    const error = new RuntimeToolExecutionError('approval_required', 'requiere aprobación', 'denied');
    expect(error).toMatchObject({ name: 'RuntimeToolExecutionError', code: 'approval_required', outcome: 'denied' });
  });

  it('MCP-020: deniega si el contrato cambia después del preflight', async () => {
    const tool = makeExecutable();
    const staleContext = contextFor(tool, { approvedByHuman: true });
    const changedTool = makeExecutable({ description: 'Contrato modificado después de confirmar.' });
    const mgr = new MCPManager('/tmp/tools-test');
    register(mgr, changedTool);

    await expect(mgr.executeTool(changedTool.name, { value: 'ok' }, staleContext))
      .rejects.toMatchObject({ code: 'contract_changed', outcome: 'denied' });
    expect(changedTool.handler).not.toHaveBeenCalled();
    mgr.destroy();
  });
});
