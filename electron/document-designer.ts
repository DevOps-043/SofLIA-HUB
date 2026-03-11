/**
 * document-designer.ts — Professional Word (.docx) and PDF generation.
 *
 * Converts markdown-like content into properly formatted documents
 * with cover pages, heading hierarchy, styled paragraphs, tables,
 * bullet lists, bold/italic, and page numbers.
 */

import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageNumber,
  Footer,
  Header,
  NumberFormat,
  ShadingType,
} from 'docx';
import fs from 'node:fs/promises';


// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface DocumentOptions {
  content: string;      // Markdown-formatted content
  title: string;
  subtitle?: string;
  author?: string;
  outputPath: string;
  type: 'word' | 'pdf';
  includeCover?: boolean;
  includeTOC?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Color palette
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = {
  primary: '2B3674',
  accent: '4318FF',
  heading1: '1B2559',
  heading2: '2B3674',
  heading3: '3A4A8A',
  text: '333333',
  muted: '8F9BBA',
  border: 'E0E5F2',
  tableBg: 'F4F7FE',
  tableHeader: '2B3674',
  tableHeaderText: 'FFFFFF',
  coverAccent: '4318FF',
};

// ─────────────────────────────────────────────────────────────────────────────
// Markdown Parser → Paragraph[]
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedInline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

/** Parse inline **bold**, *italic*, `code` markers */
function parseInline(text: string): ParsedInline[] {
  const parts: ParsedInline[] = [];
  // Match **bold**, *italic*, `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ text: text.slice(lastIdx, match.index) });
    }
    if (match[2]) {
      parts.push({ text: match[2], bold: true });
    } else if (match[3]) {
      parts.push({ text: match[3], italic: true });
    } else if (match[4]) {
      parts.push({ text: match[4], code: true });
    }
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    parts.push({ text: text.slice(lastIdx) });
  }

  if (parts.length === 0) {
    parts.push({ text });
  }

  return parts;
}

/** Convert ParsedInline[] to TextRun[] */
function inlineToRuns(inlines: ParsedInline[], baseSize: number = 22): TextRun[] {
  return inlines.map(p => {
    const opts: Record<string, any> = {
      text: p.text,
      size: baseSize,
      font: p.code ? 'Consolas' : 'Calibri',
      color: COLORS.text,
    };
    if (p.bold) opts.bold = true;
    if (p.italic) opts.italics = true;
    if (p.code) {
      opts.shading = { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F0F0' };
      opts.size = 20;
    }
    return new TextRun(opts);
  });
}

/** Parse a full markdown table block into a Table */
function parseTable(lines: string[]): Table | null {
  if (lines.length < 2) return null;

  // Parse header
  const headerCells = lines[0].split('|').map(c => c.trim()).filter(c => c.length > 0);
  // Skip separator line (line 1)
  const dataRows = lines.slice(2).map(row =>
    row.split('|').map(c => c.trim()).filter(c => c.length > 0),
  );

  if (headerCells.length === 0) return null;

  const colWidth = Math.floor(9000 / headerCells.length);

  const header = new TableRow({
    children: headerCells.map(cell =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: cell, bold: true, color: COLORS.tableHeaderText, size: 20, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
        })],
        shading: { fill: COLORS.tableHeader, type: ShadingType.CLEAR, color: 'auto' },
        width: { size: colWidth, type: WidthType.DXA },
      }),
    ),
    tableHeader: true,
  });

  const rows = dataRows.map((row, rowIdx) =>
    new TableRow({
      children: headerCells.map((_, colIdx) =>
        new TableCell({
          children: [new Paragraph({
            children: inlineToRuns(parseInline(row[colIdx] || ''), 20),
            spacing: { before: 40, after: 40 },
          })],
          shading: rowIdx % 2 === 0
            ? { fill: COLORS.tableBg, type: ShadingType.CLEAR, color: 'auto' }
            : undefined,
          width: { size: colWidth, type: WidthType.DXA },
        }),
      ),
    }),
  );

  return new Table({
    rows: [header, ...rows],
    width: { size: 9000, type: WidthType.DXA },
  });
}

