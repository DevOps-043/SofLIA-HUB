import type { ResolvedTheme, SlideData } from './types';
import { esc, h } from './html-utils';

export function renderSlide(slide: SlideData, theme: ResolvedTheme, index: number, total: number, image: string | null): string {
  const pageBreak = index > 0 ? 'page-break-before:always;' : '';
  const background = image
    ? `url('${image}') center/cover no-repeat`
    : `linear-gradient(135deg,${h(theme.colors.bg)},${h(theme.colors.bgAlt)})`;
  const body = renderSlideBody(slide, theme, Boolean(image));
  const brand = slide.type !== 'title' && slide.type !== 'closing' ? '<div class="br">SofLIA</div>' : '';

  return `<div class="slide" style="${pageBreak}background:${background};position:relative;">
    ${image ? '<div class="scrim"></div>' : ''}
    <div class="ab" style="background:${h(theme.colors.accent)}"></div>
    ${body}
    <div class="sn">${index + 1}/${total}</div>${brand}
  </div>`;
}

function renderSlideBody(slide: SlideData, theme: ResolvedTheme, hasImage: boolean): string {
  if (slide.type === 'title' || slide.type === 'closing' || slide.type === 'section-break' || slide.type === 'image-focus') {
    return heroBody(slide, theme, hasImage);
  }
  if (slide.type === 'two-column' || slide.type === 'comparison') return twoColumnBody(slide, theme);
  if (slide.type === 'quote') return quoteBody(slide, theme);
  return contentBody(slide, theme);
}

function heroBody(slide: SlideData, theme: ResolvedTheme, hasImage: boolean): string {
  return `<div class="center" style="${hasImage ? 'position:relative;z-index:2;' : ''}">
    <h1 style="font-family:'${theme.fontHeading}';color:${h(theme.colors.heading)}">${esc(slide.title || 'Gracias')}</h1>
    ${slide.subtitle ? `<p style="font-family:'${theme.fontBody}';color:${h(theme.colors.textMuted)}">${esc(slide.subtitle)}</p>` : ''}
  </div>`;
}

function contentBody(slide: SlideData, theme: ResolvedTheme): string {
  const bullets = renderBullets(slide.bullets || [], theme.colors.accent, theme);
  return `<div class="content">
    <h2 style="font-family:'${theme.fontHeading}';color:${h(theme.colors.accent)}">${esc(slide.title)}</h2>
    <div class="rule" style="background:${h(theme.colors.accent)}"></div>
    ${bullets}
  </div>`;
}

function twoColumnBody(slide: SlideData, theme: ResolvedTheme): string {
  return `<div class="content">
    <h2 style="font-family:'${theme.fontHeading}';color:${h(theme.colors.accent)}">${esc(slide.title)}</h2>
    <div class="columns">
      ${renderColumn(slide.leftColumn, theme.colors.accent, theme)}
      ${renderColumn(slide.rightColumn, theme.colors.accentAlt, theme)}
    </div>
  </div>`;
}

function quoteBody(slide: SlideData, theme: ResolvedTheme): string {
  const quote = slide.quote?.text || slide.bullets?.[0] || slide.title;
  const author = slide.quote?.author || slide.subtitle || '';
  return `<div class="center quote">
    <p style="font-family:Georgia;color:${h(theme.colors.text)}">"${esc(quote)}"</p>
    ${author ? `<span style="color:${h(theme.colors.textMuted)}">- ${esc(author)}</span>` : ''}
  </div>`;
}

function renderColumn(column: SlideData['leftColumn'], accent: string, theme: ResolvedTheme): string {
  if (!column) return '<div class="panel"></div>';
  return `<div class="panel">
    <h3 style="font-family:'${theme.fontHeading}';color:${h(theme.colors.heading)}">${esc(column.heading)}</h3>
    ${renderBullets(column.items, accent, theme)}
  </div>`;
}

function renderBullets(items: string[], accent: string, theme: ResolvedTheme): string {
  if (items.length === 0) return '';
  return `<ul>${items.map((item) =>
    `<li style="font-family:'${theme.fontBody}';color:${h(theme.colors.text)}"><span style="color:${h(accent)}">•</span>${esc(item.replace(/^[-•*]\s*/, ''))}</li>`,
  ).join('')}</ul>`;
}
