import type { ResolvedTheme, SlideData } from './types';
import { esc, h, slideWrapper } from './html';

export function renderTitle(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const bgStyle = img ? `url('${img}') center/cover no-repeat` : `linear-gradient(135deg, ${h(c.bg)}, ${h(c.bgAlt)})`;
  const scrim = img ? '<div class="scrim" style="background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.65))"></div>' : '';
  return slideWrapper(`${scrim}
    <div class="z-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px">
      <div style="width:280px;height:4px;background:var(--accent);margin-bottom:36px;border-radius:2px"></div>
      <h1 class="slide-title" style="font-size:64px;text-align:center;text-shadow:0 3px 24px rgba(0,0,0,.3);max-width:1400px">${esc(slide.title)}</h1>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:28px;text-align:center;margin-top:28px;max-width:1100px">${esc(slide.subtitle)}</p>` : ''}
      <div style="width:280px;height:4px;background:var(--accent);margin-top:40px;border-radius:2px"></div>
    </div><div class="accent-bar-bottom"></div>`, idx, total, slide, bgStyle, { noBar: !img });
}

export function renderContent(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  return slideWrapper(`
    <div class="accent-bar-left"></div>
    <div style="display:flex;height:100%;gap:40px;padding:70px 60px 50px">
      <div style="flex:${img ? '0.6' : '1'};display:flex;flex-direction:column">
        <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
        <div style="width:100px;height:4px;background:var(--accent);margin-bottom:32px;border-radius:2px"></div>
        ${slide.bullets ? `<ul class="bullet-list">${slide.bullets.map((b) => `<li>${esc(b.replace(/^[-â€¢*]\s*/, ''))}</li>`).join('')}</ul>` : ''}
      </div>
      ${img ? `<div style="flex:0.4;display:flex;align-items:center;justify-content:center"><img src="${img}" style="max-width:100%;max-height:92%;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.3);object-fit:cover"/></div>` : ''}
    </div>`, idx, total, slide, h(c.bg));
}

export function renderTwoColumn(slide: SlideData, th: ResolvedTheme, idx: number, total: number): string {
  const c = th.colors;
  const left = slide.leftColumn || { heading: '', items: [] };
  const right = slide.rightColumn || { heading: '', items: [] };
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100%;height:3px;background:linear-gradient(90deg,${h(c.accent)}60,transparent);margin-bottom:32px"></div>
      <div style="display:flex;gap:36px;flex:1">
        <div class="card card-accent" style="flex:1;border-left-color:var(--accent)">${left.heading ? `<h3 style="font-family:var(--font-heading);font-size:24px;color:var(--heading);font-weight:700;margin-bottom:20px">${esc(left.heading)}</h3>` : ''}<ul class="bullet-list">${left.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
        <div style="width:3px;background:linear-gradient(180deg,${h(c.accent)}50,transparent);border-radius:2px"></div>
        <div class="card card-accent" style="flex:1;border-left-color:var(--accent-alt)">${right.heading ? `<h3 style="font-family:var(--font-heading);font-size:24px;color:var(--heading);font-weight:700;margin-bottom:20px">${esc(right.heading)}</h3>` : ''}<ul class="bullet-list">${right.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
      </div>
    </div>`, idx, total, slide, h(c.bg));
}

export function renderImageFocus(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const bgStyle = img ? `url('${img}') center/cover no-repeat` : h(c.bgAlt);
  return slideWrapper(`
    <div class="scrim-bottom" style="background:linear-gradient(0deg,rgba(0,0,0,.75),transparent)"></div>
    <div class="z-content" style="position:absolute;bottom:60px;left:70px;right:70px">
      <h2 class="slide-title" style="font-size:44px;text-shadow:0 2px 16px rgba(0,0,0,.5)">${esc(slide.title)}</h2>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:22px;margin-top:12px">${esc(slide.subtitle)}</p>` : ''}
    </div><div class="accent-bar-bottom"></div>`, idx, total, slide, bgStyle, { noBar: true });
}

export function renderQuote(slide: SlideData, th: ResolvedTheme, idx: number, total: number): string {
  const c = th.colors;
  const text = slide.quote?.text || slide.bullets?.[0] || slide.title;
  const author = slide.quote?.author || slide.subtitle || '';
  return slideWrapper(`
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:80px">
      <span style="font-size:140px;color:var(--accent);opacity:.25;font-family:Georgia;line-height:.7;margin-bottom:16px">&ldquo;</span>
      <p style="font-family:Georgia;font-size:34px;color:var(--text);text-align:center;font-style:italic;line-height:1.6;max-width:1200px">${esc(text)}</p>
      ${author ? `<div style="width:100px;height:3px;background:var(--accent);margin:32px 0 20px;border-radius:2px"></div><p style="font-size:20px;color:var(--text-muted);text-align:center">&mdash; ${esc(author)}</p>` : ''}
    </div>`, idx, total, slide, h(c.bgAlt));
}
