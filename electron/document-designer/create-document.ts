import { AlignmentType, HeadingLevel, ImageRun, Packer, Paragraph, Table, TextRun } from 'docx';
import fs from 'node:fs/promises';
import { DOCUMENT_COLORS, resolveDocumentDesign, type DocumentDesign } from '../../src/shared/document-design';
import { blocksToParagraphs, documentListStarts } from './content-parser';
import { createTitleBlock } from './cover-page';
import { documentBlocks, shouldIncludeCover } from './document-layout';
import { buildDocument } from './document-shell';
import type { DocumentOptions } from './types';

export async function createProfessionalDocument(options: DocumentOptions): Promise<string> {
  const {
    content,
    title,
    subtitle,
    author,
    outputPath,
    includeCover,
    includeTOC: _includeTOC = false,
    chartImages = [],
  } = options;
  const design = resolveDocumentDesign(options.design);
  const blocks = documentBlocks(title, content);
  const cover = shouldIncludeCover(content, includeCover);
  const children: (Paragraph | Table)[] = [];

  children.push(...createTitleBlock(title, design, cover, subtitle, author));
  if (cover) children.push(new Paragraph({ pageBreakBefore: true, spacing: { after: 0 } }));

  children.push(...blocksToParagraphs(blocks, design));
  children.push(...buildChartSection(chartImages, design));
  await fs.writeFile(outputPath, await Packer.toBuffer(buildDocument(title, children, design, cover, documentListStarts(blocks))));
  return outputPath;
}

const CHART_TARGET_WIDTH = 520;
const MAX_CHART_IMAGES = 8;

/** Anexa las graficas (data URLs) como seccion final del documento. */
function buildChartSection(chartImages: string[], design: DocumentDesign): Paragraph[] {
  const images = chartImages
    .map(decodeChartDataUrl)
    .filter((image): image is DecodedChartImage => image !== null)
    .slice(0, MAX_CHART_IMAGES);
  if (images.length === 0) return [];

  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: images.length > 1 ? 'Anexo de gráficas' : 'Anexo de gráfica', bold: true, size: design.headingSizes[0], color: DOCUMENT_COLORS.heading, font: design.font })],
      heading: HeadingLevel.HEADING_1,
      keepNext: true,
      spacing: { before: 400, after: 200 },
    }),
  ];
  for (const image of images) {
    const { width, height } = resolveChartDimensions(image.data);
    paragraphs.push(new Paragraph({
      children: [new ImageRun({ data: image.data, type: image.type, transformation: { width, height } })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }));
  }
  return paragraphs;
}

/** docx 9 exige declarar el formato, asi que se conserva el del data URL. */
type DecodedChartImage = { data: Buffer; type: 'png' | 'jpg' };

function decodeChartDataUrl(dataUrl: unknown): DecodedChartImage | null {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  try {
    return { data: Buffer.from(match[2], 'base64'), type: match[1] === 'png' ? 'png' : 'jpg' };
  } catch {
    return null;
  }
}

/** Escala al ancho de pagina conservando el aspecto real del PNG si se puede leer. */
function resolveChartDimensions(data: Buffer): { width: number; height: number } {
  const isPng = data.length > 24 && data.toString('ascii', 1, 4) === 'PNG';
  if (isPng) {
    const sourceWidth = data.readUInt32BE(16);
    const sourceHeight = data.readUInt32BE(20);
    if (sourceWidth > 0 && sourceHeight > 0) {
      const scale = Math.min(CHART_TARGET_WIDTH / sourceWidth, 680 / sourceHeight);
      return { width: Math.round(sourceWidth * scale), height: Math.round(sourceHeight * scale) };
    }
  }
  return { width: CHART_TARGET_WIDTH, height: Math.round(CHART_TARGET_WIDTH * 0.6) };
}
