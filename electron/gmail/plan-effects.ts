import type { GmailClient } from './types';
import type { PrivateGmailPlan } from './plan-schema';
import type { GmailPlanContext } from './plan-context';

/** Intención durable antes de llamar Gmail; conservarla si el efecto no es verificable. */
export async function planEffect<T>(context: GmailPlanContext, plan: PrivateGmailPlan,
  intent: NonNullable<PrivateGmailPlan['pending']>, operation: (client: GmailClient) => Promise<T>,
  acknowledge: (result: T) => void): Promise<void> {
  let started = false;
  plan.pending = intent;
  try {
    await context.store.save(plan, context.assert);
    await context.call(async client => {
      started = true;
      const result = await operation(client);
      context.assert(); acknowledge(result);
    });
    delete plan.pending;
    await context.store.save(plan, context.assert);
  } catch (error) {
    if (started) plan.pending = intent;
    else delete plan.pending;
    throw error;
  }
}
