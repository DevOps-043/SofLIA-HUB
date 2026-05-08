import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import type { OrganizeSummary } from './types';

export async function organizeDirectoryContents(
  dirPath: string,
  extToCategory: Record<string, string>,
): Promise<OrganizeSummary> {
  const summary = createSummary(dirPath);
  try {
    const dirStat = await fsPromises.stat(dirPath);
    if (!dirStat.isDirectory()) {
      throw new Error(`Path ${dirPath} is not a valid directory`);
    }

    const files = await fsPromises.readdir(dirPath);
    for (const file of files) {
      await organizeFile(dirPath, file, extToCategory, summary);
    }
  } catch (error) {
    const errorMsg = `Failed to read directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[NeuralOrganizer] ${errorMsg}`);
    summary.errors.push(errorMsg);
  }

  summary.endTime = new Date();
  return summary;
}

function createSummary(directory: string): OrganizeSummary {
  return { directory, totalProcessed: 0, moved: {}, errors: [], startTime: new Date(), endTime: new Date() };
}

async function organizeFile(
  dirPath: string,
  file: string,
  extToCategory: Record<string, string>,
  summary: OrganizeSummary,
): Promise<void> {
  const filePath = path.join(dirPath, file);
  try {
    const stats = await fsPromises.stat(filePath);
    if (!stats.isFile() || file.toLowerCase() === 'desktop.ini' || file.startsWith('.')) return;

    const ext = path.extname(file).toLowerCase();
    const category = ext ? (extToCategory[ext] || 'Others') : 'Others';
    const newFilePath = await resolveDestination(dirPath, category, file, ext);
    await fsPromises.rename(filePath, newFilePath);
    summary.totalProcessed++;
    summary.moved[category] = (summary.moved[category] || 0) + 1;
  } catch (fileError) {
    const errorMsg = `Failed to process ${file}: ${fileError instanceof Error ? fileError.message : String(fileError)}`;
    console.error(`[NeuralOrganizer] ${errorMsg}`);
    summary.errors.push(errorMsg);
  }
}

async function resolveDestination(
  dirPath: string,
  category: string,
  file: string,
  ext: string,
): Promise<string> {
  const categoryPath = path.join(dirPath, category);
  await fsPromises.mkdir(categoryPath, { recursive: true });
  let newFilePath = path.join(categoryPath, file);
  try {
    await fsPromises.access(newFilePath);
    const nameWithoutExt = path.basename(file, ext);
    newFilePath = path.join(categoryPath, `${nameWithoutExt}_${Date.now()}${ext}`);
  } catch {
    // Destination is available.
  }
  return newFilePath;
}
