import type { ResolvedTheme } from './types';
import { h } from './html';

function buildThemeVars(theme: ResolvedTheme): string {
  const c = theme.colors;
  return `
    :root {
      --bg: ${h(c.bg)}; --bg-alt: ${h(c.bgAlt)}; --accent: ${h(c.accent)};
      --accent-alt: ${h(c.accentAlt)}; --text: ${h(c.text)};
      --text-muted: ${h(c.textMuted)}; --heading: ${h(c.heading)};
      --scrim: ${h(c.scrim)}; --font-heading: '${theme.fontHeading}', 'Segoe UI', sans-serif;
      --font-body: '${theme.fontBody}', 'Segoe UI', sans-serif;
    }
    @page { size: landscape; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .slide { width: 1920px; height: 1080px; overflow: hidden; position: relative; font-family: var(--font-body); color: var(--text); }
    .accent-bar-top,.accent-bar-bottom { position: absolute; left: 0; width: 100%; height: 6px; background: linear-gradient(90deg,var(--accent),var(--accent-alt)); z-index: 10; }
    .accent-bar-top { top: 0; } .accent-bar-bottom { bottom: 0; }
    .accent-bar-left { position:absolute;top:0;left:0;width:6px;height:100%;background:linear-gradient(180deg,var(--accent),var(--accent-alt));z-index:10; }
    .slide-number { position:absolute;bottom:18px;right:30px;font-size:16px;color:var(--text-muted);z-index:10;font-family:var(--font-body); }
    .branding { position:absolute;bottom:18px;left:30px;font-size:14px;color:var(--text-muted);z-index:10;font-style:italic;font-family:var(--font-body); }
    .scrim { position:absolute;inset:0;z-index:1; } .scrim-bottom { position:absolute;left:0;right:0;bottom:0;height:50%;z-index:1; }
    .z-content { position:relative;z-index:2; }
    .slide-title { font-family:var(--font-heading);font-weight:700;color:var(--heading);line-height:1.15;letter-spacing:-0.02em; }
    .slide-subtitle { font-family:var(--font-body);color:var(--text-muted);line-height:1.4; }
    .bullet-list { list-style:none;padding:0; }
    .bullet-list li { font-size:24px;color:var(--text);margin-bottom:18px;padding-left:28px;position:relative;line-height:1.5;font-family:var(--font-body); }
    .bullet-list li::before { content:'';position:absolute;left:0;top:10px;width:10px;height:10px;border-radius:50%;background:var(--accent); }
    .card { background:var(--bg-alt);border-radius:16px;padding:28px;border:1px solid ${h(c.accent)}22; }
    .card-accent { border-left:4px solid var(--accent); }
  `;
}

function buildGridCss(theme: ResolvedTheme): string {
  const c = theme.colors;
  return `
    .info-grid,.icon-grid { display:grid;gap:20px; }
    .info-grid.cols-2,.icon-grid.cols-2 { grid-template-columns:1fr 1fr; }
    .info-grid.cols-3,.icon-grid.cols-3 { grid-template-columns:1fr 1fr 1fr; }
    .info-card { background:var(--bg-alt);border-radius:16px;padding:28px 24px;display:flex;flex-direction:column;align-items:flex-start;gap:12px;border:1px solid ${h(c.accent)}15; }
    .info-card .icon-circle { width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0; }
    .info-card .card-label { font-family:var(--font-heading);font-size:20px;font-weight:700;color:var(--heading); }
    .info-card .card-desc { font-size:16px;color:var(--text-muted);line-height:1.5; }
    .icon-cell { display:flex;gap:16px;align-items:flex-start;padding:20px;background:var(--bg-alt);border-radius:14px;border:1px solid ${h(c.accent)}12; }
    .icon-cell .cell-icon { width:48px;height:48px;border-radius:12px;background:${h(c.accent)}20;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0; }
    .icon-cell .cell-title { font-family:var(--font-heading);font-size:17px;font-weight:700;color:var(--heading);margin-bottom:4px; }
    .icon-cell .cell-desc { font-size:14px;color:var(--text-muted);line-height:1.4; }
    .vs-badge { width:64px;height:64px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-heading);font-size:18px;font-weight:800;color:var(--bg);z-index:5;box-shadow:0 4px 20px ${h(c.accent)}50; }
  `;
}

