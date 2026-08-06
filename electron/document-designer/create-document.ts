import { AlignmentType, HeadingLevel, ImageRun, Packer, Paragraph, Table, TextRun } from 'docx';
import fs from 'node:fs/promises';
import { COLORS } from './colors';
import { parseContentToParagraphs } from './content-parser';
import { createCoverPage } from './cover-page';
import { buildDocument } from './document-shell';
import type { DocumentOptions } from './types';

export async function createProfessionalDocument(options: DocumentOptions): Promise<string> {
  const {
    content,
    title,
    subtitle,
    author,
    outputPath,
    includeCover = true,
    includeTOC: _includeTOC = false,
    chartImages = [],
  } = options;
  const children: (Paragraph | Table)[] = [];

  if (includeCover) {
    children.push(...createCoverPage(title, subtitle, author));
  } else {
    children.push(new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 44, color: COLORS.heading1, font: 'Calibri' })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));
  }

  children.push(...parseContentToParagraphs(content));
  children.push(...buildChartSection(chartImages));
  await fs.writeFile(outputPath, await Packer.toBuffer(buildDocument(title, children)));
  console.log(`[document-designer] Document saved: ${outputPath}`);
  return outputPath;
}

const CHART_TARGET_WIDTH = 520;
const MAX_CHART_IMAGES = 8;

/** Anexa las graficas (data URLs) como seccion final del documento. */
function buildChartSection(chartImages: string[]): Paragraph[] {
  const images = chartImages
    .map(decodeChartDataUrl)
    .filter((image): image is DecodedChartImage => image !== null)
    .slice(0, MAX_CHART_IMAGES);
  if (images.length === 0) return [];

  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: images.length > 1 ? 'Anexo: Gráficas' : 'Anexo: Gráfica', bold: true, size: 30, color: COLORS.heading2, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_1,
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
      return { width: CHART_TARGET_WIDTH, height: Math.round((CHART_TARGET_WIDTH * sourceHeight) / sourceWidth) };
    }
  }
  return { width: CHART_TARGET_WIDTH, height: Math.round(CHART_TARGET_WIDTH * 0.6) };
}
