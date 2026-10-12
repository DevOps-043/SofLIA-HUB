/** Se ejecuta dentro del documento aislado. No recibe rutas ni código del modelo. */
export function inspectStageLayout(): string[] {
  const stage = document.querySelector('.film-stage')!;
  const bounds = stage.getBoundingClientRect(), scale = bounds.width / 1920, margin = 40 * scale;
  const visible = (node: Element) => { for(let parent:Element|null=node;parent&&parent!==stage;parent=parent.parentElement) if(Number(getComputedStyle(parent).opacity)<.98) return false; return true; };
  const issues: string[] = [], add = (node: Element, reason: string) => issues.push(reason+': '+(node.textContent ?? '').trim().replace(/\s+/g,' ').slice(0,100));
  for (const node of Array.from(stage.querySelectorAll('.film-headline,.film-plane>.film-window,.film-close h1,.film-close p,.film-close-mark,.film-transfer'))) {
    if (!visible(node)) continue;
    const box = node.getBoundingClientRect();
    if(box.left<bounds.left+margin-2||box.top<bounds.top+margin-2||box.right>bounds.right-margin+2||box.bottom>bounds.bottom-margin+2) add(node,'Fuera del área segura');
  }
  for (const node of Array.from(stage.querySelectorAll('.film-main-message,.film-subtitle,.film-window-content h3,.film-window-content h4,.film-task-label,.film-close p,.film-paper'))) {
    if(!visible(node)) continue;
    if(node.scrollWidth>node.clientWidth+3||(!node.classList.contains('film-main-message')&&node.scrollHeight>node.clientHeight+3)) add(node,'Texto desbordado');
  }
  for(const panel of Array.from(stage.querySelectorAll('.film-plane .film-window-content'))) {
    if(!visible(panel)) continue;
    const box=panel.getBoundingClientRect();
    for(const node of Array.from(panel.querySelectorAll('.film-engine-grid,.film-module-grid,.film-course-footer,.film-learning-grid,.film-roadmap h4,.film-assistant-panel>p'))) {
      if(node.getBoundingClientRect().bottom>box.bottom-12*scale) add(node,'Contenido recortado');
    }
    const response=panel.querySelector('.film-response'), composer=panel.querySelector('.film-composer');
    if(response&&composer&&visible(response)&&response.getBoundingClientRect().bottom>composer.getBoundingClientRect().top-6*scale) add(response,'Se superpone al campo de entrada');
  }
  const current = Array.from(stage.querySelectorAll('.film-layer')).filter(visible).pop();
  const heading=current?.querySelector('.film-headline');
  if(heading&&visible(heading)) for(const window of Array.from(current!.querySelectorAll('.film-plane>.film-window'))) {
    if(!visible(window)) continue;
    const a=heading.getBoundingClientRect(),b=window.getBoundingClientRect();
    if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2*scale&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2*scale) add(heading,'Titular sobre la interfaz');
  }
  return [...new Set(issues)];
}
