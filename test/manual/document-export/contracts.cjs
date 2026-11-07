const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');

const excelRequire = createRequire(require.resolve('exceljs'));
const pptxRequire = createRequire(require.resolve('pptxgenjs'));
const JSZip = pptxRequire('jszip');

exports.runParserContracts = async directory => {
  const checks = [];
  const uuid = excelRequire('uuid'); const esmUuid = await import('uuid');
  for (const api of [uuid, esmUuid]) {
    const ids = Array.from({ length: 8 }, () => api.v4());
    assert.equal(new Set(ids).size, 8); assert.ok(ids.every(id => api.validate(id) && api.version(id) === 4));
    assert.throws(() => api.v5('qa', api.v5.DNS, Buffer.alloc(1)), RangeError);
    assert.throws(() => api.v5('qa', api.v5.DNS, Buffer.alloc(16), -1), RangeError);
    const buffer = Buffer.alloc(16); assert.equal(api.v5('qa', api.v5.DNS, buffer), buffer);
    assert.equal(api.stringify(buffer), api.v5('qa', api.v5.DNS));
  }
  checks.push('uuid-cjs-esm-v4-y-bounds-v5');
  const imageApi = pptxRequire('image-size'); const esmImage = await import('image-size');
  const imageSize = imageApi.imageSize; assert.equal(typeof imageSize, 'function');
  const sharp = require('sharp');
  for (const format of ['png', 'jpeg']) {
    const buffer = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#336699' } })[format]().toBuffer();
    for (const api of [imageSize, esmImage.imageSize]) {
      const dimensions = api(buffer); assert.equal(dimensions.width, 3); assert.equal(dimensions.height, 2);
    }
    const file = path.join(directory, 'imagen.' + format); await fs.writeFile(file, buffer);
    const fromFile = pptxRequire('image-size/fromFile').imageSizeFromFile;
    const read = await fromFile(file); assert.equal(read.width, 3); assert.equal(read.height, 2);
  }
  checks.push('imagen-png-jpeg-cjs-esm-y-api-de-archivo');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"></svg>');
  assert.equal(imageSize(svg).width, 3); assert.equal(imageSize(svg).height, 2);
  assert.throws(() => imageSize(Buffer.from([0, 1, 2]))); checks.push('svg-y-formato-desconocido');
  const malformed = Buffer.alloc(16); malformed.write('icns'); malformed.writeUInt32BE(16, 4); malformed.write('icp4', 8);
  const original = Array.prototype.push; let pushes = 0, trips = 0, failure;
  // Sólo el QA síncrono: evita que una regresión consuma memoria antes de fallar.
  Array.prototype.push = function (...items) {
    if (++pushes > 32) { trips++; throw new Error('QA: parser sin progreso'); }
    return original.apply(this, items);
  };
  try { imageSize(malformed); } catch (error) { failure = error; }
  finally { Array.prototype.push = original; }
  assert.ok(failure instanceof Error); assert.equal(trips, 0);
  checks.push('icns-cero-rechazado-sin-activar-guarda');
  return checks;
};

