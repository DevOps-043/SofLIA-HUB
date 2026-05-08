import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function moveToCategory(
  filename: string,
  filePath: string,
  category: string,
): Promise<string> {
  const categoryPath = path.join(os.homedir(), 'Documents', category);
  await fs.promises.mkdir(categoryPath, { recursive: true, mode: 0o700 });

  const ext = path.extname(filename).toLowerCase();
  let newFileName = filename;
  let destPath = path.join(categoryPath, newFileName);
  if (fs.existsSync(destPath)) {
    const nameWithoutExt = path.basename(filename, ext);
    newFileName = `${nameWithoutExt}_${Date.now()}${ext}`;
    destPath = path.join(categoryPath, newFileName);
  }

  await fs.promises.rename(filePath, destPath);
  console.log(`[NeuralOrganizer] Moved ${filename} to ${destPath}`);
  return newFileName;
}
