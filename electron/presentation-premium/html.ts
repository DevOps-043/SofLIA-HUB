import type { ResolvedTheme, SlideData } from './types';
import { buildCSS } from './css';

export function h(hex: string): string {
  return `#${hex}`;
}

export function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function slideWrapper(
  inner: string,
  idx: number,
  total: number,
  slide: SlideData,
  bg: string,
  opts?: { noBar?: boolean; noBrand?: boolean },
): string {
  const pageBreak = idx > 0 ? 'page-break-before:always;' : '';
  const bar = opts?.noBar ? '' : '<div class="accent-bar-top"></div>';
  const shouldBrand = !opts?.noBrand && slide.type !== 'title' && slide.type !== 'closing';
  const brand = shouldBrand ? '<div class="branding">SofLIA</div>' : '';
  return `<div class="slide" style="${pageBreak}background:${bg};">${bar}${inner}<div class="slide-number">${idx + 1} / ${total}</div>${brand}</div>`;
}

export function buildHTML(slideHTMLs: string[], theme: ResolvedTheme): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>${buildCSS(theme)}</style>
</head>
<body>${slideHTMLs.join('')}</body>
</html>`;
}
