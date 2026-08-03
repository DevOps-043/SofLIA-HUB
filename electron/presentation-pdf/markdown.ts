import type { SlideData } from './types';

export function parseMarkdownToSlides(content: string, title: string): SlideData[] {
  const slides: SlideData[] = [];
  const lines = content.split('\n');
  let curTitle = '';
  let curBullets: string[] = [];
  let isFirst = true;

  const flush = () => {
    if (!curTitle && curBullets.length === 0) return;
    if (isFirst) {
      slides.push({
        type: 'title',
        title: curTitle || title,
        subtitle: curBullets.length > 0 ? curBullets.join(' • ') : undefined,
        imagePrompt: `Professional abstract visual representing: ${curTitle || title}`,
      });
      isFirst = false;
    } else {
      const types = ['content', 'content', 'image-focus', 'content'];
      slides.push({
        type: types[slides.length % 4],
        title: curTitle,
        bullets: curBullets.length > 0 ? curBullets : undefined,
        imagePrompt: `Professional visual about: ${curTitle}`,
      });
    }
    curTitle = '';
    curBullets = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      flush();
      curTitle = trimmed.replace(/^#{1,3}\s*/, '');
    } else if (trimmed !== '') {
      curBullets.push(trimmed.replace(/^[-•*]\s*/, ''));
    }
  }
  flush();

  if (slides.length > 0) {
    slides.push({ type: 'closing', title: 'Gracias', subtitle: 'Presentacion generada por Pulse', imagePrompt: 'Professional thank you slide background' });
  }
  return slides;
}
