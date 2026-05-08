import crypto from 'node:crypto';
import type { SaveWorkflowVariantInput, WorkflowVariant } from './types';
import type { WorkflowHubServiceContext } from './service-context';
import { sanitizeWorkflowConfig } from './workflow-config';

export function saveVariant(
  ctx: WorkflowHubServiceContext,
  input: SaveWorkflowVariantInput,
): WorkflowVariant {
  const workflow = ctx.getWorkflowDefinition(input.workflowId);
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Necesito un nombre para guardar la variante.');

  const now = new Date().toISOString();
  const sanitizedConfig = sanitizeWorkflowConfig(workflow.id, input.config || {});
  const existing = input.variantId
    ? ctx.state.variants.find((variant) => variant.id === input.variantId)
    : null;
  const variant: WorkflowVariant = existing
    ? {
        ...existing,
        name,
        description: String(input.description || '').trim(),
        config: sanitizedConfig,
        updatedAt: now,
      }
    : {
        id: `variant_${crypto.randomUUID()}`,
        workflowId: workflow.id,
        name,
        description: String(input.description || '').trim(),
        config: sanitizedConfig,
        createdAt: now,
        updatedAt: now,
        createdBy: input.createdBy || null,
      };

  ctx.state.variants = existing
    ? ctx.state.variants.map((candidate) => candidate.id === variant.id ? variant : candidate)
    : [variant, ...ctx.state.variants];
  ctx.state.variants = ctx.state.variants.slice(0, 200);
  ctx.saveState();
  return structuredClone(variant);
}
