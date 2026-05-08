import type { ResolvedTheme, SlideData } from './types';
import { esc, h, slideWrapper } from './html';

export function renderTimeline(slide: SlideData, th: ResolvedTheme, idx: number, total: number): string {
  const c = th.colors;
  const steps = slide.steps || [];
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:16px">${esc(slide.subtitle)}</p>` : ''}
      <div style="flex:1;display:flex;align-items:center;position:relative">
        <div class="timeline-container" style="width:100%"><div class="timeline-line"></div>
          ${steps.map((step, i) => `<div class="timeline-item"><div class="timeline-dot" style="${i % 2 !== 0 ? `background:${h(c.accentAlt)};box-shadow:0 0 0 3px ${h(c.accentAlt)}` : ''}"></div><div class="timeline-label">${esc(step.label)}</div>${step.description ? `<div class="timeline-desc">${esc(step.description)}</div>` : ''}</div>`).join('')}
        </div>
      </div>
    </div>`, idx, total, slide, h(c.bg));
}

export function renderProcess(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const steps = slide.steps || [];
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:16px">${esc(slide.subtitle)}</p>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px">
        ${img ? `<div style="display:flex;justify-content:center;margin-bottom:12px"><img src="${img}" style="max-height:220px;border-radius:16px;object-fit:contain;box-shadow:0 4px 24px rgba(0,0,0,.2)"/></div>` : ''}
        <div class="process-container">${steps.map((step, i) => `${i > 0 ? '<div class="process-connector">&rarr;</div>' : ''}<div class="process-step"><div class="process-number">${i + 1}</div><div class="process-label">${esc(step.label)}</div>${step.description ? `<div class="process-desc">${esc(step.description)}</div>` : ''}</div>`).join('')}</div>
      </div>
    </div>`, idx, total, slide, h(c.bg));
}

export function renderIconGrid(slide: SlideData, th: ResolvedTheme, idx: number, total: number): string {
  const c = th.colors;
  const items = slide.items || [];
  const cols = items.length <= 4 ? 2 : 3;
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:20px">${esc(slide.subtitle)}</p>` : ''}
      <div class="icon-grid cols-${cols}" style="flex:1;align-content:center">
        ${items.map((item, i) => {
          const itemColor = item.color || (i % 2 === 0 ? c.accent : c.accentAlt);
          return `<div class="icon-cell"><div class="cell-icon" style="background:${h(itemColor)}20;color:${h(itemColor)}">${item.icon || 'â—†'}</div><div><div class="cell-title">${esc(item.label)}</div>${item.description ? `<div class="cell-desc">${esc(item.description)}</div>` : ''}</div></div>`;
        }).join('')}
      </div>
    </div>`, idx, total, slide, h(c.bg));
}
