import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { compileJsonSchema } from './schema-validation';
import { getToolContractFingerprint, isExecutableTool } from './tool-contract';
import type {
  RuntimeToolAuditEvent,
  RuntimeToolAuditOutcome,
  RuntimeToolExecutionContext,
  ExecutableToolSchema,
  ToolSchema,
} from './types';

export type RuntimeToolErrorCode =
  | 'tool_not_found'
  | 'handler_missing'
  | 'invalid_execution_context'
  | 'contract_changed'
  | 'agent_denied'
  | 'group_denied'
  | 'approval_required'
  | 'input_invalid'
  | 'output_invalid'
  | 'timeout'
  | 'handler_failed';

export class RuntimeToolExecutionError extends Error {
  constructor(
    public readonly code: RuntimeToolErrorCode,
    message: string,
    public readonly outcome: RuntimeToolAuditOutcome = 'error',
  ) {
    super(message);
    this.name = 'RuntimeToolExecutionError';
  }
}

const executionContextSchema = z.object({
  agentId: z.enum(['whatsapp-agent', 'desktop-agent', 'meeting-agent']),
  channel: z.enum(['whatsapp', 'desktop', 'meeting']),
  isGroup: z.boolean(),
  approvedByHuman: z.boolean(),
  traceId: z.string().uuid(),
  contractFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  actorRef: z.string().regex(/^[a-z]+:[a-f0-9]{16}$/),
}).strict();

export async function executeRegisteredTool(
  tools: Map<string, ToolSchema>,
  name: string,
  args: unknown,
  rawContext: RuntimeToolExecutionContext,
  emitAudit: (event: RuntimeToolAuditEvent) => void,
): Promise<unknown> {
  const tool = tools.get(name);
  if (!tool) throw new RuntimeToolExecutionError('tool_not_found', `Tool not found: ${name}`);
  if (!isExecutableTool(tool)) {
    throw new RuntimeToolExecutionError('handler_missing', `Tool ${name} has no executable handler. It might be a declarative tool.`);
  }

  let context: RuntimeToolExecutionContext;
  try {
    context = executionContextSchema.parse(rawContext) as RuntimeToolExecutionContext;
  } catch {
    emitAudit({
      event: 'runtime_tool_execution',
      timestamp: new Date().toISOString(),
      traceId: randomUUID(),
      toolName: tool.name,
      owner: tool.runtime.owner,
      risk: tool.runtime.risk,
      agentId: 'unknown',
      actorRef: 'unknown',
      outcome: 'denied',
      durationMs: 0,
      errorCode: 'invalid_execution_context',
    });
    throw new RuntimeToolExecutionError('invalid_execution_context', 'El contexto de ejecución runtime es inválido.', 'denied');
  }

  const startedAt = Date.now();
  const audit = (outcome: RuntimeToolAuditOutcome, errorCode?: string) => emitAudit({
    event: 'runtime_tool_execution',
    timestamp: new Date().toISOString(),
    traceId: context.traceId,
    toolName: tool.name,
    owner: tool.runtime.owner,
    risk: tool.runtime.risk,
    agentId: context.agentId,
    actorRef: context.actorRef,
    outcome,
    durationMs: Math.max(0, Date.now() - startedAt),
    ...(errorCode ? { errorCode } : {}),
  });

  try {
    enforcePolicy(tool, context);
    const input = parseWithContract(compileJsonSchema(tool.inputSchema), args, 'input_invalid', 'Los argumentos no cumplen el contrato de entrada.');
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new RuntimeToolExecutionError('timeout', `La herramienta excedió su timeout de ${tool.runtime.timeoutMs} ms.`, 'timeout'));
        }, tool.runtime.timeoutMs);
      });
      const handlerPromise = Promise.resolve(tool.handler(input, { ...context, signal: controller.signal }));
      const result = await Promise.race([handlerPromise, timeoutPromise]);
      const output = parseWithContract(compileJsonSchema(tool.outputSchema), result, 'output_invalid', 'El resultado no cumple el contrato de salida.');
      audit('success');
      return output;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  } catch (error) {
    const runtimeError = normalizeRuntimeError(error);
    audit(runtimeError.outcome, runtimeError.code);
    throw runtimeError;
  }
}

function enforcePolicy(tool: ExecutableToolSchema, context: RuntimeToolExecutionContext): void {
  if (context.contractFingerprint !== getToolContractFingerprint(tool)) {
    throw new RuntimeToolExecutionError('contract_changed', `El contrato de ${tool.name} cambió después del preflight; solicita una nueva autorización.`, 'denied');
  }
  if (!tool.runtime.allowedAgents.includes(context.agentId)) {
    throw new RuntimeToolExecutionError('agent_denied', `El agente ${context.agentId} no tiene permiso para ${tool.name}.`, 'denied');
  }
  if (context.isGroup && !tool.runtime.allowInGroups) {
    throw new RuntimeToolExecutionError('group_denied', `La herramienta ${tool.name} no está disponible en grupos.`, 'denied');
  }
  if (tool.runtime.hitl === 'required' && !context.approvedByHuman) {
    throw new RuntimeToolExecutionError('approval_required', `La herramienta ${tool.name} requiere aprobación humana.`, 'denied');
  }
}

function parseWithContract(
  validator: z.ZodTypeAny,
  value: unknown,
  code: 'input_invalid' | 'output_invalid',
  message: string,
): unknown {
  const parsed = validator.safeParse(value);
  if (!parsed.success) throw new RuntimeToolExecutionError(code, `${message} ${parsed.error.issues[0]?.message ?? ''}`.trim());
  return parsed.data;
}

function normalizeRuntimeError(error: unknown): RuntimeToolExecutionError {
  if (error instanceof RuntimeToolExecutionError) return error;
  return new RuntimeToolExecutionError('handler_failed', 'La herramienta dinámica falló durante la ejecución.');
}
