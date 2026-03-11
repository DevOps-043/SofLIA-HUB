/**
 * presentation-premium.ts — Motor de presentaciones PDF de nivel profesional.
 *
 * Genera slides al estilo NotebookLM/Gamma usando HTML/CSS avanzado
 * (CSS Grid, Flexbox, custom properties) + imágenes AI de Gemini.
 *
 * 15 tipos de slides:
 *   title, content, two-column, image-focus, quote, section-break,
 *   comparison, closing, infographic, flowchart, data-table, stats,
 *   timeline, process, icon-grid
 *
 * Renderiza en Electron BrowserWindow → printToPDF a 1920×1080.
 */

import { BrowserWindow } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'node:fs/promises';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface SlideData {
  type: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  leftColumn?: { heading: string; items: string[] };
  rightColumn?: { heading: string; items: string[] };
  quote?: { text: string; author: string };
  imagePrompt?: string;
  diagramPrompt?: string;
  notes?: string;
  // Campos para slides avanzados
  items?: Array<{ icon?: string; label: string; description?: string; color?: string }>;
  steps?: Array<{ label: string; description?: string }>;
  tableData?: { headers: string[]; rows: string[][] };
  stats?: Array<{ value: string; label: string; trend?: string }>;
}

export interface ThemeConfig {
  colors?: Partial<ThemeColors>;
  fontHeading?: string;
  fontBody?: string;
}

interface ThemeColors {
  bg: string;
  bgAlt: string;
  accent: string;
  accentAlt: string;
  text: string;
  textMuted: string;
  heading: string;
  scrim: string;
  scrimOpacity: number;
}

interface ResolvedTheme {
  colors: ThemeColors;
  fontHeading: string;
  fontBody: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Themes (reutilizados de slide-designer.ts)
// ─────────────────────────────────────────────────────────────────────────────
const THEMES: Record<string, ResolvedTheme> = {
  'corporate-dark': {
    colors: {
      bg: '0F1117', bgAlt: '1A1D2B', accent: '22D3EE', accentAlt: '6366F1',
      text: 'EAEAEA', textMuted: '9CA3AF', heading: 'FFFFFF',
      scrim: '000000', scrimOpacity: 55,
    },
    fontHeading: 'Segoe UI', fontBody: 'Segoe UI',
  },
  'modern-light': {
    colors: {
      bg: 'FFFFFF', bgAlt: 'F3F4F6', accent: '4F46E5', accentAlt: '7C3AED',
      text: '374151', textMuted: '6B7280', heading: '111827',
      scrim: '000000', scrimOpacity: 45,
    },
    fontHeading: 'Segoe UI', fontBody: 'Segoe UI',
  },
  'gradient-vibrant': {
    colors: {
      bg: '0F0720', bgAlt: '1E1145', accent: 'F472B6', accentAlt: 'A78BFA',
      text: 'E2E8F0', textMuted: 'A5B4C8', heading: 'FFFFFF',
      scrim: '0F0720', scrimOpacity: 60,
    },
    fontHeading: 'Segoe UI', fontBody: 'Segoe UI',
  },
  'minimal-elegant': {
    colors: {
      bg: 'FAF9F6', bgAlt: 'F0EDEA', accent: 'B8860B', accentAlt: '8B7355',
      text: '3C3C3C', textMuted: '8A8A8A', heading: '1A1A1A',
      scrim: '1A1A1A', scrimOpacity: 50,
    },
    fontHeading: 'Georgia', fontBody: 'Segoe UI',
  },
  'tech-neon': {
    colors: {
      bg: '0A0A0A', bgAlt: '141414', accent: '00FF87', accentAlt: '00D4FF',
      text: 'D4D4D4', textMuted: '737373', heading: 'FFFFFF',
      scrim: '000000', scrimOpacity: 60,
    },
    fontHeading: 'Consolas', fontBody: 'Segoe UI',
  },
};

const DEFAULT_THEME = THEMES['corporate-dark'];

function resolveTheme(themeName?: string, custom?: ThemeConfig): ResolvedTheme {
  const base = (themeName && THEMES[themeName]) ? THEMES[themeName] : DEFAULT_THEME;
  if (!custom) return base;
  return {
    colors: { ...base.colors, ...(custom.colors || {}) } as ThemeColors,
    fontHeading: custom.fontHeading || base.fontHeading,
    fontBody: custom.fontBody || base.fontBody,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Generation
// ─────────────────────────────────────────────────────────────────────────────
async function generateSlideImage(genAI: GoogleGenerativeAI, prompt: string, isDiagram = false): Promise<string | null> {
  try {
    const imgModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

    const enhancedPrompt = isDiagram
      ? `Generate a clean, flat-design infographic diagram illustration. Style: minimal, vector-art, modern flat design with clean shapes and simple icons. NO TEXT anywhere in the image. Use vibrant accent colors on a dark background. Subject: ${prompt}. Aspect ratio: 16:9 widescreen. Make it visually clean and suitable for a professional presentation.`
      : `Generate a high-quality, professional photograph or illustration for a presentation slide. Style: modern, clean, corporate-quality. No text overlays, no watermarks. Subject: ${prompt}. Aspect ratio: 16:9 widescreen. Make it visually stunning.`;

    const result = await imgModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] } as any,
    });