function buildProcessCss(theme: ResolvedTheme): string {
  const c = theme.colors;
  return `
    .flow-container { display:flex;align-items:center;justify-content:center;gap:0;width:100%; }
    .flow-step { background:var(--bg-alt);border:2px solid var(--accent);border-radius:16px;padding:24px 28px;text-align:center;min-width:180px;max-width:280px;flex:1; }
    .flow-step .step-label { font-family:var(--font-heading);font-size:18px;font-weight:700;color:var(--heading);margin-bottom:8px; }
    .flow-step .step-desc { font-size:14px;color:var(--text-muted);line-height:1.4; }
    .flow-arrow { display:flex;align-items:center;justify-content:center;width:60px;flex-shrink:0;color:var(--accent);font-size:32px;font-weight:bold; }
    .process-container { display:flex;align-items:flex-start;justify-content:center;gap:16px;padding:20px 0; }
    .process-step { display:flex;flex-direction:column;align-items:center;text-align:center;flex:1; }
    .process-number { width:56px;height:56px;border-radius:50%;background:var(--accent);color:var(--bg);font-family:var(--font-heading);font-size:24px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 4px 16px ${h(c.accent)}40; }
    .process-label { font-family:var(--font-heading);font-size:18px;font-weight:700;color:var(--heading);margin-bottom:8px; }
    .process-desc { font-size:14px;color:var(--text-muted);max-width:200px;line-height:1.4; }
    .process-connector { display:flex;align-items:center;padding-top:18px;color:var(--accent);font-size:24px;flex-shrink:0; }
  `;
}

function buildDataCss(theme: ResolvedTheme): string {
  const c = theme.colors;
  return `
    .data-table { width:100%;border-collapse:separate;border-spacing:0;border-radius:12px;overflow:hidden;font-family:var(--font-body); }
    .data-table thead th { background:var(--accent);color:var(--bg);padding:16px 20px;font-size:16px;font-weight:700;text-align:left;font-family:var(--font-heading); }
    .data-table tbody tr:nth-child(even) { background:var(--bg-alt); }
    .data-table tbody tr:nth-child(odd) { background:var(--bg); }
    .data-table tbody td { padding:14px 20px;font-size:15px;color:var(--text);border-bottom:1px solid ${h(c.accent)}15; }
    .stats-container { display:flex;gap:24px;justify-content:center;align-items:stretch; }
    .stat-card { background:var(--bg-alt);border-radius:16px;padding:36px 28px;text-align:center;flex:1;border:1px solid ${h(c.accent)}20;display:flex;flex-direction:column;justify-content:center;align-items:center; }
    .stat-value { font-family:var(--font-heading);font-size:52px;font-weight:800;color:var(--accent);line-height:1;margin-bottom:12px; }
    .stat-label { font-size:17px;color:var(--text-muted); }
    .stat-trend { font-size:14px;margin-top:8px;font-weight:600; }
    .stat-trend.up { color:#10B981; } .stat-trend.down { color:#EF4444; }
  `;
}

function buildTimelineCss(): string {
  return `
    .timeline-container { position:relative;display:flex;align-items:flex-start;justify-content:space-between;padding:60px 40px 0; }
    .timeline-line { position:absolute;top:80px;left:80px;right:80px;height:4px;background:linear-gradient(90deg,var(--accent),var(--accent-alt));border-radius:2px; }
    .timeline-item { display:flex;flex-direction:column;align-items:center;position:relative;flex:1;text-align:center;z-index:2; }
    .timeline-dot { width:20px;height:20px;border-radius:50%;background:var(--accent);border:4px solid var(--bg);box-shadow:0 0 0 3px var(--accent);margin-bottom:16px; }
    .timeline-label { font-family:var(--font-heading);font-size:16px;font-weight:700;color:var(--heading);margin-bottom:6px; }
    .timeline-desc { font-size:14px;color:var(--text-muted);max-width:160px;line-height:1.4; }
  `;
}

export function buildCSS(theme: ResolvedTheme): string {
  return [buildThemeVars(theme), buildGridCss(theme), buildProcessCss(theme), buildDataCss(theme), buildTimelineCss()].join('');
}
