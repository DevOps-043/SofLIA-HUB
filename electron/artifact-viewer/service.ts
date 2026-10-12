import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { VIEWER_EXTENSIONS, VIEWER_LIMITS, type ArtifactReference, type ArtifactPreview, type ViewerFile } from '../../src/shared/artifact-viewer';
import { readArtifactPreview } from './read-preview';
import { ArtifactHtmlServer } from './html-server';
import { ExternalArtifactCopies } from './external-copies';
import { isolatedPreviewHtml } from '../../src/shared/artifact-preview-html';

export interface ArtifactViewerOptions {
  authorize(): Promise<void>;
  contextToken(): number;
  teamFile(jobId: string, artifactId: string): Promise<{ file: string; hash: string }>;
}
export class ArtifactViewerService {
  private local = new Map<string, { path: string; hash: string; token: number }>();
  private reading = 0;
  private html = new ArtifactHtmlServer(token => this.guard(token));
  private external = new ExternalArtifactCopies();
  constructor(private readonly options: ArtifactViewerOptions) {}
  async guard(token = this.options.contextToken()): Promise<number> {
    await this.options.authorize();
    if (token !== this.options.contextToken()) { this.local.clear(); throw new Error('La sesión o la organización cambiaron.'); }
    return token;
  }
  private async readFile(file: string): Promise<Buffer> {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size < 1 || stat.size > VIEWER_LIMITS.fileBytes) throw new Error('Archivo no disponible o mayor a 20 MB.');
    // Abrir primero y comparar identidad evita seguir una sustitución entre lstat y lectura.
    const handle = await fs.open(file, 'r');
    try {
      const opened = await handle.stat();
      if (opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) throw new Error('El archivo cambió.');
      const buffer = Buffer.alloc(stat.size + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length !== stat.size) throw new Error('El archivo cambió durante la lectura.');
      return buffer.subarray(0, length);
    } finally { await handle.close(); }
  }
  private metadata(reference: ArtifactReference, file: string, buffer: Buffer): ViewerFile {
    const extension = path.extname(file).slice(1).toLowerCase();
    if (!(VIEWER_EXTENSIONS as readonly string[]).includes(extension)) throw new Error('Este formato no tiene vista previa.');
    const name = reference.kind === 'team' ? path.basename(file).replace(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}-/i, '') : path.basename(file);
    return { reference, name, extension, bytes: buffer.length };
  }
  /** Solo recibe rutas desde el selector nativo, nunca desde IPC. */
  async selected(file: string, token: number): Promise<ViewerFile> {
    await this.guard(token);
    const buffer = await this.readFile(file);
    const id = randomUUID(); const reference: ArtifactReference = { kind: 'local', id };
    const metadata = this.metadata(reference, file, buffer);
    await this.guard(token);
    for (const [key, entry] of this.local) if (entry.token !== token) this.local.delete(key);
    if (this.local.size >= VIEWER_LIMITS.tabs) this.local.delete(this.local.keys().next().value!);
    this.local.set(id, { path: file, hash: createHash('sha256').update(buffer).digest('hex'), token });
    return metadata;
  }
  async resolve(reference: ArtifactReference): Promise<{ file: string; buffer: Buffer; metadata: ViewerFile; token: number }> {
    const token = await this.guard();
    let file: string;
    let expectedHash: string | undefined;
    if (reference.kind === 'team') {
      const source = await this.options.teamFile(reference.jobId, reference.artifactId);
      file = source.file; expectedHash = source.hash;
    }
    else {
      const entry = this.local.get(reference.id);
      if (!entry || entry.token !== token) throw new Error('Selecciona el archivo de nuevo.');
      file = entry.path; expectedHash = entry.hash;
    }
    const buffer = await this.readFile(file);
    if (createHash('sha256').update(buffer).digest('hex') !== expectedHash) throw new Error('El archivo cambió. Selecciónalo de nuevo.');
    await this.guard(token);
    return { file, buffer, metadata: this.metadata(reference, file, buffer), token };
  }
  async preview(reference: ArtifactReference): Promise<ArtifactPreview> {
    if (this.reading >= 2) throw new Error('Espera a que termine la vista previa anterior.');
    this.reading++;
    try {
      const source = await this.resolve(reference);
      const preview = await readArtifactPreview(source.metadata, source.buffer);
      if (preview.content.kind === 'html') preview.content.url = await this.html.publish(preview.content.text, source.token);
      if (preview.content.kind === 'document') preview.content.url = await this.html.publish(isolatedPreviewHtml(preview.content.text, false), source.token, false);
      await this.guard(source.token);
      return preview;
    } finally { this.reading--; }
  }
  isHtmlPreviewUrl(url: string): boolean { return this.html.matches(url); }
  async externalCopy(source: Awaited<ReturnType<ArtifactViewerService['resolve']>>): Promise<string> {
    const file = await this.external.create(source.metadata.name, source.buffer);
    await this.guard(source.token);
    return file;
  }
  clear(): void { this.local.clear(); this.html.clear(); this.external.clear(); }
}
