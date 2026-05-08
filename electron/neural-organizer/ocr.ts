import path from 'node:path';

export async function extractImageTextIfNeeded(
  tesseract: any,
  filename: string,
  filePath: string,
): Promise<string> {
  const ext = path.extname(filename).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return '';

  try {
    console.log(`[NeuralOrganizer] Extracting text from image: ${filename}`);
    const { data: { text } } = await tesseract.recognize(filePath, 'spa');
    return text.trim();
  } catch (ocrErr: any) {
    console.error(`[NeuralOrganizer] OCR Error for ${filename}:`, ocrErr.message);
    return '';
  }
}
