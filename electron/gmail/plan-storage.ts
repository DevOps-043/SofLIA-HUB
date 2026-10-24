import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { systemCipher, type OsCipher } from '../storage/os-cipher';
import { readPrivateFile, replacePrivateFile } from '../storage/private-files';
import { gmailPlanIdSchema } from '../../src/shared/gmail-organization';
import { gmailPlanOwnerSchema, gmailPrivatePlanSchema, type GmailPlanOwner, type PrivateGmailPlan } from './plan-schema';

const MAGIC = Buffer.from('SOFLIA-GMAIL-PLAN-1\n');
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_ENCRYPTED_BYTES = 4 * 1024 * 1024;
const MAX_PLANS = 100;
const activeAccounts = new Set<string>();
const payloadSchema = z.object({ version: z.literal(1), owner: gmailPlanOwnerSchema, plan: gmailPrivatePlanSchema }).strict();

export class GmailPlanStorageError extends Error {
  constructor(code: 'quota' | 'size' | 'cipher') {
    super(code === 'size' ? 'El plan excede la cuota de 2 MiB. Genera una vista previa con menos mensajes.' : code === 'quota'
      ? 'Se alcanzó la cuota de planes de esta cuenta. Conserva un respaldo y solicita una limpieza del historial antes de crear otro plan.'
      : 'El sistema no ofrece cifrado seguro para los planes Gmail. Activa el llavero del sistema y vuelve a intentarlo.');
  }
}

export interface GmailPlanAccount {
  save(plan: PrivateGmailPlan, assertCurrent: () => void): Promise<void>;
  load(id: string, assertCurrent: () => void): Promise<PrivateGmailPlan>;
  latest(assertCurrent: () => void): Promise<string | null>;
  exclusive<T>(work: () => Promise<T>): Promise<T>;
}

/** Custodia de planes; no lee ni adjudica los JSON heredados sin propietario. */
export class GmailPlanStore {
  constructor(private readonly options: { root?: () => string; cipher?: OsCipher; replace?: typeof replacePrivateFile } = {}) {}

  account(input: GmailPlanOwner): GmailPlanAccount {
    const owner = gmailPlanOwnerSchema.parse(input);
    const root = path.resolve(this.options.root?.() ?? app.getPath('userData'));
    const base = path.join(root, 'gmail-private-plans');
    const directory = path.join(base, createHash('sha256').update(JSON.stringify(owner)).digest('hex'));
    const leaseKey = process.platform === 'win32' ? directory.toLowerCase() : directory;
    const cipher = this.options.cipher ?? systemCipher;
    const replace = this.options.replace ?? replacePrivateFile;
    const location = (id: string) => path.join(directory, gmailPlanIdSchema.parse(id) + '.bin');
    const ensure = async (assert: () => void) => {
      assert();
      if (!await cipher.available()) throw new GmailPlanStorageError('cipher');
      assert();
      await fs.mkdir(base, { recursive: true, mode: 0o700 });
      if ((await fs.lstat(base)).isSymbolicLink()) throw new Error('Directorio privado inválido.');
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error('Directorio privado inválido.');
      assert();
    };
    const entries = async () => {
      const result: string[] = [];
      let visited = 0;
      const handle = await fs.opendir(directory);
      for await (const entry of handle) {
        if (++visited > MAX_PLANS * 2) throw new GmailPlanStorageError('quota');
        if (entry.isFile() && /^gmail-plan-[a-f0-9-]+\.bin\.[a-f0-9-]+\.tmp$/.test(entry.name)) continue;
        if (result.length >= MAX_PLANS) throw new GmailPlanStorageError('quota');
        if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.bin')) throw new Error('Directorio de planes inconsistente.');
        gmailPlanIdSchema.parse(entry.name.slice(0, -4)); result.push(entry.name);
      }
      return result;
    };
    const encode = async (plan: PrivateGmailPlan, assert: () => void) => {
      const payload = payloadSchema.parse({ version: 1, owner, plan });
      const json = JSON.stringify(payload);
      if (Buffer.byteLength(json) > MAX_JSON_BYTES) throw new GmailPlanStorageError('size');
      const encrypted = await cipher.encrypt(json); assert();
      return Buffer.concat([MAGIC, encrypted]);
    };
    const save = async (plan: PrivateGmailPlan, assert: () => void) => {
      location(plan.id); await ensure(assert);
      const names = await entries(); assert();
      if (names.length >= MAX_PLANS && !names.includes(plan.id + '.bin')) throw new GmailPlanStorageError('quota');
      await replace(location(plan.id), await encode(plan, assert), assert, MAX_ENCRYPTED_BYTES);
    };
    const load = async (id: string, assert: () => void) => {
      const file = location(id); await ensure(assert);
      const bytes = await readPrivateFile(file, MAX_ENCRYPTED_BYTES); assert();
      if (!bytes || !bytes.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Plan inexistente, heredado o incompatible. Crea una vista previa nueva.');
      const decoded = await cipher.decrypt(bytes.subarray(MAGIC.length)); assert();
      if (Buffer.byteLength(decoded.result) > MAX_JSON_BYTES) throw new Error('Plan excesivo.');
      const payload = payloadSchema.parse(JSON.parse(decoded.result));
      if (payload.owner.userId !== owner.userId || payload.owner.email !== owner.email || payload.plan.id !== id) throw new Error('El plan no pertenece a esta cuenta.');
      if (decoded.shouldReEncrypt) await replace(file, await encode(payload.plan, assert), assert, MAX_ENCRYPTED_BYTES);
      return payload.plan;
    };
    return {
      save, load,
      latest: async assert => {
        await ensure(assert); const names = await entries(); assert();
        const plans: PrivateGmailPlan[] = [];
        // Un archivo ilegible bloquea la selección: no saltar al plan de otra operación.
        for (const name of names) { const plan = await load(name.slice(0, -4), assert); if (plan.applyResult) plans.push(plan); }
        plans.sort((a, b) => Date.parse(b.applyResult!.appliedAt) - Date.parse(a.applyResult!.appliedAt));
        if (plans.length > 1 && plans[0].applyResult!.appliedAt === plans[1].applyResult!.appliedAt) throw new Error('Selección ambigua; indica el ID del plan.');
        return plans[0]?.id ?? null;
      },
      exclusive: async work => {
        if (activeAccounts.has(leaseKey)) throw new Error('Ya hay un plan en ejecución para esta cuenta.');
        activeAccounts.add(leaseKey);
        try { return await work(); } finally { activeAccounts.delete(leaseKey); }
      },
    };
  }
}
