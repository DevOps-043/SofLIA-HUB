import fs from 'node:fs/promises';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';
import sharp from 'sharp';
import { z } from 'zod';
import { nodeConnector } from '../../src/shared/presentations/geometry';
import { legacySlidesSchema, legacySlideText } from './legacy';
import { parsePresentationDeck, type PresentationSlide } from '../../src/shared/presentations/deck-schema';
import type { SkillWorkspaceService } from '../skill-workspace/service';

const legacy = legacySlidesSchema;
const themeSchema = z.object({ colors: z.object({ bg: z.string().regex(/^#?[0-9a-f]{6}$/i).optional(), text: z.string().regex(/^#?[0-9a-f]{6}$/i).optional(), accent: z.string().regex(/^#?[0-9a-f]{6}$/i).optional() }).passthrough().optional(), fontHeading: z.string().max(80).optional(), fontBody: z.string().max(80).optional() }).passthrough();

/** Exportador único: texto, tablas, conectores y gráficas permanecen editables. */
export async function createEditablePptx(input: unknown, title: string, customTheme?: unknown, imagePath?: (relative: string) => Promise<string | null>): Promise<{ buffer: Buffer; slides: number }> {
  const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'SofLIA'; pptx.subject = title; pptx.title = title;
  const theme = customTheme === undefined ? {} : themeSchema.parse(customTheme);
  const parsed = Array.isArray(input) ? null : parsePresentationDeck(input);
  const palette = parsed?.meta.tema && parsed.meta.tema.origen !== 'organizacion' ? parsed.meta.tema : null;
  const bg = palette?.fondo.slice(1) ?? theme.colors?.bg?.replace('#', '') ?? '071119';
  const fg = palette?.texto.slice(1) ?? theme.colors?.text?.replace('#', '') ?? 'EDF7FF';
  const accent = palette?.acento.slice(1) ?? theme.colors?.accent?.replace('#', '') ?? '70D8D1';
  const content: Array<PresentationSlide | z.infer<typeof legacy>[number]> = parsed?.slides ?? legacy.parse(input);
  let count = 0;
  for (const item of content) {
    const native = 'tipo' in item && typeof item.tipo === 'string' && 'titulo' in item ? item as PresentationSlide : null;
    const old = item as z.infer<typeof legacy>[number];
    const textBody = native ? '' : legacySlideText(old);
    const pages = native ? [''] : String(textBody).match(/[\s\S]{1,650}/g) ?? [''];
    if (count + pages.length > 120) throw new Error('La presentación supera el límite de 120 diapositivas de salida; reduce o divide el contenido.');
    for (const page of pages) {
      const slide = pptx.addSlide(); count++;
      slide.background = { color: bg };
      slide.addShape(pptx.ShapeType.rect, { x: .65, y: .52, w: .07, h: .35, fill: { color: accent }, line: { color: accent } });
      slide.addText(native?.antetitulo ?? title, { x: .9, y: .5, w: 11.6, h: .35, fontSize: 12, color: accent, charSpacing: 2 });
      slide.addText(native?.titulo ?? String(old.title).slice(0, 180), { x: .7, y: 1.1, w: 11.9, h: 1.05, fontSize: 32, bold: true, color: fg, fontFace: theme.fontHeading ?? 'Arial', breakLine: false, margin: 0, valign: 'middle' });
      const addText = (text: string, x = .7, y = 2.5, w = 11.9, h = 3.8, size = 21) => slide.addText(text, { x, y, w, h, fontSize: size, color: fg, fontFace: theme.fontBody ?? 'Arial', margin: 0, valign: 'top', breakLine: false });
      if (native) { const intro = ('introduccion' in native ? native.introduccion : undefined) ?? ((['comparacion', 'proceso', 'metricas'].includes(native.tipo) || (native.tipo === 'division' && Boolean(native.bloques))) && 'texto' in native ? native.texto : undefined); if (intro) addText(intro, .7, 2.25, 11.9, .6, 17); const foot = [('pie' in native ? native.pie : ''), ('nota' in native ? native.nota : ''), ('unidad' in native ? native.unidad : ''), ('acento' in native ? native.acento : '')].filter(Boolean).join(' · '); if (foot) addText(foot, .7, 6.55, 11.9, .38, 12); }
      if (!native) addText(page);
      else if (native.tipo === 'tabla') slide.addTable([native.columnas, ...native.filas].map(row => row.map(text => ({ text }))), { x: .7, y: 3.0, w: 11.9, h: 3.4, border: { color: '365769', pt: 1 }, color: fg, fill: { color: bg }, fontSize: 17, margin: .12, autoPage: false });
      else if (native.tipo === 'diagrama') {
        const cols = Math.min(3, native.nodos.length), cardW = 3.5;
        const position = (index: number) => ({ x: .75 + index % cols * 4.05, y: 3.0 + Math.floor(index / cols) * 1.8 });
        for (const edge of native.conexiones) {
          const a = position(native.nodos.findIndex(n => n.id === edge.desde)), b = position(native.nodos.findIndex(n => n.id === edge.hasta));
          const { x1, x2, y1, y2 } = nodeConnector(a, b, cardW, 1.35, .08);
          slide.addShape(pptx.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(.001, Math.abs(x2 - x1)), h: Math.max(.001, Math.abs(y2 - y1)), flipH: x2 < x1, flipV: y2 < y1, line: { color: accent, width: 2, endArrowType: 'triangle' } });
        }
        native.nodos.forEach((n, i) => { const p = position(i); slide.addShape(pptx.ShapeType.roundRect, { ...p, w: cardW, h: 1.35, fill: { color: bg }, line: { color: accent, width: 1 } }); addText(n.titulo + '\n' + (n.texto ?? ''), p.x + .15, p.y + .15, cardW - .3, 1.1, 16); });
      } else if (native.tipo === 'grafica') {
        const type = native.tipoGrafica === 'anillo' ? pptx.ChartType.doughnut : native.tipoGrafica === 'barras' ? pptx.ChartType.bar : native.tipoGrafica === 'radar' ? pptx.ChartType.radar : native.tipoGrafica === 'area' ? pptx.ChartType.area : pptx.ChartType.line;
        slide.addChart(type, native.series.map(s => ({ name: s.nombre, labels: native.categorias, values: s.valores })), { x: .7, y: 3.0, w: 11.9, h: 3.4, showLegend: true, catAxisLabelColor: fg, valAxisLabelColor: fg, legendColor: fg, chartColors: [accent, '5B9CE6', 'F1BE62'], showValue: true });
      } else if (native.tipo === 'metricas') native.metricas.forEach((m, i) => { const w = 11.9 / native.metricas.length; addText(m.valor, .7 + i * w, 3.0, w - .2, .9, 40); addText(m.etiqueta + '\n' + (m.detalle ?? m.nota ?? ''), .7 + i * w, 3.95, w - .3, 1.8, 19); });
      else if (native.tipo === 'proceso') native.pasos.forEach((p, i) => { const w = 11.9 / native.pasos.length; addText(`${p.numero ?? i + 1}\n${p.titulo}\n${p.texto ?? ''}`, .7 + i * w, 3.0, w - .25, 3.5, 19); });
      else if (native.tipo === 'comparacion') {
        if (native.filas) slide.addTable(native.filas.map(f => [{ text: f.proyecto }, { text: f.enfoque }]), { x: .7, y: 3.0, w: 11.9, h: 3.4, fontSize: 18, color: fg, fill: { color: bg }, border: { color: accent, pt: 1 }, autoPage: false });
        else { addText([native.izquierda.titulo, native.izquierda.texto, ...(native.izquierda.puntos ?? [])].filter(Boolean).join('\n'), .7, 3.0, 5.6); addText([native.derecha.titulo, native.derecha.texto, ...(native.derecha.puntos ?? [])].filter(Boolean).join('\n'), 7, 3.0, 5.6); }
      } else if (native.tipo === 'cita') addText(native.citas ? native.citas.map(c => `“${c.texto}” — ${c.atribucion}`).join('\n\n') : `“${native.cita}”\n${native.autor}\n${native.cargo ?? ''}`, .9, 2.7, 11.5, 3.9, 24);
      else if (native.tipo === 'division' && native.bloques) native.bloques.forEach((b, i) => { const w = 11.9 / native.bloques!.length; addText([b.titulo, b.texto, ...(b.puntos ?? [])].filter(Boolean).join('\n'), .7 + i * w, 3.0, w - .3, 3.3, 19); });
      else addText([('subtitulo' in native ? native.subtitulo : ''), ('texto' in native ? native.texto : ''), ...('puntos' in native ? native.puntos ?? [] : []), ('accion' in native ? native.accion : '')].filter(Boolean).join('\n\n'), .7, 2.65, native && 'imagen' in native && native.imagen ? 6.2 : 11.9);
      if (native && 'imagen' in native && native.imagen) { if (!imagePath) throw new Error('La presentación declara imágenes pero esta ruta no tiene recursos del workspace. Usa el workspace de Presentaciones.'); const absolute = await imagePath(native.imagen.src); if (!absolute) throw new Error(`Falta ${native.imagen.src}.`); const visualSeparate = ['tabla', 'diagrama', 'grafica', 'metricas', 'proceso', 'comparacion', 'cita'].includes(native.tipo) || (native.tipo === 'division' && Boolean(native.bloques)); const target = visualSeparate ? pptx.addSlide() : slide; if (visualSeparate) { if (count >= 120) throw new Error('La presentación supera 120 diapositivas de salida.'); count++; target.background = { color: bg }; target.addText(native.titulo, { x: .7, y: .7, w: 11.9, h: 1, fontSize: 30, color: fg }); target.addNotes(JSON.stringify(native.imagen)); } const meta = await sharp(absolute).metadata(); const scale = Math.min(5.2 / (meta.width ?? 1), 3.9 / (meta.height ?? 1)); const w = (meta.width ?? 1) * scale, h = (meta.height ?? 1) * scale; target.addImage({ path: absolute, x: 7.2 + (5.2 - w) / 2, y: 2.6 + (3.9 - h) / 2, w, h }); }
      slide.addText(native?.fuente ?? 'SofLIA', { x: .7, y: 7, w: 11, h: .22, fontSize: 9, color: fg });
      slide.addText(String(count), { x: 12, y: 7, w: .6, h: .22, fontSize: 9, color: accent });
      slide.addNotes(JSON.stringify(item));
    }
  }
  const buffer = await pptx.write({ outputType: 'nodebuffer' }); if (!Buffer.isBuffer(buffer)) throw new Error('El exportador no devolvió un PPTX binario.');
  return { buffer, slides: count };
}


export async function exportWorkspacePptx(service: SkillWorkspaceService, id: string): Promise<void> {
  if ((await service.getWorkspace(id))?.skillId !== 'sistema:presentaciones') throw new Error('El workspace no pertenece a Presentaciones.');
  const source = await service.readFile(id, 'deck.json'); if (!source.ok) throw new Error(source.error);
  const brand = await service.readFile(id, 'estilos/marca.css');
  const color = (name: string) => brand.ok ? new RegExp('--marca-color-' + name + ':\\s*(#[0-9a-f]{6})', 'i').exec(brand.data)?.[1] : undefined;
  const theme = { colors: { bg: color('fondo'), text: color('texto'), accent: color('acento') } };
  const result = await createEditablePptx(JSON.parse(source.data), 'Presentación', theme, relative => service.resolveAbsolutePath(id, relative));
  const written = await service.writeSystemBinary(id, 'salida/presentacion.pptx', result.buffer); if (!written.ok) throw new Error(written.error);
}

export async function writeEditablePptx(input: unknown, title: string, output: string, theme?: unknown): Promise<number> {
  const result = await createEditablePptx(input, title, theme); await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, result.buffer); return result.slides;
}
