// Cargar la biblioteca al recolectar: el plazo del caso mide E/S y contenido, no su importación fría.
import 'exceljs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { ArtifactViewerService } from '../artifact-viewer';
import { readArtifactPreview } from '../artifact-viewer/read-preview';
import { assertOfficeLimits } from '../artifact-viewer/office-limits';
import { bindArtifactNavigation } from '../artifact-viewer/navigation';
import type { ViewerFile } from '../../src/shared/artifact-viewer';

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Carpeta temporal fuera de alcance.');
    await fs.rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-viewer-')); roots.push(root);
  const file = path.join(root, 'propuesta.md'); await fs.writeFile(file, '# Propuesta\n\n**Idea** completa.');
  let token = 1;
  const authorize = vi.fn(async () => {});
  const hash = createHash('sha256').update(await fs.readFile(file)).digest('hex');
  const teamFile = vi.fn(async () => ({ file, hash }));
  const service = new ArtifactViewerService({ authorize, contextToken: () => token, teamFile });
  return { file, service, authorize, teamFile, change: () => { token++; } };
}
const metadata = (extension: string): ViewerFile => ({ reference: { kind: 'local', id: randomUUID() }, name: 'ejemplo.' + extension, bytes: 100, extension });
describe('Visor local de entregables', () => {
  it('lee archivos del equipo con hash y referencias cerradas', async () => {
    const test = await fixture(); const reference = { kind: 'team' as const, jobId: randomUUID(), artifactId: randomUUID() };
    expect(await test.service.preview(reference)).toMatchObject({ name: 'propuesta.md', content: { kind: 'markdown', text: expect.stringContaining('**Idea**') } });
    expect(test.teamFile).toHaveBeenCalledWith(reference.jobId, reference.artifactId);
    await fs.writeFile(test.file, 'Archivo sustituido');
    await expect(test.service.preview(reference)).rejects.toThrow('El archivo cambió');
  });
  it('revoca selección nativa al cambiar contexto y no devuelve lecturas tardías', async () => {
    const test = await fixture(); const selected = await test.service.selected(test.file, 1);
    expect(JSON.stringify(selected)).not.toContain(test.file);
    test.change(); await expect(test.service.preview(selected.reference)).rejects.toThrow('Selecciona el archivo');
    const next = await fixture();
    next.teamFile.mockImplementation(async () => { next.change(); return { file: next.file, hash: '' }; });
    await expect(next.service.preview({ kind: 'team', jobId: randomUUID(), artifactId: randomUUID() })).rejects.toThrow();
  });
  it('rechaza referencias desconocidas, formatos ejecutables y archivos alterados', async () => {
    const test = await fixture();
    await expect(test.service.preview({ kind: 'local', id: randomUUID() })).rejects.toThrow();
    const executable = path.join(path.dirname(test.file), 'programa.exe'); await fs.writeFile(executable, 'MZ');
    await expect(test.service.selected(executable, 1)).rejects.toThrow('Este formato');
    const selected = await test.service.selected(test.file, 1); await fs.writeFile(test.file, 'Nuevo contenido');
    await expect(test.service.preview(selected.reference)).rejects.toThrow('El archivo cambió');
  });
  it('rechaza archivos mayores al límite sin leer su contenido', async () => {
    const test = await fixture(); const handle = await fs.open(test.file, 'w'); await handle.truncate(20_000_001); await handle.close();
    await expect(test.service.selected(test.file, 1)).rejects.toThrow('mayor a 20 MB');
  });
  it('representa Word con títulos y párrafos sin interpretar su HTML en el renderer', async () => {
    const { Document, Packer, Paragraph, HeadingLevel } = await import('docx');
    const document = new Document({ sections: [{ children: [new Paragraph({ text: 'Propuesta final', heading: HeadingLevel.HEADING_1 }), new Paragraph('Contenido del documento')] }] });
    const result = await readArtifactPreview(metadata('docx'), await Packer.toBuffer(document));
    expect(result).toMatchObject({ content: { kind: 'document', text: expect.stringContaining('<h1>Propuesta final</h1>') } });
  });
  it('representa varias hojas y resultados guardados de fórmulas sin evaluarlas', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Presupuesto');
    sheet.addRow(['Concepto', 'Importe']); sheet.addRow(['Diseño', 250]); sheet.getCell('B3').value = { formula: 'SUM(B2:B2)', result: 250 };
    workbook.addWorksheet('Notas').addRow(['Dato', '<script>alert(1)</script>']);
    const result = await readArtifactPreview(metadata('xlsx'), Buffer.from(await workbook.xlsx.writeBuffer()));
    expect(result).toMatchObject({ content: { kind: 'spreadsheet', sheets: [{ name: 'Presupuesto', rows: [['Concepto', 'Importe'], ['Diseño', '250'], ['', '250']] }, { name: 'Notas' }] } });
  });
  it('lee CSV delimitado por punto y coma y limita filas de la vista', async () => {
    const buffer = Buffer.from('Nombre;Importe\n"Idea; otra";10\n' + 'Otra;20\n'.repeat(520));
    const result = await readArtifactPreview(metadata('csv'), buffer);
    if (result.content.kind !== 'spreadsheet') throw new Error('Tipo de vista incorrecto.');
    expect(result.content.sheets[0].rows[1]).toEqual(['Idea; otra', '10']);
    expect(result.content.sheets[0].rows).toHaveLength(500); expect(result.content.truncated).toBe(true);
  });
  it('detecta el delimitador CSV ignorando separadores y comillas escapadas dentro de campos', async () => {
    const result = await readArtifactPreview(metadata('csv'), Buffer.from('"Apellidos, nombre, ""cargo""";Importe\n"Pérez, Ana, diseño";20'));
    expect(result).toMatchObject({ content: { kind: 'spreadsheet', sheets: [{ rows: [['Apellidos, nombre, "cargo"', 'Importe'], ['Pérez, Ana, diseño', '20']] }] } });
  });
  it('rechaza PDF falso y ZIP Office truncado o con expansión manipulada', async () => {
    await expect(readArtifactPreview(metadata('pdf'), Buffer.from('HTML que no es PDF'))).rejects.toThrow('PDF válido');
    expect(() => assertOfficeLimits(Buffer.from('Office inválido'))).toThrow();
    const ExcelJS = (await import('exceljs')).default; const book = new ExcelJS.Workbook(); book.addWorksheet('Datos').addRow([1]);
    const buffer = Buffer.from(await book.xlsx.writeBuffer()); const directory = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    buffer.writeUInt32LE(32_000_001, directory + 24);
    expect(() => assertOfficeLimits(buffer)).toThrow();
  });
  it('bloquea navegación externa de srcdoc sin cambiar el visor de presentaciones', () => {
    const on = vi.fn(); const off = vi.fn(); const unbind = bindArtifactNavigation({ webContents: { on, off, isDestroyed: () => false } } as never);
    const guard = on.mock.calls[0][1];
    const preventDefault = vi.fn(); guard({ frame: { url: 'about:srcdoc' }, url: 'https://example.com/robo', preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce(); preventDefault.mockClear();
    guard({ frame: { url: 'pulse-presentacion://deck/index.html' }, url: 'pulse-presentacion://deck/style.css', preventDefault });
    expect(preventDefault).not.toHaveBeenCalled(); unbind(); expect(off).toHaveBeenCalledOnce();
  });
  it('rechaza entradas ZIP ocultas por un recuento falso y directorios multidisco', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const book = new ExcelJS.Workbook(); book.addWorksheet('Datos').addRow([1]);
    const original = Buffer.from(await book.xlsx.writeBuffer());
    const end = original.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const forgedCount = Buffer.from(original); forgedCount.writeUInt16LE(1, end + 8); forgedCount.writeUInt16LE(1, end + 10);
    expect(() => assertOfficeLimits(forgedCount)).toThrow('sin validar');
    const forgedSize = Buffer.from(original); forgedSize.writeUInt32LE(46, end + 12);
    expect(() => assertOfficeLimits(forgedSize)).toThrow('incoherente');
    const multiDisk = Buffer.from(original); multiDisk.writeUInt16LE(1, end + 4);
    expect(() => assertOfficeLimits(multiDisk)).toThrow('incoherente');
    expect(() => assertOfficeLimits(original)).not.toThrow();
  });
  it('sirve HTML desde loopback con CSP propia y revoca el acceso al cambiar de contexto', async () => {
    const test = await fixture(); const file = path.join(path.dirname(test.file), 'demo.html');
    await fs.writeFile(file, '<button onclick="this.textContent=1">0</button>');
    try {
      const selected = await test.service.selected(file, 1);
      const preview = await test.service.preview(selected.reference);
      if (preview.content.kind !== 'html' || !preview.content.url) throw new Error('Vista HTML ausente.');
      const response = await fetch(preview.content.url);
      expect(response.status).toBe(200); expect(await response.text()).toContain('onclick');
      expect(response.headers.get('content-security-policy')).toContain("sandbox allow-scripts; default-src 'none'");
      expect(response.headers.get('content-security-policy')).toContain("connect-src 'none'");
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
      expect((await fetch(preview.content.url, { method: 'POST' })).status).toBe(404);
      expect((await fetch(new URL('/desconocido', preview.content.url))).status).toBe(404);
      test.change(); expect((await fetch(preview.content.url)).status).toBe(403);
    } finally { test.service.clear(); }
  });
  it('abrir fuera utiliza una instantánea de los bytes verificados aunque cambie la ruta original', async () => {
    const test = await fixture(); const selected = await test.service.selected(test.file, 1);
    const source = await test.service.resolve(selected.reference);
    await fs.writeFile(test.file, 'Contenido sustituido');
    try {
      const copy = await test.service.externalCopy(source);
      expect(copy).not.toBe(test.file); expect(await fs.readFile(copy)).toEqual(source.buffer);
    } finally { test.service.clear(); }
  });
  it('publica Word con origen propio de lectura y scripts denegados por encabezado', async () => {
    const test = await fixture(); const { Document, Packer, Paragraph } = await import('docx');
    const file = path.join(path.dirname(test.file), 'documento.docx');
    await fs.writeFile(file, await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Documento comprobado' + 'x'.repeat(199400) + 'FINAL_VISIBLE')] }] })));
    try {
      const selected = await test.service.selected(file, 1); const preview = await test.service.preview(selected.reference);
      if (preview.content.kind !== 'document' || !preview.content.url) throw new Error('Falta vista de documento.');
      const response = await fetch(preview.content.url);
      expect(response.status).toBe(200); const text = await response.text(); expect(text).toContain('Documento comprobado'); expect(text).toContain('FINAL_VISIBLE');
      expect(preview.content.truncated).toBe(false);
      expect(response.headers.get('content-security-policy')).toContain("sandbox; default-src 'none'; script-src 'none'");
      expect(response.headers.get('content-security-policy')).not.toContain('allow-scripts');
    } finally { test.service.clear(); }
  });
});
