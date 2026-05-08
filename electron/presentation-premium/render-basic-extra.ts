import type { ResolvedTheme, SlideData } from './types';
import { esc, h, slideWrapper } from './html';

export function renderSectionBreak(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const bgStyle = img ? `url('${img}') center/cover no-repeat` : h(c.accent);
  const scrim = img ? '<div class="scrim" style="background:rgba(0,0,0,.5)"></div>' : '';
  const textColor = img ? h(c.heading) : h(c.bg);
  return slideWrapper(`${scrim}
    <div class="z-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%">
      <h1 class="slide-title" style="font-size:60px;text-align:center;color:${textColor};text-shadow:0 2px 20px rgba(0,0,0,.4)">${esc(slide.title)}</h1>
      ${slide.subtitle ? `<p style="font-size:24px;color:${img ? h(c.textMuted) : h(c.bg)};text-align:center;margin-top:20px;opacity:.85">${esc(slide.subtitle)}</p>` : ''}
    </div>`, idx, total, slide, bgStyle, { noBar: true, noBrand: true });
}

export function renderComparison(slide: SlideData, th: ResolvedTheme, idx: number, total: number): string {
  const c = th.colors;
  const left = slide.leftColumn || { heading: '', items: [] };
  const right = slide.rightColumn || { heading: '', items: [] };
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:32px">${esc(slide.title)}</h2>
      <div style="display:flex;gap:28px;flex:1;position:relative;align-items:stretch">
        <div class="card" style="flex:1;display:flex;flex-direction:column">${left.heading ? `<h3 style="font-family:var(--font-heading);font-size:22px;color:var(--accent);text-align:center;font-weight:700;margin-bottom:20px">${esc(left.heading)}</h3>` : ''}<ul class="bullet-list">${left.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
        <div style="display:flex;align-items:center;justify-content:center;z-index:5"><div class="vs-badge">VS</div></div>
        <div class="card" style="flex:1;display:flex;flex-direction:column">${right.heading ? `<h3 style="font-family:var(--font-heading);font-size:22px;color:var(--accent-alt);text-align:center;font-weight:700;margin-bottom:20px">${esc(right.heading)}</h3>` : ''}<ul class="bullet-list">${right.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
      </div>
    </div>`, idx, total, slide, h(c.bg));
}

export function renderClosing(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const bgStyle = img ? `url('${img}') center/cover no-repeat` : `linear-gradient(135deg, ${h(c.bg)}, ${h(c.bgAlt)})`;
  const scrim = img ? '<div class="scrim" style="background:linear-gradient(180deg,rgba(0,0,0,.4),rgba(0,0,0,.7))"></div>' : '';
  return slideWrapper(`${scrim}
    <div class="accent-bar-bottom"></div>
    <div class="z-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%">
      <h1 class="slide-title" style="font-size:60px;text-align:center;text-shadow:0 2px 20px rgba(0,0,0,.3)">${esc(slide.title || 'Â¡Gracias!')}</h1>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:24px;text-align:center;margin-top:24px">${esc(slide.subtitle)}</p>` : ''}
      <div style="width:160px;height:4px;background:var(--accent);margin-top:40px;border-radius:2px"></div>
    </div>`, idx, total, slide, bgStyle, { noBrand: true });
}
