import type { SkillChannel } from '../shared/skills/types';

/**
 * Wrapper tipado del renderer sobre los canales `passive-skills:*`.
 *
 * Sustituye a `workflow-hub-service`: al unificarse Flujos y Skills, lo unico
 * que el renderer sigue necesitando de main sobre programaciones es el alta,
 * la baja y la consulta de Skills pasivas. Los casos y aprobaciones que aquel
 * exponia viven ahora solo en Meeting Ops.
 */

export interface PassiveSkillRule {
  id: string;
  skillId: string | null;
  skillName: string;
  name: string;
  description: string;
  prompt: string;
  scheduleLabel: string;
  cronExpression: string | null;
  runOnce: boolean;
  scheduledFor: string | null;
  channels: SkillChannel[];
  source: 'legacy' | 'chat' | 'app' | 'system';
  status: 'active' | 'blocked' | 'system';
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  requestedBy: string | null;
  phoneNumber: string | null;
  reason: string | null;
}

export interface PassiveSkillsOverview {
  rules: PassiveSkillRule[];
  systemRules: PassiveSkillRule[];
  /** Sin sesión la lista viene vacía, que NO es lo mismo que no tener rutinas. */
  hasSession?: boolean;
}

export interface SavePassiveSkillInput {
  ruleId?: string | null;
  skillId?: string | null;
  name: string;
  description?: string;
  prompt: string;
  cronExpression: string;
  scheduleLabel?: string;
  channels: SkillChannel[];
  runOnce?: boolean;
  scheduledFor?: string | null;
  source?: 'chat' | 'app';
  requestedBy?: string | null;
  phoneNumber?: string | null;
}

interface PassiveSkillsBridge {
  getOverview: (profile?: string) => Promise<{ success: boolean; overview?: PassiveSkillsOverview; error?: string }>;
  saveRule: (input: SavePassiveSkillInput) => Promise<{ success: boolean; rule?: PassiveSkillRule; error?: string }>;
  deleteRule: (ruleId: string) => Promise<{ success: boolean; deleted?: boolean; error?: string }>;
}

declare global {
  interface Window {
    passiveSkills?: PassiveSkillsBridge;
  }
}

export function isPassiveSkillsAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.passiveSkills;
}

function api(): PassiveSkillsBridge {
  if (!window.passiveSkills) {
    throw new Error('La API de skills pasivas no esta disponible en este entorno.');
  }
  return window.passiveSkills;
}

/** `profile`: 'global' o el telefono del contacto. Sin el, todas las del usuario. */
export function getPassiveSkillsOverview(profile?: string) {
  return api().getOverview(profile);
}

export function savePassiveSkill(input: SavePassiveSkillInput) {
  return api().saveRule(input);
}

export function deletePassiveSkill(ruleId: string) {
  return api().deleteRule(ruleId);
}
