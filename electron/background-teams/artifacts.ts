import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { documentDesignSchema } from '../../src/shared/document-design';
import { BACKGROUND_LIMITS, type BackgroundArtifact, type BackgroundJob } from '../../src/shared/background-teams';
import type { BackgroundRepository } from './repository';
import { createEditablePptx } from '../presentation-export/pptx';
import { presentationDeckSchema } from '../../src/shared/presentations/deck-schema';
import { readPresentationText } from './presentation-reader';
import type { PreparedDocumentBranding } from '../../src/shared/document-branding';

export const textArtifactInput = z.object({ name: z.string().regex(/^[a-zA-Z0-9_-]{1,80}\.(md|txt|csv|docx)$/), title: z.string().min(1).max(180), content: z.string().trim().min(1).max(100000), subtitle: z.string().max(250).optional(), author: z.string().max(120).optional(), includeCover: z.boolean().optional(), design: documentDesignSchema.optional() }).strict();
const legacySlidesInput = z.object({ name: z.string().regex(/^[a-zA-Z0-9_-]{1,80}\.pptx$/), slides: z.array(z.object({ title: z.string().min(1).max(180), body: z.string().min(1).max(2500) }).strict()).min(1).max(20) }).strict();
export const slidesInput = z.union([legacySlidesInput, z.object({ name: z.string().regex(/^[a-zA-Z0-9_-]{1,80}\.pptx$/), deck: presentationDeckSchema }).strict()]);
export const sheetInput = z.object({ name: z.string().regex(/^[a-zA-Z0-9_-]{1,80}\.xlsx$/), headers: z.array(z.string().min(1).max(100)).min(1).max(20), rows: z.array(z.array(z.union([z.string().max(1000), z.number().finite()])).min(1).max(20)).min(1).max(200), totalColumns: z.array(z.number().int().min(0).max(19)).max(20) }).strict();

