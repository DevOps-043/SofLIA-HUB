import type { ResolvedTheme, SlideData } from './types';
import { esc, h, slideWrapper } from './html';

export function renderInfographic(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const items = slide.items || [];
  const cols = items.length <= 4 ? 2 : 3;
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:24px">${esc(slide.subtitle)}</p>` : ''}
      <div style="display:flex;gap:36px;flex:1;align-items:flex-start">
        <div class="info-grid cols-${cols}" style="flex:${img ? '0.65' : '1'}">${items.map((item, i) => {
          const itemColor = item.color || (i % 2 === 0 ? c.accent : c.accentAlt);
          return `<div class="info-card"><div class="icon-circle" style="background:${h(itemColor)}20;color:${h(itemColor)}">${item.icon || 'â—'}</div><div class="card-label">${esc(item.label)}</div>${item.description ? `<div class="card-desc">${esc(item.description)}</div>` : ''}</div>`;
        }).join('')}</div>
        ${img ? `<div style="flex:0.35;display:flex;align-items:center;justify-content:center;height:100%"><img src="${img}" style="max-width:100%;max-height:85%;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.3);object-fit:cover"/></div>` : ''}
      </div>
    </div>`, idx, total, slide, h(c.bg));
}

export function renderFlowchart(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const steps = slide.steps || [];
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:20px">${esc(slide.subtitle)}</p>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
        ${img ? `<div style="display:flex;justify-content:center;margin-bottom:28px"><img src="${img}" style="max-height:280px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.2);object-fit:contain"/></div>` : ''}
        <div class="flow-container">${steps.map((step, i) => {
          const stepColor = i % 2 === 0 ? c.accent : c.accentAlt;
          return `${i > 0 ? '<div class="flow-arrow">&rarr;</div>' : ''}<div class="flow-step" style="border-color:${h(stepColor)}"><div class="step-label">${esc(step.label)}</div>${step.description ? `<div class="step-desc">${esc(step.description)}</div>` : ''}</div>`;
        }).join('')}</div>
      </div>
    </div>`, idx, total, slide, h(c.bg));
}

export function renderDataTable(slide: SlideData, th: ResolvedTheme, idx: number, total: number): string {
  const c = th.colors;
  const table = slide.tableData || { headers: [], rows: [] };
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:20px">${esc(slide.subtitle)}</p>` : ''}
      <div style="flex:1;display:flex;align-items:center;overflow:hidden">
        <table class="data-table"><thead><tr>${table.headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </div>
    </div>`, idx, total, slide, h(c.bg));
}

export function renderStats(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const statItems = slide.stats || [];
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:20px">${esc(slide.subtitle)}</p>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px">
        ${img ? `<div style="display:flex;justify-content:center;margin-bottom:16px"><img src="${img}" style="max-height:240px;border-radius:16px;object-fit:contain;box-shadow:0 4px 24px rgba(0,0,0,.2)"/></div>` : ''}
        <div class="stats-container">${statItems.map((s) => `<div class="stat-card"><div class="stat-value">${esc(s.value)}</div><div class="stat-label">${esc(s.label)}</div>${s.trend ? `<div class="stat-trend ${s.trend.startsWith('+') || s.trend.startsWith('â†‘') ? 'up' : s.trend.startsWith('-') || s.trend.startsWith('â†“') ? 'down' : ''}">${esc(s.trend)}</div>` : ''}</div>`).join('')}</div>
      </div>
    </div>`, idx, total, slide, h(c.bg));
}