/** Main content parser */
function parseContentToParagraphs(content: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Empty line ──
    if (trimmed === '') {
      i++;
      continue;
    }

    // ── Horizontal rule ──
    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push(new Paragraph({
        children: [],
        spacing: { before: 200, after: 200 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
        },
      }));
      i++;
      continue;
    }

    // ── Table ──
    if (trimmed.includes('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const table = parseTable(tableLines);
      if (table) {
        elements.push(new Paragraph({ children: [], spacing: { before: 100 } }));
        elements.push(table);
        elements.push(new Paragraph({ children: [], spacing: { after: 100 } }));
      }
      continue;
    }

    // ── Headings ──
    if (trimmed.startsWith('### ')) {
      const text = trimmed.replace(/^###\s+/, '');
      elements.push(new Paragraph({
        children: [new TextRun({ text, bold: true, size: 26, color: COLORS.heading3, font: 'Calibri' })],
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 240, after: 80 },
      }));
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      const text = trimmed.replace(/^##\s+/, '');
      elements.push(new Paragraph({
        children: [new TextRun({ text, bold: true, size: 30, color: COLORS.heading2, font: 'Calibri' })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 100 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
        },
      }));
      i++;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      const text = trimmed.replace(/^#\s+/, '');
      elements.push(new Paragraph({
        children: [new TextRun({ text, bold: true, size: 36, color: COLORS.heading1, font: 'Calibri' })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 120 },
      }));
      i++;
      continue;
    }

    // ── Numbered list ──
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      elements.push(new Paragraph({
        children: inlineToRuns(parseInline(numberedMatch[2])),
        numbering: { reference: 'numbered-list', level: 0 },
        spacing: { before: 40, after: 40 },
        indent: { left: 360 },
      }));
      i++;
      continue;
    }

    // ── Bullet list ──
    if (/^[-•*]\s+/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-•*]\s+/, '');
      elements.push(new Paragraph({
        children: inlineToRuns(parseInline(bulletText)),
        bullet: { level: 0 },
        spacing: { before: 40, after: 40 },
        indent: { left: 360 },
      }));
      i++;
      continue;
    }

    // ── Sub-bullet (indented) ──
    if (/^\s{2,}[-•*]\s+/.test(line)) {
      const bulletText = line.trim().replace(/^[-•*]\s+/, '');
      elements.push(new Paragraph({
        children: inlineToRuns(parseInline(bulletText)),
        bullet: { level: 1 },
        spacing: { before: 20, after: 20 },
        indent: { left: 720 },
      }));
      i++;
      continue;
    }

    // ── Code block ──
    if (trimmed.startsWith('```')) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```

      elements.push(new Paragraph({
        children: [new TextRun({
          text: codeLines.join('\n'),
          font: 'Consolas',
          size: 18,
          color: '1A1A1A',
        })],
        spacing: { before: 100, after: 100 },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F5F5' },
        indent: { left: 200, right: 200 },
      }));
      continue;
    }

    // ── Regular paragraph ──
    elements.push(new Paragraph({
      children: inlineToRuns(parseInline(trimmed)),
      spacing: { before: 60, after: 80 },
      alignment: AlignmentType.JUSTIFIED,
    }));
    i++;
  }

  return elements;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cover Page
// ─────────────────────────────────────────────────────────────────────────────
function createCoverPage(title: string, subtitle?: string, author?: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Spacing before title
  for (let s = 0; s < 6; s++) {
    paragraphs.push(new Paragraph({ children: [], spacing: { after: 200 } }));
  }

  // Accent line
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: '━'.repeat(40), color: COLORS.coverAccent, size: 14 })],
    alignment: AlignmentType.CENTER,
  }));

  // Title
  paragraphs.push(new Paragraph({
    children: [new TextRun({
      text: title,
      bold: true,
      size: 60,
      color: COLORS.heading1,
      font: 'Calibri',
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 },
  }));

  // Subtitle
  if (subtitle) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({
        text: subtitle,
        size: 28,
        color: COLORS.muted,
        font: 'Calibri',
        italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));
  }

  // Another accent line
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: '━'.repeat(40), color: COLORS.coverAccent, size: 14 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  // Author
  paragraphs.push(new Paragraph({
    children: [new TextRun({
      text: author || 'Generado por SofLIA',
      size: 22,
      color: COLORS.muted,
      font: 'Calibri',
    })],
    alignment: AlignmentType.CENTER,
  }));

  // Date
  paragraphs.push(new Paragraph({
    children: [new TextRun({
      text: new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric',
      }),
      size: 20,
      color: COLORS.muted,
      font: 'Calibri',
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 100 },
  }));

  // Page break after cover
  paragraphs.push(new Paragraph({ children: [], pageBreakBefore: true }));

  return paragraphs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a professional Word document from markdown content.
 */
export async function createProfessionalDocument(
  options: DocumentOptions,
): Promise<string> {
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

  // Cover page
  if (includeCover) {
    children.push(...createCoverPage(title, subtitle, author));
  } else {
    // Just add the title
    children.push(new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 44, color: COLORS.heading1, font: 'Calibri' })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));
  }

  // Parse and add content
  const parsedContent = parseContentToParagraphs(content);
  children.push(...parsedContent);

  // Build document
  const doc = new DocxDocument({
    numbering: {
      config: [{
        reference: 'numbered-list',
        levels: [{
          level: 0,
          format: NumberFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 360, hanging: 260 } } },
        }],
      }],
    },
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
            color: COLORS.text,
          },
          paragraph: {
            spacing: { line: 276 },
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440, bottom: 1440,
            left: 1440, right: 1440,
          },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: title, italics: true, size: 16, color: COLORS.muted, font: 'Calibri' }),
            ],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'SofLIA — ', size: 16, color: COLORS.muted, font: 'Calibri' }),
              new TextRun({
                children: [PageNumber.CURRENT],
                size: 16, color: COLORS.muted, font: 'Calibri',
              }),
              new TextRun({ text: ' / ', size: 16, color: COLORS.muted }),
              new TextRun({
                children: [PageNumber.TOTAL_PAGES],
                size: 16, color: COLORS.muted, font: 'Calibri',
              }),
            ],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children,
    }],
  });

  // Write file
  const buffer = await Packer.toBuffer(doc);

  if (options.type === 'pdf') {
    // For PDF, we generate the DOCX first, and then the caller can convert
    // (using Electron's BrowserWindow approach or similar)
    // For now, save as DOCX — the existing PDF logic in whatsapp-agent can handle conversion
    await fs.writeFile(outputPath, buffer);
  } else {
    await fs.writeFile(outputPath, buffer);
  }

  console.log(`[document-designer] Document saved: ${outputPath}`);
  return outputPath;
}