export class ArtifactStore {
  constructor(private readonly repository: BackgroundRepository, private readonly branding?: (job: BackgroundJob, disabled: boolean, guard: () => Promise<void>) => Promise<PreparedDocumentBranding>) {}
  private async folder(job: BackgroundJob, role: string) {
    if (!/^[a-z-]+$/.test(role)) throw new Error('Rol inválido.');
    const target = path.join(this.repository.folder(job.scope, job.id), role);
    await fs.mkdir(target, { recursive: true });
    const root = await fs.realpath(this.repository.root);
    const actual = await fs.realpath(target);
    if (actual !== path.resolve(target) || !actual.startsWith(root + path.sep)) throw new Error('Carpeta de trabajo fuera de alcance.');
    return target;
  }
  async file(job: BackgroundJob, artifact: BackgroundArtifact): Promise<string> {
    const folder = await this.folder(job, artifact.role);
    const file = path.join(folder, artifact.id + '-' + artifact.name);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > BACKGROUND_LIMITS.artifactBytes) throw new Error('Archivo fuera de alcance o demasiado grande.');
    return file;
  }
  async read(job: BackgroundJob, artifact: BackgroundArtifact): Promise<string> {
    const file = await this.file(job, artifact);
    const buffer = await fs.readFile(file);
    if (createHash('sha256').update(buffer).digest('hex') !== artifact.hash) throw new Error('El archivo cambió después de guardarse.');
    if (artifact.format === 'docx') {
      const mammoth = await import('mammoth');
      return (await mammoth.extractRawText({ buffer })).value.slice(0, 30000);
    }
    if (artifact.format === 'xlsx') {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file);
      return JSON.stringify(workbook.worksheets.map(sheet => sheet.getSheetValues())).slice(0, 30000);
    }
    if (artifact.format === 'pptx') {
      return readPresentationText(buffer);
    }
    return buffer.toString('utf8').slice(0, 30000);
  }
  async create(job: BackgroundJob, role: string, kind: 'text' | 'slides' | 'sheet', args: unknown, guard: () => Promise<void>): Promise<BackgroundArtifact> {
    const parsed = kind === 'text' ? textArtifactInput.parse(args) : kind === 'slides' ? slidesInput.parse(args) : sheetInput.parse(args);
    const inputHash = createHash('sha256').update(JSON.stringify({ kind, input: parsed })).digest('hex');
    const previous = job.artifacts.find(item => item.role === role && item.name === parsed.name && item.inputHash === inputHash);
    if (previous) { await guard(); await this.read(job, previous); await guard(); return previous; }
    if (job.artifacts.length >= BACKGROUND_LIMITS.artifacts) throw new Error('Se alcanzó el límite de archivos.');
    const folder = await this.folder(job, role);
    const id = randomUUID();
    const format = parsed.name.split('.').pop() as BackgroundArtifact['format'];
    const file = path.join(folder, id + '-' + parsed.name);
    const temporary = path.join(folder, id + '.tmp');
    let finished = false;
    let designNotice: string | null = null;
    await guard();
    try {
      if ('content' in parsed) {
        if (format === 'docx') {
          const { createProfessionalDocument } = await import('../document-designer');
          const identity = await this.branding?.(job, parsed.design?.useOrganizationBranding === false, guard);
          designNotice = identity?.notice ?? null;
          await createProfessionalDocument({ title: parsed.title, content: parsed.content, subtitle: parsed.subtitle, author: parsed.author,
            outputPath: temporary, type: 'word', includeCover: parsed.includeCover, design: parsed.design, brand: identity?.brand,
            beforeSave: async () => { await identity?.assertCurrent(); await guard(); } });
        } else {
          if (format === 'csv' && /(?:^|[,;\n])\s*["']?[=+@-]/m.test(parsed.content)) throw new Error('CSV con prefijos de fórmula no permitidos; usa Excel para valores negativos.');
          await fs.writeFile(temporary, parsed.content, { flag: 'wx', mode: 0o600 });
        }
      } else if ('slides' in parsed || 'deck' in parsed) {
        const output = await createEditablePptx('deck' in parsed ? parsed.deck : parsed.slides, 'Presentación');
        await fs.writeFile(temporary, output.buffer, { flag: 'wx', mode: 0o600 });
      } else {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Datos');
        sheet.addRow(parsed.headers); sheet.getRow(1).font = { bold: true };
        for (const row of parsed.rows) {
          if (row.length !== parsed.headers.length) throw new Error('La tabla contiene filas incompletas.');
          sheet.addRow(row);
        }
        for (const column of new Set(parsed.totalColumns)) {
          if (column >= parsed.headers.length || parsed.rows.some(row => typeof row[column] !== 'number')) throw new Error('Los totales requieren columnas numéricas.');
          const cell = sheet.getCell(parsed.rows.length + 2, column + 1);
          const letter = sheet.getColumn(column + 1).letter;
          cell.value = { formula: 'SUM(' + letter + '2:' + letter + (parsed.rows.length + 1) + ')', result: parsed.rows.reduce((sum, row) => sum + Number(row[column]), 0) };
        }
        sheet.columns.forEach(column => { column.width = 24; });
        await workbook.xlsx.writeFile(temporary);
      }
      await guard();
      const buffer = await fs.readFile(temporary);
      if (!buffer.length || buffer.length > BACKGROUND_LIMITS.artifactBytes) throw new Error('Tamaño de archivo fuera de límite.');
      await fs.rename(temporary, file);
      const artifact: BackgroundArtifact = { id, role, name: parsed.name, format, bytes: buffer.length, hash: createHash('sha256').update(buffer).digest('hex'), inputHash, verified: false, ...(designNotice ? { designNotice } : {}) };
      await guard(); await this.read(job, artifact); await guard();
      artifact.verified = true;
      finished = true;
      return artifact;
    } finally {
      await fs.rm(temporary, { force: true });
      if (!finished) {
        await this.folder(job, role);
        await fs.rm(file, { force: true });
      }
    }
  }
}

