const formats: Record<string, { family: string; label: string; mark: string }> = {
  docx: { family: 'word', label: 'Word', mark: 'W' }, doc: { family: 'word', label: 'Word', mark: 'W' },
  md: { family: 'markdown', label: 'Markdown', mark: 'M↓' },
  pdf: { family: 'pdf', label: 'PDF', mark: 'PDF' },
  xlsx: { family: 'sheet', label: 'Excel', mark: 'X' }, xls: { family: 'sheet', label: 'Excel', mark: 'X' },
  csv: { family: 'sheet', label: 'CSV', mark: 'CSV' },
  pptx: { family: 'slides', label: 'PowerPoint', mark: 'P' },
  html: { family: 'code', label: 'Aplicación HTML', mark: '</>' }, htm: { family: 'code', label: 'Aplicación HTML', mark: '</>' },
  json: { family: 'code', label: 'JSON', mark: '{}' },
};
export function artifactFormat(extension: string) {
  const ext = extension.toLowerCase().replace(/^\./, '');
  return formats[ext] ?? (/^(png|jpe?g|webp|gif)$/.test(ext)
    ? { family: 'image', label: 'Imagen', mark: 'IMG' }
    : { family: 'text', label: ext.toUpperCase() || 'Archivo', mark: 'TXT' });
}
