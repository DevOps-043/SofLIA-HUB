import type { Film } from './film-schema';

/** Función pura compartida por la previsualización y el render; no carga recursos. */
export function filmFrameSvg(film: Film, frame: number): string {
  const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
  const text = (v: string, x: number, y: number, size: number, fill = '#EDF7FF', extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(v)}</text>`;
  const lines = (v: string, x: number, y: number, size: number, width: number, fill = '#EDF7FF') => {
    const rows: string[] = []; let row = '';
    for (const word of v.split(/\s+/).flatMap(token => token.match(new RegExp('.{1,' + Math.max(1, Math.floor(width / (size * .68))) + '}', 'g')) ?? [])) { if ((row + ' ' + word).trim().length * size * .59 > width && row) { rows.push(row); row = word; } else row = (row + ' ' + word).trim(); }
    rows.push(row); return rows.map((r, i) => text(r, x, y + i * size * 1.25, size, fill)).join('');
  };
  const f = Math.max(0, Math.min(film.fotogramas - 1, Math.floor(frame)));
  const i = film.escenas.findIndex(s => f >= s.inicio && f < s.fin);
  const scene = film.escenas[i]; const prev = film.escenas[i - 1];
  const raw = scene.transicion ? Math.min(1, (f - scene.inicio) / scene.transicion) : 1;
  const t = raw * raw * (3 - 2 * raw);
  const w = 1920, h = 1080;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${film.ancho}" height="${film.ancho * 9 / 16}" viewBox="0 0 ${w} ${h}"><defs><radialGradient id="luz"><stop stop-color="#123C53"/><stop offset="1" stop-color="#071119"/></radialGradient><linearGradient id="papel" x2="1" y2="1"><stop stop-color="#24465B"/><stop offset="1" stop-color="#102332"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#luz)"/><g font-family="Arial, sans-serif">`;
  for (let x = 0; x < w; x += 96) svg += `<path d="M${x} 0V1080" stroke="#57D3D0" opacity=".035"/>`;
  for (let y = 0; y < h; y += 96) svg += `<path d="M0 ${y}H1920" stroke="#57D3D0" opacity=".035"/>`;
  svg += text('SOFLIA / ESTUDIO AUDIOVISUAL', 90, 80, 22, '#70D8D1', 'letter-spacing="5"');
  svg += lines(scene.titulo, 90, 166, 52, 1750);
  const ids = new Set([...(prev?.entidades.map(p => p.id) ?? []), ...scene.entidades.map(p => p.id)]);
  for (const id of ids) {
    const end = scene.entidades.find(p => p.id === id); const start = prev?.entidades.find(p => p.id === id);
    const to = end ?? start!; const from = start ?? { ...to, y: to.y + .04 };
    const opacity = !end ? 1 - t : !start ? t : 1;
    if (!opacity) continue;
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const cw = lerp(from.ancho, to.ancho) * w, ch = lerp(from.alto, to.alto) * h;
    const cx = lerp(from.x, to.x) * w - cw / 2, cy = lerp(from.y, to.y) * h - ch / 2;
    const e = film.entidades.find(e => e.id === id)!;
    svg += `<g opacity="${opacity}" transform="translate(${cx} ${cy})">`;
    if (e.tipo === 'marca') {
      svg += `<circle cx="${cw / 2}" cy="${ch * .25}" r="62" fill="none" stroke="#70D8D1" stroke-width="8"/><path d="M${cw / 2 - 28} ${ch * .25}l20 22 42-48" fill="none" stroke="#EDF7FF" stroke-width="8"/>`;
      svg += text(e.titulo, cw / 2, ch * .58, Math.min(104, cw / (e.titulo.length * .62)), '#EDF7FF', 'text-anchor="middle" font-weight="700"');
      svg += text(e.detalle, cw / 2, ch * .78, Math.min(30, cw / (e.detalle.length * .62)), '#70D8D1', 'text-anchor="middle"');
    } else {
      svg += `<rect x="8" y="14" width="${cw}" height="${ch}" rx="26" fill="#020A10" opacity=".5"/><rect width="${cw}" height="${ch}" rx="26" fill="url(#papel)" stroke="#43718B"/><rect x="0" y="28" width="5" height="${ch - 56}" fill="#70D8D1"/>`;
      svg += lines(e.titulo, 26, 50, 32, cw - 52);
      svg += lines(e.detalle, 26, 132, 22, cw - 52, '#BDCED9');
      const cell = 42;
      e.etiquetas.forEach((label, n) => { const y = 252 + n * cell; svg += `<rect x="26" y="${y - 25}" width="${cw - 52}" height="${cell - 9}" rx="7" fill="#102332"/><circle cx="44" cy="${y - 7}" r="5" fill="#70D8D1"/>` + text(label, 60, y, Math.min(23, (cw - 82) / (label.length * .64))); });
    }
    svg += '</g>';
  }
  svg += text('INTERFACES CONCEPTUALES', 90, 1018, 20, '#AFC5D4');
  svg += text(`${i + 1} / ${film.escenas.length}`, 1830, 1018, 20, '#70D8D1', 'text-anchor="end"');
  svg += `<rect x="90" y="1040" width="${1740 * (i + 1) / film.escenas.length}" height="4" fill="#70D8D1"/></g></svg>`;
  return svg;
}
