import type { SlideData } from './types';

export function parseMarkdownToSlides(content: string, title: string): SlideData[] {
  const slides: SlideData[] = [];
  const lines = content.split('\n');
  let currentTitle = '';
  let currentBullets: string[] = [];
  let isFirst = true;

  const flush = () => {
    if (!currentTitle && currentBullets.length === 0) return;
    if (isFirst) {
      slides.push({
        type: 'title',
        title: currentTitle || title,
        subtitle: currentBullets.length > 0 ? currentBullets.join(' • ') : undefined,
        imagePrompt: `Professional abstract visual representing: ${currentTitle || title}`,
      });
      isFirst = false;
    } else {
      const types = ['content', 'content', 'image-focus', 'content'];
      slides.push({
        type: types[slides.length % 4],
        title: currentTitle,
        bullets: currentBullets.length > 0 ? currentBullets : undefined,
        imagePrompt: `Professional visual about: ${currentTitle}`,
      });
    }
    currentTitle = '';
    currentBullets = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      flush();
      currentTitle = trimmed.replace(/^#{1,3}\s*/, '');
    } else if (trimmed !== '') {
      currentBullets.push(trimmed.replace(/^[-•*]\s*/, ''));
    }
  }
  flush();

  if (slides.length > 0) {
    slides.push({
      type: 'closing',
      title: 'Gracias',
      subtitle: 'Presentacion generada por SofLIA',
      imagePrompt: 'Professional thank you slide background, abstract gradient',
    });
  }
  return slides;
}
