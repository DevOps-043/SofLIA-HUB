import { esc, h } from './html-utils';
import type { ResolvedTheme, SlideData } from './types';

function bullets(items: string[] | undefined, color: string, font: string): string {
  if (!items?.length) return '';
  return `<ul style="list-style:none;padding:0;margin:0">${items.map(item =>
    `<li style="font-family:'${font}';font-size:17px;color:${color};margin-bottom:14px;padding-left:20px;position:relative;line-height:1.5"><span style="position:absolute;left:0">•</span>${esc(item.replace(/^[-•*]\s*/, ''))}</li>`,
  ).join('')}</ul>`;
}

function column(heading: string | undefined, items: string[] | undefined, theme: ResolvedTheme, accent: string): string {
  return `<div style="flex:1;padding:22px;background:${h(theme.colors.bgAlt)};border-radius:12px">
    ${heading ? `<h3 style="font-family:'${theme.fontHeading}';font-size:20px;color:${accent};margin:0 0 16px">${esc(heading)}</h3>` : ''}
    ${bullets(items, h(theme.colors.text), theme.fontBody)}
  </div>`;
}

export function renderSlide(slide: SlideData, theme: ResolvedTheme, index: number, total: number, image: string | null): string {
  const colors = theme.colors;
  const pageBreak = index > 0 ? 'page-break-before:always;' : '';
  const imageBg = image ? `url('${image}') center/cover no-repeat` : `linear-gradient(135deg,${h(colors.bg)},${h(colors.bgAlt)})`;
  const scrim = image ? '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.3),rgba(0,0,0,.7));z-index:1"></div>' : '';
  const brand = slide.type !== 'title' && slide.type !== 'closing' ? '<div class="br">Pulse</div>' : '';
  const titleStyle = `font-family:'${theme.fontHeading}';color:${h(colors.heading)};font-weight:700;text-shadow:0 2px 20px rgba(0,0,0,.3)`;
  const shell = (inner: string, background = h(colors.bg)) =>
    `<div class="slide" style="${pageBreak}background:${background};">${inner}<div class="sn">${index + 1}/${total}</div>${brand}</div>`;

  if (slide.type === 'title' || slide.type === 'closing' || slide.type === 'section-break') {
    return shell(`${scrim}<div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px;text-align:center">
      <div style="width:180px;height:3px;background:${h(colors.accent)};margin-bottom:24px"></div>
      <h1 style="${titleStyle};font-size:52px;margin:0;line-height:1.15">${esc(slide.title || 'Gracias')}</h1>
      ${slide.subtitle ? `<p style="font-family:'${theme.fontBody}';font-size:20px;color:${h(colors.textMuted)};margin-top:20px">${esc(slide.subtitle)}</p>` : ''}
    </div>`, imageBg);
  }

  if (slide.type === 'quote') {
    const quote = slide.quote?.text || slide.bullets?.[0] || slide.title;
    const author = slide.quote?.author || slide.subtitle || '';
    return shell(`<div class="accent" style="background:${h(colors.accent)}"></div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px">
      <span style="font-size:100px;color:${h(colors.accent)};opacity:.3;font-family:Georgia;line-height:.8">"</span>
      <p style="font-family:Georgia;font-size:26px;color:${h(colors.text)};text-align:center;font-style:italic;line-height:1.6;max-width:800px;margin:0">${esc(quote)}</p>
      ${author ? `<p style="font-family:'${theme.fontBody}';font-size:16px;color:${h(colors.textMuted)};margin-top:20px">- ${esc(author)}</p>` : ''}
    </div>`, h(colors.bgAlt));
  }

  const hasColumns = slide.type === 'two-column' || slide.type === 'comparison';
  return shell(`<div class="accent" style="background:${h(colors.accent)}"></div><div style="padding:50px;height:100%;display:flex;flex-direction:column;gap:24px">
    <h2 style="font-family:'${theme.fontHeading}';font-size:32px;color:${h(colors.accent)};margin:0">${esc(slide.title)}</h2>
    ${hasColumns ? `<div style="display:flex;gap:28px;flex:1">${column(slide.leftColumn?.heading, slide.leftColumn?.items, theme, h(colors.accent))}${column(slide.rightColumn?.heading, slide.rightColumn?.items, theme, h(colors.accentAlt))}</div>` : ''}
    ${!hasColumns ? `<div style="display:flex;gap:30px;flex:1"><div style="flex:1">${bullets(slide.bullets, h(colors.text), theme.fontBody)}</div>${image ? `<img src="${image}" style="width:42%;border-radius:12px;object-fit:cover;box-shadow:0 8px 32px rgba(0,0,0,.3)"/>` : ''}</div>` : ''}
  </div>`);
}
