import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import { buildHTML } from './html-utils';
import { generateSlideImage } from './image-generation';
import { renderSlide } from './render-slide';
import { mergeTheme } from './theme';
import type { CreatePresentationPDFOptions } from './types';

async function generateSlideImages(options: CreatePresentationPDFOptions) {
  const imageCache = new Map<number, string | null>();
  if (!options.includeImages || !options.genAI) return imageCache;

  const batchSize = 3;
  for (let i = 0; i < options.slides.length; i += batchSize) {
    const batch = options.slides.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(slide => slide.imagePrompt ? generateSlideImage(options.genAI!, slide.imagePrompt) : Promise.resolve(null)),
    );
    results.forEach((result, index) => imageCache.set(i + index, result.status === 'fulfilled' ? result.value : null));
  }
  return imageCache;
}

export async function createPresentationPDF(options: CreatePresentationPDFOptions): Promise<string> {
  const { slides, outputPath, customTheme, includeImages = true } = options;
  const theme = mergeTheme(customTheme);
  console.log(`[presentation-pdf] Building ${slides.length} slides, images=${includeImages}`);

  const imageCache = await generateSlideImages({ ...options, includeImages });
  const slideHTMLs = slides.map((slide, index) => renderSlide(slide, theme, index, slides.length, imageCache.get(index) || null));
  const win = new BrowserWindow({ show: false, width: 1280, height: 720, webPreferences: { offscreen: true } });

  try {
    await new Promise<void>((resolve, reject) => {
      win.webContents.on('did-finish-load', async () => {
        try {
          await new Promise(done => setTimeout(done, 1500));
          const pdfData = await win.webContents.printToPDF({
            printBackground: true,
            landscape: true,
            pageSize: { width: 338667, height: 190500 },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          });
          await fs.writeFile(outputPath, pdfData);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildHTML(slideHTMLs, theme))}`);
    });
  } finally {
    win.destroy();
  }

  console.log(`[presentation-pdf] Saved: ${outputPath} (${slides.length} slides)`);
  return outputPath;
}
