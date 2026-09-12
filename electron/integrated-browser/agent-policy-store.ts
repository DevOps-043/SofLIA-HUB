import { flushPolicyFile, preparePolicyRecovery, readPolicyFile, serializePolicyFile, writePolicyFile, type PolicyRecoveryReview } from './policy-file-recovery';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import type { BrowserAgentCapability, BrowserAgentPolicyMode, BrowserAgentSiteDecision, BrowserAgentSitePolicy } from './platform-types';

type AgentPolicyFile = { version: 1; policies: BrowserAgentSitePolicy[] };
export type BrowserAgentPolicyEvaluation = 'allow' | 'ask' | 'block';
const MODES = new Set<BrowserAgentPolicyMode>(['strict', 'balanced']);
const STORED_DECISIONS = new Set<BrowserAgentSiteDecision>(['ask', 'allow-always', 'block']);

export class BrowserAgentPolicyStore {
  private writeQueue = Promise.resolve();
  constructor(private readonly location: string | (() => string) = () => browserProfilePath('agent-policies.json')) {}

  async flush(): Promise<void> {
    const destination = this.filePath;
    await this.writeQueue;
    await flushPolicyFile(destination);
  }

  async get(rawOrigin: string): Promise<BrowserAgentSitePolicy> {
    const destination = this.filePath;
    await this.writeQueue;
    const origin = normalizeAgentOrigin(rawOrigin);
    const stored = (await this.read(destination)).policies.find((policy) => policy.origin === origin);
    return stored ? { ...stored } : { origin, mode: 'balanced', decision: 'ask', managed: false, updatedAt: new Date(0).toISOString() };
  }

  async set(raw: unknown): Promise<BrowserAgentSitePolicy> {
    const destination = this.filePath;
    const input = validatePolicyInput(raw);
    let saved!: BrowserAgentSitePolicy;
    await this.enqueue(async () => {
      const file = await this.read(destination);
      const current = file.policies.find((policy) => policy.origin === input.origin);
      if (current?.managed) throw new Error('La política del agente está administrada por la organización.');
      saved = { ...input, managed: false, updatedAt: new Date().toISOString() };
      file.policies = file.policies.filter((policy) => policy.origin !== saved.origin);
      file.policies.push(saved);
      if (file.policies.length > 2_000) throw new Error('Se alcanzó la cuota de políticas por sitio.');
      await this.write(file, destination);
    }, destination);
    return { ...saved };
  }

  async evaluate(rawOrigin: string, capability: BrowserAgentCapability): Promise<BrowserAgentPolicyEvaluation> {
    const policy = await this.get(rawOrigin);
    if (policy.decision === 'block') return 'block';
    if (policy.decision === 'allow-always') return 'allow';
    if (policy.mode === 'balanced' && capability !== 'act' && policy.updatedAt !== new Date(0).toISOString()) return 'allow';
    return 'ask';
  }

  private get filePath(): string { return resolveStoreLocation(this.location); }

  async prepareRecovery(guard: () => void): Promise<PolicyRecoveryReview> {
    const destination = this.filePath; await this.writeQueue; guard();
    return preparePolicyRecovery<AgentPolicyFile>(destination, validatePolicyFile, file => ({ count: file.policies.length,
      value: { version: 1, policies: file.policies.map((policy): BrowserAgentSitePolicy => ({ ...policy, mode: 'strict', decision: policy.managed || policy.decision === 'block' ? 'block' : 'ask' })) } }), guard);
  }

  private async enqueue(operation: () => Promise<void>, destination: string) {
    const pending = this.writeQueue.then(() => serializePolicyFile(destination, operation));
    this.writeQueue = pending.catch(() => undefined);
    await pending;
  }

  private async read(destination: string): Promise<AgentPolicyFile> {
    try { return await readPolicyFile(destination, validatePolicyFile, () => ({ version: 1, policies: [] })); }
    catch { throw new Error('Las políticas del agente están dañadas o no son compatibles. Se conserva el archivo.'); }
  }

  private async write(file: AgentPolicyFile, destination: string): Promise<void> {
    await writePolicyFile(destination, file, validatePolicyFile);
  }
}

function validatePolicyFile(raw: unknown): AgentPolicyFile {
  const file = raw as AgentPolicyFile;
  if (!file || file.version !== 1 || !Array.isArray(file.policies) || file.policies.length > 2_000) throw new Error('Formato inválido.');
  return { version: 1, policies: file.policies.map(validateStoredPolicy) };
}

export function normalizeAgentOrigin(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('El origen del agente no está permitido.');
  return url.origin;
}

function validatePolicyInput(raw: unknown): Pick<BrowserAgentSitePolicy, 'origin' | 'mode' | 'decision'> {
  if (!raw || typeof raw !== 'object') throw new Error('La política del agente es inválida.');
  const value = raw as { origin?: unknown; mode?: unknown; decision?: unknown };
  if (typeof value.origin !== 'string' || !MODES.has(value.mode as BrowserAgentPolicyMode) || !STORED_DECISIONS.has(value.decision as BrowserAgentSiteDecision)) throw new Error('La política del agente es inválida.');
  return { origin: normalizeAgentOrigin(value.origin), mode: value.mode as BrowserAgentPolicyMode, decision: value.decision as BrowserAgentSiteDecision };
}

function validateStoredPolicy(raw: BrowserAgentSitePolicy): BrowserAgentSitePolicy {
  const input = validatePolicyInput(raw);
  if (typeof raw.updatedAt !== 'string' || Number.isNaN(Date.parse(raw.updatedAt)) || typeof raw.managed !== 'boolean') throw new Error('Política inválida.');
  return { ...input, managed: raw.managed, updatedAt: raw.updatedAt };
}