exports.runDocumentContracts = async directory => {
  const checks = [];
  const ExcelJS = require('exceljs'), uuid = excelRequire('uuid');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Resumen español');
  sheet.addRows([[2, 3, { formula: 'A1+B1', result: 5 }], [4, 6, 'Información verificable'], [8, 9, 'Fin']]);
  for (const ref of ['A1:A3', 'B1:B3']) sheet.addConditionalFormatting({ ref, rules: [{ type: 'dataBar',
    cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF336699' }, gradient: false }] });
  const png = await require('sharp')({ create: { width: 3, height: 2, channels: 3, background: '#336699' } }).png().toBuffer();
  const image = workbook.addImage({ buffer: png, extension: 'png' }); sheet.addImage(image, 'E1:F3');
  const xlsx = Buffer.from(await workbook.xlsx.writeBuffer()); await fs.writeFile(path.join(directory, 'informe.xlsx'), xlsx);
  const zip = await JSZip.loadAsync(xlsx), xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const ids = [...xml.matchAll(/<x14:cfRule[^>]*id="\{([^}]+)\}"/g)].map(match => match[1]);
  assert.equal(ids.length, 2); assert.equal(new Set(ids).size, 2);
  for (const id of ids) { assert.equal(uuid.validate(id), true); assert.equal(uuid.version(id), 4); assert.ok(xml.includes(`<x14:id>{${id}}</x14:id>`)); }
  checks.push('xlsx-cf-extendido-con-ids-unicos-y-referencias');
  assert.ok(Object.keys(zip.files).some(name => name.startsWith('xl/media/')));
  const restored = new ExcelJS.Workbook(); await restored.xlsx.load(xlsx);
  const restoredSheet = restored.getWorksheet('Resumen español');
  assert.deepEqual(restoredSheet.getCell('C1').value, { formula: 'A1+B1', result: 5 });
  assert.equal(restoredSheet.getCell('C2').value, 'Información verificable'); assert.equal(restoredSheet.getImages().length, 1);
  assert.equal(restoredSheet.conditionalFormattings.length, 2); checks.push('xlsx-roundtrip-formula-unicode-imagen-y-cf');

  const PptxGenJS = require('pptxgenjs'); const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE';
  const slide = pptx.addSlide(); slide.addText('Información española', { x: 1, y: 1, w: 5, h: 1 });
  slide.addImage({ data: 'image/png;base64,' + png.toString('base64'), x: 1, y: 2, w: 3, h: 2 });
  slide.addChart(pptx.ChartType.bar, [{ name: 'Resultados', labels: ['Uno', 'Dos'], values: [2, 3] }], { x: 5, y: 2, w: 4, h: 3 });
  const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' }); assert.ok(Buffer.isBuffer(pptxBuffer));
  await fs.writeFile(path.join(directory, 'presentacion.pptx'), pptxBuffer);
  const deck = await JSZip.loadAsync(pptxBuffer);
  const slideXml = await deck.file('ppt/slides/slide1.xml').async('string');
  assert.ok(slideXml.includes('Información española')); assert.ok(slideXml.includes('<p:pic>')); assert.ok(slideXml.includes('chart'));
  assert.ok(Object.keys(deck.files).some(name => /^ppt\/media\/image.*\.png$/.test(name)));
  assert.ok(deck.file('ppt/charts/chart1.xml')); checks.push('pptx-imagen-texto-y-grafica-editable');
  const EsmPptx = (await import('pptxgenjs')).default; const esmDeck = new EsmPptx();
  esmDeck.addSlide().addText('Exportación ESM', { x: 1, y: 1, w: 5, h: 1 });
  const esmBuffer = await esmDeck.write({ outputType: 'nodebuffer' });
  const esmZip = await JSZip.loadAsync(esmBuffer);
  assert.ok((await esmZip.file('ppt/slides/slide1.xml').async('string')).includes('Exportación ESM'));
  checks.push('pptx-esm-conserva-generacion');
  const cjs = await fs.readFile(require.resolve('pptxgenjs'), 'utf8');
  assert.ok(!/require\(['"]image-size['"]\)/.test(cjs));
  checks.push('bundle-cjs-del-padre-sin-importar-image-size');

  const { Document, Paragraph, Packer } = require('docx');
  const word = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Informe español de QA')] }] }));
  await fs.writeFile(path.join(directory, 'informe.docx'), word);
  const document = await JSZip.loadAsync(word); assert.ok((await document.file('word/document.xml').async('string')).includes('Informe español de QA'));
  checks.push('word-conserva-texto-y-paquete-ooxml');
  return checks;
};

exports.runHubExportContract = async (directory, createEditablePptx) => {
  const result = await createEditablePptx([{ title: 'Informe del Hub', body: 'Información española' }], 'Informe');
  assert.equal(result.slides, 1); assert.ok(Buffer.isBuffer(result.buffer));
  await fs.writeFile(path.join(directory, 'hub.pptx'), result.buffer);
  const zip = await JSZip.loadAsync(result.buffer), xml = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.ok(xml.includes('Informe del Hub')); assert.ok(xml.includes('Información española'));
  assert.ok(zip.file('ppt/notesSlides/notesSlide1.xml'));
  await assert.rejects(createEditablePptx([], 'Inválido'));
  return ['exportador-real-del-hub-con-texto-notas-y-rechazo-vacio'];
};
