import fs from 'fs';

const PDF_TEXT_LIMIT = 2000;

export class WhatsAppFileConverter {
  static async convertTextToPDF(inputPath: string): Promise<Buffer> {
    let textContent = '';
    try {
      textContent = fs.readFileSync(inputPath, 'utf8');
    } catch {
      textContent = 'No se pudo leer el contenido del archivo de texto.';
    }

    const cleanText = textContent
      .replace(/[()\\]/g, '\\$&')
      .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
      .substring(0, PDF_TEXT_LIMIT);

    const pdfContent = `%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /Resources <</Font <</F1 4 0 R>>>> /MediaBox [0 0 612 792] /Contents 5 0 R>> endobj\n4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n5 0 obj\n<</Length ${44 + cleanText.length}>>\nstream\nBT\n/F1 12 Tf\n10 700 Td\n(${cleanText}) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000212 00000 n \n0000000274 00000 n \ntrailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${274 + 44 + cleanText.length}\n%%EOF`;
    return Buffer.from(pdfContent, 'utf8');
  }

  static async summarizeText(inputPath: string): Promise<string> {
    try {
      const textContent = fs.readFileSync(inputPath, 'utf8');
      const lines = textContent.split('\n').filter((line: string) => line.trim().length > 0);
      if (lines.length === 0) return 'El documento esta vacio o no contiene texto legible.';

      const wordCount = textContent.split(/\s+/).filter((word: string) => word.length > 0).length;
      return `*Resumen Rapido:*\n\n` +
        `- *Lineas con contenido:* ${lines.length}\n` +
        `- *Total de Palabras:* ${wordCount}\n` +
        `- *Total de Caracteres:* ${textContent.length}\n\n` +
        `*Muestra del contenido:*\n_"${lines[0].substring(0, 150)}${lines[0].length > 150 ? '...' : ''}"_`;
    } catch {
      return 'No se pudo analizar el documento. Verifica que sea un archivo de texto valido.';
    }
  }
}
