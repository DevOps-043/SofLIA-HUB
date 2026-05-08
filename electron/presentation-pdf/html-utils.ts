import type { ResolvedTheme } from './types';

export function h(hex: string): string {
  return `#${hex}`;
}

export function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildHTML(slides: string[], theme: ResolvedTheme): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page{size:landscape;margin:0}*{box-sizing:border-box}body{margin:0;padding:0}
.slide{width:1280px;height:720px;overflow:hidden;position:relative}
.accent{position:absolute;top:0;left:0;width:100%;height:4px;z-index:10}
.sn{position:absolute;bottom:12px;right:20px;font-family:'${theme.fontBody}';font-size:11px;color:#${theme.colors.textMuted};z-index:10}
.br{position:absolute;bottom:12px;left:20px;font-family:'${theme.fontBody}';font-size:10px;color:#${theme.colors.textMuted};font-style:italic;z-index:10}
</style></head><body>${slides.join('')}</body></html>`;
}
