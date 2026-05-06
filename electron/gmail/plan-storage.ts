/**
 * Persistencia en disco de los planes de organización de Gmail.
 *
 * Cada plan vive en `userData/gmail-organization-plans/<planId>.json`.
 * El propósito de persistir el plan completo (no solo el ID) es permitir el
 * undo: necesitamos saber qué labels existían antes y qué cambios aplicamos.
 */

import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { GmailOrganizationPlanRecord } from './types';

const PLAN_SUBDIR = 'gmail-organization-plans';

function getPlanDirectory(): string {
  return path.join(app.getPath('userData'), PLAN_SUBDIR);
}

async function ensurePlanDirectory(): Promise<void> {
  await fs.mkdir(getPlanDirectory(), { recursive: true });
}

function getPlanPath(planId: string): string {
  return path.join(getPlanDirectory(), `${planId}.json`);
}

export async function saveOrganizationPlan(plan: GmailOrganizationPlanRecord): Promise<void> {
  await ensurePlanDirectory();
  await fs.writeFile(getPlanPath(plan.id), JSON.stringify(plan, null, 2), 'utf-8');
}

export async function loadOrganizationPlan(planId: string): Promise<GmailOrganizationPlanRecord> {
  const raw = await fs.readFile(getPlanPath(planId), 'utf-8');
  return JSON.parse(raw) as GmailOrganizationPlanRecord;
}

/**
 * Devuelve el ID del plan aplicado más recientemente, o `null` si no hay
 * planes aplicados. Útil cuando el usuario invoca "undo" sin especificar planId.
 */
export async function findLatestAppliedOrganizationPlanId(): Promise<string | null> {
  await ensurePlanDirectory();
  const entries = await fs.readdir(getPlanDirectory(), { withFileTypes: true });
  const plans: GmailOrganizationPlanRecord[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    try {
      const raw = await fs.readFile(path.join(getPlanDirectory(), entry.name), 'utf-8');
      const parsed = JSON.parse(raw) as GmailOrganizationPlanRecord;
      if (parsed.status === 'applied' && parsed.applyResult?.appliedAt) {
        plans.push(parsed);
      }
    } catch {
      // Plan corrupto: ignoramos y seguimos con los demás.
    }
  }

  plans.sort((left, right) => {
    const leftTime = new Date(left.applyResult?.appliedAt || left.createdAt).getTime();
    const rightTime = new Date(right.applyResult?.appliedAt || right.createdAt).getTime();
    return rightTime - leftTime;
  });

  return plans[0]?.id || null;
}
