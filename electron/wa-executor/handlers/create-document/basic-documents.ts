import fs from 'node:fs/promises';
import path from 'node:path';
import type { DocumentBaseArgs } from './types';

export async function createWordDocument(args: DocumentBaseArgs): Promise<string> {
  const { createProfessionalDocument } = await import('../../../document-designer');
  const filePath = path.join(args.saveDir, `${args.filename}.docx`);
  await createProfessionalDocument({
    content: args.content,
    title: args.title,
    author: 'SofLIA',
    outputPath: filePath,
    type: 'word',
    includeCover: true,
  });
  return filePath;
}

export async function createMarkdownDocument(args: DocumentBaseArgs): Promise<string> {
  const filePath = path.join(args.saveDir, `${args.filename}.md`);
  await fs.writeFile(filePath, `# ${args.title}\n\n${args.content}`, 'utf-8');
  return filePath;
}
