import { AlignmentType, HeadingLevel, Packer, Paragraph, Table, TextRun } from 'docx';
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
  await fs.writeFile(outputPath, await Packer.toBuffer(buildDocument(title, children)));
  console.log(`[document-designer] Document saved: ${outputPath}`);
  return outputPath;
}
