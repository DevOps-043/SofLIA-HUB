import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import { resolveTheme } from './theme';
import type { CreatePresentationPDFOptions } from './types';
import { buildHTML } from './html';
import { generateSlideImage } from './image-generation';
import { renderSlide } from './render-slide';

async function buildImageCache(options: CreatePresentationPDFOptions): Promise<Map<number, string | null>> {
  const { slides, includeImages = true, genAI } = options;
  const imageCache = new Map<number, string | null>();
  if (!includeImages || !genAI) {
    return imageCache;
  }

  const batchSize = 3;
  for (let i = 0; i < slides.length; i += batchSize) {
    const batch = slides.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((slide) => {
        const prompt = slide.diagramPrompt || slide.imagePrompt;
        return prompt ? generateSlideImage(genAI, prompt, Boolean(slide.diagramPrompt)) : Promise.resolve(null);
      }),
    );
    results.forEach((result, idx) => {
      imageCache.set(i + idx, result.status === 'fulfilled' ? result.value : null);
    });
  }

  const generatedCount = Array.from(imageCache.values()).filter(Boolean).length;
  console.log(`[presentation-premium] ImÃ¡genes: ${generatedCount}/${slides.length} generadas`);
  return imageCache;
}

async function printHtmlToPdf(fullHTML: string, outputPath: string): Promise<void> {
  const win = new BrowserWindow({
    show: false,
    width: 1920,
    height: 1080,
    webPreferences: { offscreen: true },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      win.webContents.on('did-finish-load', async () => {
        try {
          try {
            await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true);
          } catch {
            // Font readiness is best-effort in offscreen rendering.
          }
          await new Promise((fontResolve) => setTimeout(fontResolve, 800));
          const pdfData = await win.webContents.printToPDF({
            printBackground: true,
            landscape: true,
            pageSize: { width: 508000, height: 285750 },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          });
          await fs.writeFile(outputPath, pdfData);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHTML)}`);
    });
  } finally {
    win.destroy();
  }
}

export async function createPresentationPDF(options: CreatePresentationPDFOptions): Promise<string> {
  const { slides, outputPath, themeName, customTheme, includeImages = true } = options;
  const theme = resolveTheme(themeName, customTheme);
  console.log(`[presentation-premium] Generando ${slides.length} slides, imÃ¡genes=${includeImages}`);

  const imageCache = await buildImageCache(options);
  const slideHTMLs = slides.map((slide, i) => renderSlide(slide, theme, i, slides.length, imageCache.get(i) || null));
  await printHtmlToPdf(buildHTML(slideHTMLs, theme), outputPath);

  console.log(`[presentation-premium] PDF guardado: ${outputPath} (${slides.length} slides)`);
  return outputPath;
}
