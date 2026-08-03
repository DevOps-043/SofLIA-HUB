import type { SlideData } from './types';

function createOpeningSlide(title: string, curTitle: string, bullets: string[]): SlideData {
  return {
    type: 'title',
    title: curTitle || title,
    subtitle: bullets.length > 0 ? bullets.join(' â€¢ ') : undefined,
    imagePrompt: `Professional abstract visual representing: ${curTitle || title}`,
  };
}

function createContentSlide(curTitle: string, bullets: string[], index: number): SlideData {
  const types = ['content', 'content', 'image-focus', 'content', 'infographic', 'content'];
  return {
    type: types[index % types.length],
    title: curTitle,
    bullets: bullets.length > 0 ? bullets : undefined,
    imagePrompt: `Professional visual about: ${curTitle}`,
  };
}

export function parseMarkdownToSlides(content: string, title: string): SlideData[] {
  const slides: SlideData[] = [];
  let curTitle = '';
  let curBullets: string[] = [];
  let isFirst = true;

  const flush = () => {
    if (!curTitle && curBullets.length === 0) return;
    slides.push(
      isFirst
        ? createOpeningSlide(title, curTitle, curBullets)
        : createContentSlide(curTitle, curBullets, slides.length),
    );
    isFirst = false;
    curTitle = '';
    curBullets = [];
  };

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      flush();
      curTitle = trimmed.replace(/^#{1,3}\s*/, '');
    } else if (trimmed !== '') {
      curBullets.push(trimmed.replace(/^[-â€¢*]\s*/, ''));
    }
  }
  flush();

  if (slides.length > 0) {
    slides.push({
      type: 'closing',
      title: 'Â¡Gracias!',
      subtitle: 'PresentaciÃ³n generada por Pulse',
      imagePrompt: 'Professional thank you slide background, abstract gradient',
    });
  }
  return slides;
}