    const parts = result.response.candidates?.[0]?.content?.parts as any[] | undefined;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (err) {
    console.warn('[presentation-premium] Image gen failed:', prompt, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Helpers
// ─────────────────────────────────────────────────────────────────────────────
function h(hex: string): string { return `#${hex}`; }

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS Engine
// ─────────────────────────────────────────────────────────────────────────────
function buildCSS(th: ResolvedTheme): string {
  const c = th.colors;
  return `
    :root {
      --bg: ${h(c.bg)};
      --bg-alt: ${h(c.bgAlt)};
      --accent: ${h(c.accent)};
      --accent-alt: ${h(c.accentAlt)};
      --text: ${h(c.text)};
      --text-muted: ${h(c.textMuted)};
      --heading: ${h(c.heading)};
      --scrim: ${h(c.scrim)};
      --font-heading: '${th.fontHeading}', 'Segoe UI', sans-serif;
      --font-body: '${th.fontBody}', 'Segoe UI', sans-serif;
    }
    @page { size: landscape; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    .slide {
      width: 1920px; height: 1080px; overflow: hidden; position: relative;
      font-family: var(--font-body); color: var(--text);
    }

    .accent-bar-top { position: absolute; top: 0; left: 0; width: 100%; height: 6px; background: linear-gradient(90deg, var(--accent), var(--accent-alt)); z-index: 10; }
    .accent-bar-bottom { position: absolute; bottom: 0; left: 0; width: 100%; height: 6px; background: linear-gradient(90deg, var(--accent), var(--accent-alt)); z-index: 10; }
    .accent-bar-left { position: absolute; top: 0; left: 0; width: 6px; height: 100%; background: linear-gradient(180deg, var(--accent), var(--accent-alt)); z-index: 10; }
    .slide-number { position: absolute; bottom: 18px; right: 30px; font-size: 16px; color: var(--text-muted); z-index: 10; font-family: var(--font-body); }
    .branding { position: absolute; bottom: 18px; left: 30px; font-size: 14px; color: var(--text-muted); z-index: 10; font-style: italic; font-family: var(--font-body); }
    .scrim { position: absolute; inset: 0; z-index: 1; }
    .scrim-bottom { position: absolute; left: 0; right: 0; bottom: 0; height: 50%; z-index: 1; }
    .z-content { position: relative; z-index: 2; }

    .slide-title {
      font-family: var(--font-heading); font-weight: 700; color: var(--heading);
      line-height: 1.15; letter-spacing: -0.02em;
    }
    .slide-subtitle {
      font-family: var(--font-body); color: var(--text-muted); line-height: 1.4;
    }

    .bullet-list { list-style: none; padding: 0; }
    .bullet-list li {
      font-size: 24px; color: var(--text); margin-bottom: 18px; padding-left: 28px;
      position: relative; line-height: 1.5; font-family: var(--font-body);
    }
    .bullet-list li::before {
      content: ''; position: absolute; left: 0; top: 10px;
      width: 10px; height: 10px; border-radius: 50%; background: var(--accent);
    }

    .card {
      background: var(--bg-alt); border-radius: 16px; padding: 28px;
      border: 1px solid ${h(c.accent)}22;
    }
    .card-accent { border-left: 4px solid var(--accent); }

    .info-grid { display: grid; gap: 20px; }
    .info-grid.cols-2 { grid-template-columns: 1fr 1fr; }
    .info-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
    .info-card {
      background: var(--bg-alt); border-radius: 16px; padding: 28px 24px;
      display: flex; flex-direction: column; align-items: flex-start; gap: 12px;
      border: 1px solid ${h(c.accent)}15;
    }
    .info-card .icon-circle {
      width: 56px; height: 56px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0;
    }
    .info-card .card-label {
      font-family: var(--font-heading); font-size: 20px; font-weight: 700; color: var(--heading);
    }
    .info-card .card-desc { font-size: 16px; color: var(--text-muted); line-height: 1.5; }

    .flow-container { display: flex; align-items: center; justify-content: center; gap: 0; width: 100%; }
    .flow-step {
      background: var(--bg-alt); border: 2px solid var(--accent);
      border-radius: 16px; padding: 24px 28px; text-align: center;
      min-width: 180px; max-width: 280px; flex: 1;
    }
    .flow-step .step-label {
      font-family: var(--font-heading); font-size: 18px; font-weight: 700; color: var(--heading); margin-bottom: 8px;
    }
    .flow-step .step-desc { font-size: 14px; color: var(--text-muted); line-height: 1.4; }
    .flow-arrow {
      display: flex; align-items: center; justify-content: center;
      width: 60px; flex-shrink: 0; color: var(--accent); font-size: 32px; font-weight: bold;
    }

    .data-table {
      width: 100%; border-collapse: separate; border-spacing: 0;
      border-radius: 12px; overflow: hidden; font-family: var(--font-body);
    }
    .data-table thead th {
      background: var(--accent); color: var(--bg);
      padding: 16px 20px; font-size: 16px; font-weight: 700;
      text-align: left; font-family: var(--font-heading);
    }
    .data-table tbody tr:nth-child(even) { background: var(--bg-alt); }
    .data-table tbody tr:nth-child(odd) { background: var(--bg); }
    .data-table tbody td {
      padding: 14px 20px; font-size: 15px; color: var(--text);
      border-bottom: 1px solid ${h(c.accent)}15;
    }

    .stats-container { display: flex; gap: 24px; justify-content: center; align-items: stretch; }
    .stat-card {
      background: var(--bg-alt); border-radius: 16px; padding: 36px 28px;
      text-align: center; flex: 1; border: 1px solid ${h(c.accent)}20;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
    }
    .stat-value {
      font-family: var(--font-heading); font-size: 52px; font-weight: 800;
      color: var(--accent); line-height: 1; margin-bottom: 12px;
    }
    .stat-label { font-size: 17px; color: var(--text-muted); }
    .stat-trend { font-size: 14px; margin-top: 8px; font-weight: 600; }
    .stat-trend.up { color: #10B981; }
    .stat-trend.down { color: #EF4444; }

    .timeline-container {
      position: relative; display: flex; align-items: flex-start; justify-content: space-between;
      padding: 60px 40px 0;
    }
    .timeline-line {
      position: absolute; top: 80px; left: 80px; right: 80px; height: 4px;
      background: linear-gradient(90deg, var(--accent), var(--accent-alt)); border-radius: 2px;
    }
    .timeline-item {
      display: flex; flex-direction: column; align-items: center; position: relative;
      flex: 1; text-align: center; z-index: 2;
    }
    .timeline-dot {
      width: 20px; height: 20px; border-radius: 50%; background: var(--accent);
      border: 4px solid var(--bg); box-shadow: 0 0 0 3px var(--accent); margin-bottom: 16px;
    }
    .timeline-label {
      font-family: var(--font-heading); font-size: 16px; font-weight: 700; color: var(--heading); margin-bottom: 6px;
    }
    .timeline-desc { font-size: 14px; color: var(--text-muted); max-width: 160px; line-height: 1.4; }

    .process-container { display: flex; align-items: flex-start; justify-content: center; gap: 16px; padding: 20px 0; }
    .process-step { display: flex; flex-direction: column; align-items: center; text-align: center; flex: 1; }
    .process-number {
      width: 56px; height: 56px; border-radius: 50%; background: var(--accent);
      color: var(--bg); font-family: var(--font-heading); font-size: 24px; font-weight: 800;
      display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
      box-shadow: 0 4px 16px ${h(c.accent)}40;
    }
    .process-label {
      font-family: var(--font-heading); font-size: 18px; font-weight: 700; color: var(--heading); margin-bottom: 8px;
    }
    .process-desc { font-size: 14px; color: var(--text-muted); max-width: 200px; line-height: 1.4; }
    .process-connector {
      display: flex; align-items: center; padding-top: 18px; color: var(--accent); font-size: 24px; flex-shrink: 0;
    }

    .icon-grid { display: grid; gap: 20px; }
    .icon-grid.cols-2 { grid-template-columns: 1fr 1fr; }
    .icon-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
    .icon-cell {
      display: flex; gap: 16px; align-items: flex-start; padding: 20px;
      background: var(--bg-alt); border-radius: 14px; border: 1px solid ${h(c.accent)}12;
    }
    .icon-cell .cell-icon {
      width: 48px; height: 48px; border-radius: 12px; background: ${h(c.accent)}20;
      display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;
    }
    .icon-cell .cell-title {
      font-family: var(--font-heading); font-size: 17px; font-weight: 700; color: var(--heading); margin-bottom: 4px;
    }
    .icon-cell .cell-desc { font-size: 14px; color: var(--text-muted); line-height: 1.4; }

    .vs-badge {
      width: 64px; height: 64px; border-radius: 50%; background: var(--accent);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-heading); font-size: 18px; font-weight: 800;
      color: var(--bg); z-index: 5; box-shadow: 0 4px 20px ${h(c.accent)}50;
    }
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide Renderers
// ─────────────────────────────────────────────────────────────────────────────
function slideWrapper(inner: string, idx: number, total: number, slide: SlideData, bg: string, opts?: { noBar?: boolean; noBrand?: boolean }): string {
  const pb = idx > 0 ? 'page-break-before:always;' : '';
  const bar = opts?.noBar ? '' : '<div class="accent-bar-top"></div>';
  const brand = (opts?.noBrand || slide.type === 'title' || slide.type === 'closing') ? '' : '<div class="branding">SofLIA</div>';
  return `<div class="slide" style="${pb}background:${bg};">${bar}${inner}<div class="slide-number">${idx + 1} / ${total}</div>${brand}</div>`;
}

function renderTitle(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const bgStyle = img ? `url('${img}') center/cover no-repeat` : `linear-gradient(135deg, ${h(c.bg)}, ${h(c.bgAlt)})`;
  const scrim = img ? '<div class="scrim" style="background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.65))"></div>' : '';

  return slideWrapper(`${scrim}
    <div class="z-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px">
      <div style="width:280px;height:4px;background:var(--accent);margin-bottom:36px;border-radius:2px"></div>
      <h1 class="slide-title" style="font-size:64px;text-align:center;text-shadow:0 3px 24px rgba(0,0,0,.3);max-width:1400px">${esc(slide.title)}</h1>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:28px;text-align:center;margin-top:28px;max-width:1100px">${esc(slide.subtitle)}</p>` : ''}
      <div style="width:280px;height:4px;background:var(--accent);margin-top:40px;border-radius:2px"></div>
    </div>
    <div class="accent-bar-bottom"></div>
  `, idx, total, slide, bgStyle, { noBar: !img });
}

function renderContent(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  return slideWrapper(`
    <div class="accent-bar-left"></div>
    <div style="display:flex;height:100%;gap:40px;padding:70px 60px 50px">
      <div style="flex:${img ? '0.6' : '1'};display:flex;flex-direction:column">
        <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
        <div style="width:100px;height:4px;background:var(--accent);margin-bottom:32px;border-radius:2px"></div>
        ${slide.bullets ? `<ul class="bullet-list">${slide.bullets.map(b => `<li>${esc(b.replace(/^[-•*]\s*/, ''))}</li>`).join('')}</ul>` : ''}
      </div>
      ${img ? `<div style="flex:0.4;display:flex;align-items:center;justify-content:center">
        <img src="${img}" style="max-width:100%;max-height:92%;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.3);object-fit:cover"/>
      </div>` : ''}
    </div>
  `, idx, total, slide, h(c.bg));
}

function renderTwoColumn(slide: SlideData, th: ResolvedTheme, idx: number, total: number, _img: string | null): string {
  const c = th.colors;
  const left = slide.leftColumn || { heading: '', items: [] };
  const right = slide.rightColumn || { heading: '', items: [] };
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100%;height:3px;background:linear-gradient(90deg,${h(c.accent)}60,transparent);margin-bottom:32px"></div>
      <div style="display:flex;gap:36px;flex:1">
        <div class="card card-accent" style="flex:1;border-left-color:var(--accent)">
          ${left.heading ? `<h3 style="font-family:var(--font-heading);font-size:24px;color:var(--heading);font-weight:700;margin-bottom:20px">${esc(left.heading)}</h3>` : ''}
          <ul class="bullet-list">${left.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
        </div>
        <div style="width:3px;background:linear-gradient(180deg,${h(c.accent)}50,transparent);border-radius:2px"></div>
        <div class="card card-accent" style="flex:1;border-left-color:var(--accent-alt)">
          ${right.heading ? `<h3 style="font-family:var(--font-heading);font-size:24px;color:var(--heading);font-weight:700;margin-bottom:20px">${esc(right.heading)}</h3>` : ''}
          <ul class="bullet-list">${right.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
  `, idx, total, slide, h(c.bg));
}

function renderImageFocus(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const bgStyle = img ? `url('${img}') center/cover no-repeat` : h(c.bgAlt);
  return slideWrapper(`
    <div class="scrim-bottom" style="background:linear-gradient(0deg,rgba(0,0,0,.75),transparent)"></div>
    <div class="z-content" style="position:absolute;bottom:60px;left:70px;right:70px">
      <h2 class="slide-title" style="font-size:44px;text-shadow:0 2px 16px rgba(0,0,0,.5)">${esc(slide.title)}</h2>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:22px;margin-top:12px">${esc(slide.subtitle)}</p>` : ''}
    </div>
    <div class="accent-bar-bottom"></div>
  `, idx, total, slide, bgStyle, { noBar: true });
}

function renderQuote(slide: SlideData, th: ResolvedTheme, idx: number, total: number, _img: string | null): string {
  const c = th.colors;
  const qt = slide.quote?.text || slide.bullets?.[0] || slide.title;
  const qa = slide.quote?.author || slide.subtitle || '';
  return slideWrapper(`
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:80px">
      <span style="font-size:140px;color:var(--accent);opacity:.25;font-family:Georgia;line-height:.7;margin-bottom:16px">&ldquo;</span>
      <p style="font-family:Georgia;font-size:34px;color:var(--text);text-align:center;font-style:italic;line-height:1.6;max-width:1200px">${esc(qt)}</p>
      ${qa ? `<div style="width:100px;height:3px;background:var(--accent);margin:32px 0 20px;border-radius:2px"></div>
        <p style="font-size:20px;color:var(--text-muted);text-align:center">&mdash; ${esc(qa)}</p>` : ''}
    </div>
  `, idx, total, slide, h(c.bgAlt));
}

function renderSectionBreak(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const bgStyle = img ? `url('${img}') center/cover no-repeat` : h(c.accent);
  const scrim = img ? '<div class="scrim" style="background:rgba(0,0,0,.5)"></div>' : '';
  const textColor = img ? h(c.heading) : h(c.bg);
  return slideWrapper(`${scrim}
    <div class="z-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%">
      <h1 class="slide-title" style="font-size:60px;text-align:center;color:${textColor};text-shadow:0 2px 20px rgba(0,0,0,.4)">${esc(slide.title)}</h1>
      ${slide.subtitle ? `<p style="font-size:24px;color:${img ? h(c.textMuted) : h(c.bg)};text-align:center;margin-top:20px;opacity:.85">${esc(slide.subtitle)}</p>` : ''}
    </div>
  `, idx, total, slide, bgStyle, { noBar: true, noBrand: true });
}

function renderComparison(slide: SlideData, th: ResolvedTheme, idx: number, total: number, _img: string | null): string {
  const c = th.colors;
  const left = slide.leftColumn || { heading: '', items: [] };
  const right = slide.rightColumn || { heading: '', items: [] };
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:32px">${esc(slide.title)}</h2>
      <div style="display:flex;gap:28px;flex:1;position:relative;align-items:stretch">
        <div class="card" style="flex:1;display:flex;flex-direction:column">
          ${left.heading ? `<h3 style="font-family:var(--font-heading);font-size:22px;color:var(--accent);text-align:center;font-weight:700;margin-bottom:20px">${esc(left.heading)}</h3>` : ''}
          <ul class="bullet-list">${left.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;z-index:5">
          <div class="vs-badge">VS</div>
        </div>
        <div class="card" style="flex:1;display:flex;flex-direction:column">
          ${right.heading ? `<h3 style="font-family:var(--font-heading);font-size:22px;color:var(--accent-alt);text-align:center;font-weight:700;margin-bottom:20px">${esc(right.heading)}</h3>` : ''}
          <ul class="bullet-list">${right.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
  `, idx, total, slide, h(c.bg));
}

function renderClosing(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const bgStyle = img ? `url('${img}') center/cover no-repeat` : `linear-gradient(135deg, ${h(c.bg)}, ${h(c.bgAlt)})`;
  const scrim = img ? '<div class="scrim" style="background:linear-gradient(180deg,rgba(0,0,0,.4),rgba(0,0,0,.7))"></div>' : '';
  return slideWrapper(`${scrim}
    <div class="accent-bar-bottom"></div>
    <div class="z-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%">
      <h1 class="slide-title" style="font-size:60px;text-align:center;text-shadow:0 2px 20px rgba(0,0,0,.3)">${esc(slide.title || '¡Gracias!')}</h1>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:24px;text-align:center;margin-top:24px">${esc(slide.subtitle)}</p>` : ''}
      <div style="width:160px;height:4px;background:var(--accent);margin-top:40px;border-radius:2px"></div>
    </div>
  `, idx, total, slide, bgStyle, { noBrand: true });
}

// ─── Slides avanzados ───────────────────────────────────────────────────────

function renderInfographic(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const items = slide.items || [];
  const cols = items.length <= 4 ? 2 : 3;
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:24px">${esc(slide.subtitle)}</p>` : ''}
      <div style="display:flex;gap:36px;flex:1;align-items:flex-start">
        <div class="info-grid cols-${cols}" style="flex:${img ? '0.65' : '1'}">
          ${items.map((item, i) => {
            const itemColor = item.color || (i % 2 === 0 ? c.accent : c.accentAlt);
            return `<div class="info-card">
              <div class="icon-circle" style="background:${h(itemColor)}20;color:${h(itemColor)}">${item.icon || '●'}</div>
              <div class="card-label">${esc(item.label)}</div>
              ${item.description ? `<div class="card-desc">${esc(item.description)}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
        ${img ? `<div style="flex:0.35;display:flex;align-items:center;justify-content:center;height:100%">
          <img src="${img}" style="max-width:100%;max-height:85%;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.3);object-fit:cover"/>
        </div>` : ''}
      </div>
    </div>
  `, idx, total, slide, h(c.bg));
}

function renderFlowchart(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const steps = slide.steps || [];
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:20px">${esc(slide.subtitle)}</p>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
        ${img ? `<div style="display:flex;justify-content:center;margin-bottom:28px">
          <img src="${img}" style="max-height:280px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.2);object-fit:contain"/>
        </div>` : ''}
        <div class="flow-container">
          ${steps.map((step, i) => {
            const stepColor = i % 2 === 0 ? c.accent : c.accentAlt;
            return `${i > 0 ? '<div class="flow-arrow">&rarr;</div>' : ''}
              <div class="flow-step" style="border-color:${h(stepColor)}">
                <div class="step-label">${esc(step.label)}</div>
                ${step.description ? `<div class="step-desc">${esc(step.description)}</div>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `, idx, total, slide, h(c.bg));
}

function renderDataTable(slide: SlideData, th: ResolvedTheme, idx: number, total: number, _img: string | null): string {
  const c = th.colors;
  const table = slide.tableData || { headers: [], rows: [] };
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:20px">${esc(slide.subtitle)}</p>` : ''}
      <div style="flex:1;display:flex;align-items:center;overflow:hidden">
        <table class="data-table">
          <thead><tr>${table.headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead>
          <tbody>${table.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `, idx, total, slide, h(c.bg));
}

function renderStats(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const statItems = slide.stats || [];
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:20px">${esc(slide.subtitle)}</p>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px">
        ${img ? `<div style="display:flex;justify-content:center;margin-bottom:16px">
          <img src="${img}" style="max-height:240px;border-radius:16px;object-fit:contain;box-shadow:0 4px 24px rgba(0,0,0,.2)"/>
        </div>` : ''}
        <div class="stats-container">
          ${statItems.map(s => `
            <div class="stat-card">
              <div class="stat-value">${esc(s.value)}</div>
              <div class="stat-label">${esc(s.label)}</div>
              ${s.trend ? `<div class="stat-trend ${s.trend.startsWith('+') || s.trend.startsWith('↑') ? 'up' : s.trend.startsWith('-') || s.trend.startsWith('↓') ? 'down' : ''}">${esc(s.trend)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `, idx, total, slide, h(c.bg));
}

function renderTimeline(slide: SlideData, th: ResolvedTheme, idx: number, total: number, _img: string | null): string {
  const c = th.colors;
  const steps = slide.steps || [];
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:16px">${esc(slide.subtitle)}</p>` : ''}
      <div style="flex:1;display:flex;align-items:center;position:relative">
        <div class="timeline-container" style="width:100%">
          <div class="timeline-line"></div>
          ${steps.map((step, i) => `
            <div class="timeline-item">
              <div class="timeline-dot" style="${i % 2 !== 0 ? `background:${h(c.accentAlt)};box-shadow:0 0 0 3px ${h(c.accentAlt)}` : ''}"></div>
              <div class="timeline-label">${esc(step.label)}</div>
              ${step.description ? `<div class="timeline-desc">${esc(step.description)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `, idx, total, slide, h(c.bg));
}

function renderProcess(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  const c = th.colors;
  const steps = slide.steps || [];
  return slideWrapper(`
    <div style="padding:70px 60px 50px;height:100%;display:flex;flex-direction:column">
      <h2 class="slide-title" style="font-size:40px;color:var(--accent);margin-bottom:12px">${esc(slide.title)}</h2>
      <div style="width:100px;height:4px;background:var(--accent);margin-bottom:28px;border-radius:2px"></div>
      ${slide.subtitle ? `<p class="slide-subtitle" style="font-size:20px;margin-bottom:16px">${esc(slide.subtitle)}</p>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px">
        ${img ? `<div style="display:flex;justify-content:center;margin-bottom:12px">
          <img src="${img}" style="max-height:220px;border-radius:16px;object-fit:contain;box-shadow:0 4px 24px rgba(0,0,0,.2)"/>
        </div>` : ''}
        <div class="process-container">
          ${steps.map((step, i) => `
            ${i > 0 ? '<div class="process-connector">&rarr;</div>' : ''}
            <div class="process-step">
              <div class="process-number">${i + 1}</div>
              <div class="process-label">${esc(step.label)}</div>
              ${step.description ? `<div class="process-desc">${esc(step.description)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `, idx, total, slide, h(c.bg));
}

function renderIconGrid(slide: SlideData, th: ResolvedTheme, idx: number, total: number, _img: string | null): string {
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
          return `<div class="icon-cell">
            <div class="cell-icon" style="background:${h(itemColor)}20;color:${h(itemColor)}">${item.icon || '◆'}</div>
            <div>
              <div class="cell-title">${esc(item.label)}</div>
              ${item.description ? `<div class="cell-desc">${esc(item.description)}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `, idx, total, slide, h(c.bg));
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide Dispatcher
// ─────────────────────────────────────────────────────────────────────────────
function renderSlide(slide: SlideData, th: ResolvedTheme, idx: number, total: number, img: string | null): string {
  switch (slide.type) {
    case 'title': return renderTitle(slide, th, idx, total, img);
    case 'content': return renderContent(slide, th, idx, total, img);
    case 'two-column': return renderTwoColumn(slide, th, idx, total, img);
    case 'image-focus': return renderImageFocus(slide, th, idx, total, img);
    case 'quote': return renderQuote(slide, th, idx, total, img);
    case 'section-break': return renderSectionBreak(slide, th, idx, total, img);
    case 'comparison': return renderComparison(slide, th, idx, total, img);
    case 'closing': return renderClosing(slide, th, idx, total, img);
    case 'infographic': return renderInfographic(slide, th, idx, total, img);
    case 'flowchart': return renderFlowchart(slide, th, idx, total, img);
    case 'data-table': return renderDataTable(slide, th, idx, total, img);
    case 'stats': return renderStats(slide, th, idx, total, img);
    case 'timeline': return renderTimeline(slide, th, idx, total, img);
    case 'process': return renderProcess(slide, th, idx, total, img);
    case 'icon-grid': return renderIconGrid(slide, th, idx, total, img);
    default: return renderContent(slide, th, idx, total, img);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Full HTML Document
// ─────────────────────────────────────────────────────────────────────────────
function buildHTML(slideHTMLs: string[], th: ResolvedTheme): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>${buildCSS(th)}</style>
</head>
<body>${slideHTMLs.join('')}</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown → SlideData[] fallback
// ─────────────────────────────────────────────────────────────────────────────
export function parseMarkdownToSlides(content: string, title: string): SlideData[] {
  const slides: SlideData[] = [];
  const lines = content.split('\n');
  let curTitle = '';
  let curBullets: string[] = [];
  let isFirst = true;

  const flush = () => {
    if (!curTitle && curBullets.length === 0) return;
    if (isFirst) {
      slides.push({
        type: 'title', title: curTitle || title,
        subtitle: curBullets.length > 0 ? curBullets.join(' • ') : undefined,
        imagePrompt: `Professional abstract visual representing: ${curTitle || title}`,
      });
      isFirst = false;
    } else {
      const types: string[] = ['content', 'content', 'image-focus', 'content', 'infographic', 'content'];
      slides.push({
        type: types[slides.length % types.length], title: curTitle,
        bullets: curBullets.length > 0 ? curBullets : undefined,
        imagePrompt: `Professional visual about: ${curTitle}`,
      });
    }
    curTitle = '';
    curBullets = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('## ') || t.startsWith('# ')) { flush(); curTitle = t.replace(/^#{1,3}\s*/, ''); }
    else if (t !== '') { curBullets.push(t.replace(/^[-•*]\s*/, '')); }
  }
  flush();

  if (slides.length > 0) {
    slides.push({
      type: 'closing', title: '¡Gracias!', subtitle: 'Presentación generada por SofLIA',
      imagePrompt: 'Professional thank you slide background, abstract gradient',
    });
  }
  return slides;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export interface CreatePresentationPDFOptions {
  slides: SlideData[];
  title: string;
  outputPath: string;
  themeName?: string;
  customTheme?: ThemeConfig;
  includeImages?: boolean;
  genAI?: GoogleGenerativeAI;
}

export async function createPresentationPDF(options: CreatePresentationPDFOptions): Promise<string> {
  const { slides, title: _title, outputPath, themeName, customTheme, includeImages = true, genAI } = options;
  const theme = resolveTheme(themeName, customTheme);

  console.log(`[presentation-premium] Generando ${slides.length} slides, imágenes=${includeImages}`);

  // ── Generar imágenes en paralelo (batches de 3) ──
  const imageCache = new Map<number, string | null>();
  if (includeImages && genAI) {
    const BATCH = 3;
    for (let i = 0; i < slides.length; i += BATCH) {
      const batch = slides.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(s => {
          const prompt = s.diagramPrompt || s.imagePrompt;
          if (!prompt) return Promise.resolve(null);
          return generateSlideImage(genAI, prompt, !!s.diagramPrompt);
        }),
      );
      results.forEach((r, idx) => {
        imageCache.set(i + idx, r.status === 'fulfilled' ? r.value : null);
      });
    }
    const ok = Array.from(imageCache.values()).filter(Boolean).length;
    console.log(`[presentation-premium] Imágenes: ${ok}/${slides.length} generadas`);
  }

  // ── Renderizar slides a HTML ──
  const slideHTMLs = slides.map((s, i) => renderSlide(s, theme, i, slides.length, imageCache.get(i) || null));
  const fullHTML = buildHTML(slideHTMLs, theme);

  // ── Renderizar a PDF con Electron BrowserWindow ──
  const win = new BrowserWindow({
    show: false,
    width: 1920,
    height: 1080,
    webPreferences: { offscreen: true },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      win.webContents.on('did-finish-load', async () => {
        try {
          // Esperar que fuentes carguen
          try {
            await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true);
          } catch { /* fallback */ }
          await new Promise(r => setTimeout(r, 800));

          const pdfData = await win.webContents.printToPDF({
            printBackground: true,
            landscape: true,
            pageSize: { width: 508000, height: 285750 }, // 20 x 11.25 in microns → 1920x1080 @ 96 DPI
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          });
          await fs.writeFile(outputPath, pdfData);
          resolve();
        } catch (e) { reject(e); }
      });
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHTML)}`);
    });
  } finally {
    win.destroy();
  }

  console.log(`[presentation-premium] PDF guardado: ${outputPath} (${slides.length} slides)`);
  return outputPath;
}
