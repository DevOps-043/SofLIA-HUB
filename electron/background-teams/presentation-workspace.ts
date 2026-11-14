import type { BackgroundJob } from '../../src/shared/background-teams';
import { parsePresentationDeck } from '../../src/shared/presentations/deck-schema';
import type { SkillWorkspaceService } from '../skill-workspace/service';
import type { BackgroundPresentation } from './contracts';
import { toolSchemas } from './tools';

/** Adaptador main: el modelo no puede elegir workspace, conversación ni ruta absoluta. */
export class WorkspaceBackgroundPresentation implements BackgroundPresentation {
  constructor(private readonly workspace: () => SkillWorkspaceService, private readonly verifyLegacy?: (job: BackgroundJob) => Promise<void>) {}

  private id(job: BackgroundJob): string {
    if (!job.presentationWorkspaceId) throw new Error('El trabajo no tiene presentación.');
    return job.presentationWorkspaceId;
  }
  async acquire(job: BackgroundJob): Promise<void> {
    await this.workspace().reserveBackground(this.id(job), job.id, job.conversationId, job.scope,
      this.verifyLegacy ? () => this.verifyLegacy!(job) : undefined);
  }
  release(job: BackgroundJob): void {
    if (job.presentationWorkspaceId) this.workspace().releaseBackground(job.presentationWorkspaceId, job.id);
  }
  async call(job: BackgroundJob, name: string, args: unknown, guard: () => Promise<void>, generateImage?: (prompt: string) => Promise<string>): Promise<string> {
    await guard();
    const id = this.id(job);
    await this.acquire(job);
    await guard();
    const service = this.workspace();
    if (name === 'workspace_generate_image') {
      const input = toolSchemas.workspace_generate_image.parse(args);
      if (!generateImage) throw new Error('La generación de imágenes no está disponible.');
      const dataUrl = await generateImage(input.prompt); await guard();
      if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) throw new Error('Imagen generada inválida.');
      const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
      const meta = await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata(); await guard();
      if (meta.format !== 'png') throw new Error('La imagen generada no es PNG.');
      const result = await service.writeBackgroundImage(id, job.id, input.file_name, bytes, guard); await guard();
      if (!result.ok) throw new Error(result.error);
      return JSON.stringify({ archivo: result.data });
    }
    if (name === 'workspace_read_image') {
      const input = toolSchemas.workspace_read_image.parse(args);
      const file = await service.resolveAbsolutePath(id, input.path); await guard();
      if (!file || (await fs.stat(file)).size > 4 * 1024 * 1024) throw new Error('Imagen fuera de alcance o demasiado grande.');
      const bytes = await fs.readFile(file); await guard();
      const meta = await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata(); await guard();
      const mime = meta.format === 'png' ? 'image/png' : meta.format === 'jpeg' ? 'image/jpeg' : meta.format === 'webp' ? 'image/webp' : null;
      if (!mime || !bytes.length || bytes.length > 4 * 1024 * 1024) throw new Error('Formato de imagen no permitido.');
      return JSON.stringify({ path: input.path, imageDataUrl: 'data:' + mime + ';base64,' + bytes.toString('base64') });
    }
    if (name === 'workspace_list_files') {
      toolSchemas.workspace_list_files.parse(args);
      const result = await service.listFiles(id); await guard();
      if (!result.ok) throw new Error(result.error);
      return JSON.stringify({ archivos: result.data });
    }
    if (name === 'workspace_read_file') {
      const input = toolSchemas.workspace_read_file.parse(args);
      const result = await service.readFile(id, input.path); await guard();
      if (!result.ok) throw new Error(result.error);
      return JSON.stringify({ path: input.path, content: result.data });
    }
    let path: string;
    let content: string;
    if (name === 'workspace_write_file') {
      const input = toolSchemas.workspace_write_file.parse(args);
      path = input.path; content = input.content;
    } else if (name === 'workspace_edit_file') {
      const input = toolSchemas.workspace_edit_file.parse(args);
      const source = await service.readFile(id, input.path); await guard();
      if (!source.ok) throw new Error(source.error);
      if (source.data.split(input.search).length !== 2) throw new Error('El reemplazo requiere un fragmento exacto y único; lee el archivo y amplía el contexto.');
      path = input.path; content = source.data.replace(input.search, () => input.replace);
    } else throw new Error('Herramienta de presentación no autorizada.');
    const result = await service.writeBackgroundFile(id, job.id, path, content, guard); await guard();
    if (!result.ok) throw new Error(result.error);
    return JSON.stringify({ archivo: result.data });
  }
  async verify(job: BackgroundJob, guard: () => Promise<void>) {
    await guard(); await this.acquire(job); await guard();
    const id = this.id(job);
    const service = this.workspace();
    const source = await service.readFile(id, 'deck.json'); await guard();
    if (!source.ok) throw new Error('Falta deck.json válido de la presentación.');
    const deck = parsePresentationDeck(JSON.parse(source.data));
    const imagePath = async (relative: string) => {
      await guard();
      const file = await service.resolveAbsolutePath(id, relative);
      await guard(); return file;
    };
    for (const slide of deck.slides) if ('imagen' in slide && slide.imagen && !await imagePath(slide.imagen.src)) {
      throw new Error('Falta una imagen declarada en la presentación.');
    }
    const branding = await service.readFile(id, 'estilos/marca.css'); await guard();
    const color = (name: string) => branding.ok ? new RegExp('--marca-color-' + name + ':\\s*(#[0-9a-f]{6})', 'i').exec(branding.data)?.[1] : undefined;
    return { deck, imagePath, theme: { colors: { bg: color('fondo'), text: color('texto'), accent: color('acento') } } };
  }
}
import fs from 'node:fs/promises';
import sharp from 'sharp';
