import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import type { DirectoryAnalysis } from './types';

export async function analyzeDirectoryContents(
  dirPath: string,
  extToCategory: Record<string, string>,
): Promise<DirectoryAnalysis> {
  const analysis: DirectoryAnalysis = { totalFiles: 0, categories: {}, totalSize: 0 };

  try {
    const dirStat = await fsPromises.stat(dirPath);
    if (!dirStat.isDirectory()) {
      throw new Error(`Path ${dirPath} is not a directory`);
    }

    const files = await fsPromises.readdir(dirPath);
    for (const file of files) {
      await addFileToAnalysis(dirPath, file, extToCategory, analysis);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Analysis failed for ${dirPath}: ${message}`);
  }

  return analysis;
}

async function addFileToAnalysis(
  dirPath: string,
  file: string,
  extToCategory: Record<string, string>,
  analysis: DirectoryAnalysis,
): Promise<void> {
  const filePath = path.join(dirPath, file);
  try {
    const stats = await fsPromises.stat(filePath);
    if (!stats.isFile()) return;

    analysis.totalFiles++;
    analysis.totalSize += stats.size;
    const ext = path.extname(file).toLowerCase();
    const category = ext ? (extToCategory[ext] || 'Others') : 'No_Extension';
    analysis.categories[category] = (analysis.categories[category] || 0) + 1;
  } catch (error) {
    console.warn(`[NeuralOrganizer] Cannot stat file for analysis: ${filePath}`, error);
  }
}
