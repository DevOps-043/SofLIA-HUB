import type { ResolvedTheme } from './types';

export function buildHTML(slides: string[], theme: ResolvedTheme): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page{size:landscape;margin:0}*{box-sizing:border-box}body{margin:0;padding:0}
.slide{width:1280px;height:720px;overflow:hidden;position:relative}
.ab{position:absolute;top:0;left:0;width:100%;height:4px;z-index:10}
.scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.72));z-index:1}
.sn{position:absolute;bottom:12px;right:20px;font-family:'${theme.fontBody}';font-size:11px;color:#${theme.colors.textMuted};z-index:10}
.br{position:absolute;bottom:12px;left:20px;font-family:'${theme.fontBody}';font-size:10px;color:#${theme.colors.textMuted};font-style:italic;z-index:10}
.center{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:70px;text-align:center}
.center h1{font-size:52px;line-height:1.15;margin:0;text-shadow:0 2px 20px rgba(0,0,0,.35)}
.center p{font-size:20px;line-height:1.5;max-width:900px}
.content{height:100%;padding:50px 56px 34px;position:relative;z-index:2}
.content h2{font-size:34px;margin:0 0 8px;font-weight:700}
.rule{width:92px;height:3px;margin-bottom:24px}
ul{list-style:none;padding:0;margin:0}.content li{font-size:18px;line-height:1.45;margin-bottom:13px}.content li span{margin-right:10px}
.columns{display:flex;gap:28px}.panel{flex:1;background:rgba(255,255,255,.06);border-radius:12px;padding:22px}.panel h3{font-size:21px;margin:0 0 16px}
.quote p{font-size:30px;line-height:1.55;max-width:850px}.quote span{font-size:16px}
</style></head><body>${slides.join('')}</body></html>`;
}
