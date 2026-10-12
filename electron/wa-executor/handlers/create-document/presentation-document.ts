import path from 'node:path';
import { writeEditablePptx } from '../../../presentation-export/pptx';
import type { PresentationDocumentArgs, PresentationDocumentResult } from './types';

type PresentationModule = {
  createPresentationPDF: (...args: unknown[]) => Promise<unknown>;
  parseMarkdownToSlides: (content: string, title: string) => unknown[];
};

export async function createPresentationDocument(
  args: PresentationDocumentArgs,
): Promise<PresentationDocumentResult> {
  if (!/^[a-z0-9 _.-]{1,100}$/i.test(args.filename) || args.filename === '.' || args.filename === '..') throw new Error('Nombre de archivo no válido.');
  if (args.format !== 'pdf') {
    const { parseMarkdownToSlides } = await import('../../../presentation-pdf/markdown');
    const slides = args.slidesJson ? JSON.parse(args.slidesJson) : parseMarkdownToSlides(args.content || '', args.title);
    const filePath = path.join(args.saveDir, `${args.filename.replace(/\.pptx$/i, '')}.pptx`);
    const slideCount = await writeEditablePptx(slides, args.title, filePath, args.customTheme ? JSON.parse(args.customTheme) : undefined);
    return { filePath, slideCount };
  }
  const { createPresentationPDF, parseMarkdownToSlides } = await loadPresentationModule();
  const slides = parseSlides(args, parseMarkdownToSlides);
  const customTheme = parseCustomTheme(args.customTheme);
  const filePath = path.join(args.saveDir, `${args.filename}.pdf`);

  await createPresentationPDF({
    slides,
    title: args.title,
    outputPath: filePath,
    customTheme,
    includeImages: args.includeImages,
    genAI: args.ctx.getGenAI(),
  });

  return { filePath, slideCount: slides.length };
}

async function loadPresentationModule(): Promise<PresentationModule> {
  try {
    return await import('../../../presentation-premium') as PresentationModule;
  } catch (importErr) {
    console.warn('[create_document] presentation-premium no disponible, usando fallback:', importErr);
    return await import('../../../presentation-pdf') as PresentationModule;
  }
}

function parseSlides(
  args: PresentationDocumentArgs,
  parseMarkdownToSlides: PresentationModule['parseMarkdownToSlides'],
): unknown[] {
  if (!args.slidesJson) return parseMarkdownToSlides(args.content || '', args.title);
  try {
    const parsed = JSON.parse(args.slidesJson);
    return Array.isArray(parsed) ? parsed : parseMarkdownToSlides(args.content || '', args.title);
  } catch {
    return parseMarkdownToSlides(args.content || '', args.title);
  }
}

function parseCustomTheme(raw?: string): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    console.warn('[create_document] Failed to parse custom_theme, using default');
    return undefined;
  }
}
