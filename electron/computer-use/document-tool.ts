import { app, shell } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProfessionalDocument } from '../document-designer';

const DEFAULT_DOCUMENT_TITLE = 'Documento SofLIA';
const MAX_DOCUMENT_CONTENT_LENGTH = 250_000;
const DOCX_EXTENSION = '.docx';

interface CreateWordDocumentArgs {
  title?: string;
  subtitle?: string;
  author?: string;
  content?: string;
  file_name?: string;
  output_path?: string;
  include_cover?: boolean;
  open_after_save?: boolean;
  /** Graficas (data:image/png;base64,...) generadas en la conversacion; se anexan al final. */
  chart_images?: string[];
}

export async function handleCreateWordDocument(args: CreateWordDocumentArgs = {}): Promise<Record<string, any>> {
  const content = normalizeContent(args.content);
  if (!content) {
    return {
      success: false,
      error: 'Falta el contenido que debe ir dentro del documento.',
    };
  }

  if (content.length > MAX_DOCUMENT_CONTENT_LENGTH) {
    return {
      success: false,
      error: `El contenido excede el limite de ${MAX_DOCUMENT_CONTENT_LENGTH} caracteres.`,
    };
  }

  const title = normalizeTitle(args.title);
  const outputPath = await resolveAvailableOutputPath(args, title);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const savedPath = await createProfessionalDocument({
    type: 'word',
    title,
    subtitle: normalizeOptionalText(args.subtitle),
    author: normalizeOptionalText(args.author),
    content,
    outputPath,
    includeCover: args.include_cover !== false,
    chartImages: Array.isArray(args.chart_images) ? args.chart_images : [],
  });

  if (args.open_after_save) {
    await shell.openPath(savedPath);
  }

  return {
    success: true,
    path: savedPath,
    file_name: path.basename(savedPath),
    message: `Documento Word creado correctamente en ${savedPath}`,
  };
}

function normalizeContent(content: unknown): string {
  return typeof content === 'string' ? content.trim() : '';
}

function normalizeTitle(title: unknown): string {
  const normalized = typeof title === 'string' ? title.trim() : '';
  return normalized || DEFAULT_DOCUMENT_TITLE;
}

function normalizeOptionalText(text: unknown): string | undefined {
  const normalized = typeof text === 'string' ? text.trim() : '';
  return normalized || undefined;
}

async function resolveAvailableOutputPath(args: CreateWordDocumentArgs, title: string): Promise<string> {
  const fallbackFileName = ensureDocxExtension(sanitizeFileName(args.file_name || title));
  const explicitPath = normalizeOptionalText(args.output_path);
  const requestedPath = explicitPath
    ? resolveUserPath(explicitPath)
    : path.join(app.getPath('desktop'), fallbackFileName);

  const targetPath = isDocxPath(requestedPath)
    ? requestedPath
    : path.join(requestedPath, fallbackFileName);

  return getAvailablePath(targetPath);
}

function resolveUserPath(inputPath: string): string {
  if (isDesktopAlias(inputPath)) return app.getPath('desktop');

  const expanded = inputPath
    .replace(/^~(?=$|[\\/])/, os.homedir())
    .replace(/%USERPROFILE%/gi, os.homedir());
  return path.resolve(expanded);
}

function isDesktopAlias(inputPath: string): boolean {
  const normalized = inputPath
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/]+$/g, '')
    .trim();
  return normalized === 'desktop' || normalized === 'escritorio' || normalized === 'mi escritorio';
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 90);
  return sanitized || DEFAULT_DOCUMENT_TITLE;
}

function ensureDocxExtension(fileName: string): string {
  return fileName.toLowerCase().endsWith(DOCX_EXTENSION) ? fileName : `${fileName}${DOCX_EXTENSION}`;
}

function isDocxPath(targetPath: string): boolean {
  return path.extname(targetPath).toLowerCase() === DOCX_EXTENSION;
}

async function getAvailablePath(targetPath: string): Promise<string> {
  const parsed = path.parse(targetPath);
  let candidate = targetPath;
  let index = 2;

  while (await pathExists(candidate)) {
    candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext || DOCX_EXTENSION}`);
    index += 1;
  }

  return candidate;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
