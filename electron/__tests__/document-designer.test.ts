import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { createProfessionalDocument } from '../document-designer';
import { parseDocumentContent, splitTableRow, tableColumnWidths } from '../document-designer/content-model';
import { buildDocumentHtml } from '../document-designer/html-document';
import { documentDesignSchema, documentHeaderText } from '../../src/shared/document-design';
import { readArtifactPreview } from '../artifact-viewer/read-preview';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true }))); });
async function generated(content: string, extra: Partial<Parameters<typeof createProfessionalDocument>[0]> = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-document-design-')); directories.push(directory);
  const outputPath = path.join(directory, 'documento.docx');
  await createProfessionalDocument({ title: 'Propuesta de activación', content, type: 'word', outputPath, ...extra });
  const bytes = await fs.readFile(outputPath); const zip = unzipSync(bytes);
  return { bytes, xml: strFromU8(zip['word/document.xml']), styles: strFromU8(zip['word/styles.xml']), zip, outputPath };
}
describe('Diseño predeterminado de documentos', () => {
  it('un documento breve conserva el contenido con título semántico y sin portada duplicada', async () => {
    const result = await generated('# Propuesta de activación\n\n## Idea central\n\nUna **idea clara** para los clientes.');
    expect(result.xml.match(/Propuesta de activación/g)).toHaveLength(1);
    expect(result.xml).toContain('w:pStyle w:val="Title"');
    expect(result.xml).toContain('w:keepNext'); expect(result.xml).not.toContain('w:pageBreakBefore');
    expect(result.xml).not.toContain('━'); expect(result.xml).not.toContain('**idea clara**');
    expect(result.xml).toContain('idea clara'); expect(result.styles).toContain('w:color w:val="000000"');
    expect(result.xml).toContain('w:w="12240" w:h="15840"');
    const preview = await readArtifactPreview({ reference: { kind: 'local', id: 'prueba' }, name: 'documento.docx', bytes: result.bytes.length, extension: 'docx' }, result.bytes);
    expect(preview.content).toMatchObject({ kind: 'document', text: expect.stringContaining('<h1 class="document-title"><strong>Propuesta de activación</strong></h1>') });
  });
  it('respeta portada explícita y ajustes de skill, pero rechaza CSS o fuentes no admitidas antes de escribir', async () => {
    const result = await generated('Texto breve.\n\n| Campo | Valor |\n| --- | --- |\n| Color | Personalizado |', { includeCover: true, design: { preset: 'formal', fontFamily: 'Arial', accentColor: '00d4b3' } });
    expect(result.xml).toContain('w:pageBreakBefore'); expect(result.xml).toContain('w:titlePg'); expect(result.styles).toContain('w:ascii="Arial"');
    expect(result.xml).toContain('w:fill="00D4B3"');
    await expect(createProfessionalDocument({ title: 'Prueba', content: 'Texto', outputPath: result.outputPath + '.nuevo', type: 'word', design: { accentColor: 'red;url(x)' } })).rejects.toThrow();
    await expect(fs.access(result.outputPath + '.nuevo')).rejects.toThrow();
    expect(documentDesignSchema.safeParse({ fontFamily: 'https://externo' }).success).toBe(false);
    expect(documentDesignSchema.safeParse({ css: 'body{}' }).success).toBe(false);
  });
  it('un informe extenso usa portada automática y permite desactivarla', async () => {
    const content = 'Informe con contenido completo. '.repeat(220);
    expect((await generated(content)).xml).toContain('w:pageBreakBefore');
    expect((await generated(content, { includeCover: false })).xml).not.toContain('w:pageBreakBefore');
  });
  it('conserva celdas vacías, barras escapadas y anchos proporcionales con cabecera repetida', async () => {
    const result = await generated('| ID | Descripción | Estado |\n| --- | --- | --- |\n| 1 | Una descripción bastante extensa para asegurar un ancho legible | |\n| 2 | | Listo |');
    expect(splitTableRow('| 2 | | Listo |')).toEqual(['2', '', 'Listo']);
    expect(splitTableRow('| A\\|B | `a|b` | |')).toEqual(['A|B', '`a|b`', '']);
    const widths = tableColumnWidths(['ID', 'Descripción'], [['1', 'Una descripción larga de la actividad']], 9360);
    expect(widths[1]).toBeGreaterThan(widths[0]); expect(widths.reduce((sum, value) => sum + value, 0)).toBe(9360);
    expect(result.xml).toContain('w:tblHeader'); expect(result.xml).toContain('w:fill="243746"'); expect(result.xml).toContain('w:color="D9D9D9"');
    const rows = [...result.xml.matchAll(/<w:tr>([\s\S]*?)<\/w:tr>/g)];
    expect(rows).toHaveLength(3); expect([...rows[2][1].matchAll(/<w:tc>/g)]).toHaveLength(3);
  });
  it('listas anidadas y código permanecen bloques distintos', () => {
    const blocks = parseDocumentContent('- Primero\n  - Segundo\n\n```ts\n# literal\n| no | tabla |\n```\n\nPárrafo\ncon continuación');
    expect(blocks).toMatchObject([{ kind: 'list', level: 0 }, { kind: 'list', level: 1 }, { kind: 'code', text: '# literal\n| no | tabla |' }, { kind: 'paragraph', text: 'Párrafo con continuación' }]);
  });
  it('Word conserva el primer ordinal de listas independientes y la sangría de las anidadas', async () => {
    const result = await generated('3. Primer paso\n4. Segundo paso\n\n## Otro proceso\n\n7. Nuevo comienzo\n\n- Nivel uno\n  - Nivel dos');
    const numbering = strFromU8(result.zip['word/numbering.xml']);
    expect(numbering).toContain('w:start w:val="3"'); expect(numbering).toContain('w:start w:val="7"');
    expect(result.xml).toContain('w:left="720" w:hanging="260"');
  });
  it('PDF escapa texto hostil y comparte título, tablas y listas con Word', () => {
    const html = buildDocumentHtml({ title: '<script>alert(1)</script>', content: '## Resumen\n\n<img src="https://externo">\n\n1. Una opción\n2. Otra opción\n\n| Nombre | Estado |\n| --- | --- |\n| A | |\n\n[Link](javascript:alert)' });
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).not.toContain('<img src=');
    expect(html).toContain('<thead>'); expect(html).toContain('<td style="text-align:left"></td>');
    expect(html).toContain('<ol start="1">'); expect(html).not.toContain('href="javascript:');
    expect(html).toContain("default-src 'none'"); expect(html).toContain('size:Letter');
    expect(documentHeaderText('00D4B3')).toBe('000000'); expect(documentHeaderText('243746')).toBe('FFFFFF');
  });
});
