/** Documento propio y pasivo: sin preload, red, recursos remotos ni entrada de usuario. */
export const GUIDANCE_OVERLAY_DOCUMENT = `<!doctype html><html lang="es"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;pointer-events:none}
#mark{position:absolute;box-sizing:border-box;border:3px solid #00D4B3;border-radius:8px;box-shadow:0 0 0 2px #0A2540;display:none}
#mark[data-style=halo]{border-radius:50%;box-shadow:0 0 0 5px #0A2540,0 0 0 9px #00D4B350}
#mark[data-style=focus]{box-shadow:0 0 0 99999px #0A254070}
#arrow{position:absolute;display:none;color:#00D4B3;filter:drop-shadow(0 1px 2px #0A2540)}
</style></head><body><div id="mark"></div><svg id="arrow" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><path d="M4 4L43 43M24 43H43V24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
<script>window.showGuidance=function(data){const mark=document.getElementById('mark'),arrow=document.getElementById('arrow');mark.style.display='none';arrow.style.display='none';if(!data)return;const t=data.target;let b=t.rect||{x:t.point.x-22,y:t.point.y-22,width:44,height:44};if(data.style==='halo')b={x:t.point.x-24,y:t.point.y-24,width:48,height:48};if(data.style==='arrow'){arrow.style.left=Math.max(0,t.point.x-43)+'px';arrow.style.top=Math.max(0,t.point.y-43)+'px';arrow.style.display='block';return;}mark.dataset.style=data.style;mark.style.left=b.x+'px';mark.style.top=b.y+'px';mark.style.width=b.width+'px';mark.style.height=b.height+'px';mark.style.display='block';};</script></body></html>`;
