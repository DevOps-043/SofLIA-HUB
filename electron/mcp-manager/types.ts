export type JsonSchemaPrimitive = string | number | boolean | null;

export interface JsonSchemaNode {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  description?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchemaNode;
  enum?: JsonSchemaPrimitive[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
}

export interface ClosedObjectSchema extends JsonSchemaNode {
  type: 'object';
  properties: Record<string, JsonSchemaNode>;
  additionalProperties: false;
}

export type RuntimeAgentId = 'whatsapp-agent' | 'desktop-agent' | 'meeting-agent';
export type RuntimeToolRisk = 'read' | 'write' | 'critical';
export type RuntimeToolHitl = 'never' | 'required';

export interface RuntimeToolPolicy {
  owner: string;
  risk: RuntimeToolRisk;
  allowedAgents: RuntimeAgentId[];
  hitl: RuntimeToolHitl;
  allowInGroups: boolean;
  timeoutMs: number;
  audit: true;
}

export interface RuntimeToolExecutionContext {
  agentId: RuntimeAgentId;
  channel: 'whatsapp' | 'desktop' | 'meeting';
  isGroup: boolean;
  approvedByHuman: boolean;
  traceId: string;
  /** Huella obtenida en el preflight; liga autorización y aprobación al contrato exacto. */
  contractFingerprint: string;
  /** Referencia seudónima producida por el host; nunca el identificador personal crudo. */
  actorRef: string;
}

export interface RuntimeToolHandlerContext extends RuntimeToolExecutionContext {
  signal: AbortSignal;
}

export type RuntimeToolAuditOutcome = 'success' | 'denied' | 'error' | 'timeout';

export interface RuntimeToolAuditEvent {
  event: 'runtime_tool_execution';
  timestamp: string;
  traceId: string;
  toolName: string;
  owner: string;
  risk: RuntimeToolRisk;
  agentId: RuntimeAgentId | 'unknown';
  actorRef: string;
  outcome: RuntimeToolAuditOutcome;
  durationMs: number;
  errorCode?: string;
}

export interface RuntimeToolDescriptor {
  policy: RuntimeToolPolicy;
  contractFingerprint: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: ClosedObjectSchema | JsonSchemaNode;
  outputSchema?: ClosedObjectSchema;
  runtime?: RuntimeToolPolicy;
  handler?: (args: unknown, context: RuntimeToolHandlerContext) => Promise<unknown> | unknown;
}

export interface ExecutableToolSchema extends ToolSchema {
  inputSchema: ClosedObjectSchema;
  outputSchema: ClosedObjectSchema;
  runtime: RuntimeToolPolicy;
  handler: (args: unknown, context: RuntimeToolHandlerContext) => Promise<unknown> | unknown;
}

export interface ToolSourceInfo {
  filePath: string;
  filename: string;
  rootPath: string;
}

export interface LoadedTool {
  tool: ToolSchema;
  source: ToolSourceInfo;
}
