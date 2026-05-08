import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const { createWorker } = _require('tesseract.js');

export async function findTextCoordinates(
  textToFind: string,
  imageBuffer: Buffer,
): Promise<{ x: number; y: number; confidence: number }> {
  let worker;
  try {
    worker = await createWorker('spa');
  } catch {
    worker = await createWorker('eng');
  }

  const ret = await worker.recognize(imageBuffer);
  await worker.terminate();
  const lowerText = textToFind.toLowerCase();

  for (const word of ret.data.words) {
    if (word.text.toLowerCase().includes(lowerText) && word.confidence > 50) {
      return {
        x: Math.round(word.bbox.x0 + (word.bbox.x1 - word.bbox.x0) / 2),
        y: Math.round(word.bbox.y0 + (word.bbox.y1 - word.bbox.y0) / 2),
        confidence: word.confidence,
      };
    }
  }

  for (const line of ret.data.lines) {
    if (line.text.toLowerCase().includes(lowerText) && line.confidence > 40) {
      return {
        x: Math.round(line.bbox.x0 + (line.bbox.x1 - line.bbox.x0) / 2),
        y: Math.round(line.bbox.y0 + (line.bbox.y1 - line.bbox.y0) / 2),
        confidence: line.confidence,
      };
    }
  }

  throw new Error(`Elemento con texto "${textToFind}" no encontrado en pantalla (OCR no lo detecto).`);
}
