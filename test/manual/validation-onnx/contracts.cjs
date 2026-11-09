const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { identityModel, detectionModel } = require('./models.cjs');

exports.runZipContracts = async directory => {
  const checks = [];
  const AdmZip = require('adm-zip');
  const payload = Buffer.from('binario-ficticio-no-ejecutable');
  const archive = new AdmZip(); archive.addFile('runtimes/win-x64/native/onnxruntime.dll', payload);
  const buffer = archive.toBuffer(); const zipPath = path.join(directory, 'paquete-propio.nupkg'); fs.writeFileSync(zipPath, buffer);
  const read = new AdmZip(zipPath), entry = read.getEntry('runtimes/win-x64/native/onnxruntime.dll');
  assert.ok(entry); assert.deepEqual(entry.getData(), payload);
  const output = path.join(directory, 'extracted'); fs.mkdirSync(output);
  assert.equal(read.extractEntryTo(entry, output, false, true), true);
  assert.deepEqual(fs.readFileSync(path.join(output, 'onnxruntime.dll')), payload);
  checks.push('api-de-extraccion-nuget-con-bytes-propios');

  const signature = Buffer.alloc(4); signature.writeUInt32LE(0x02014b50);
  const central = buffer.indexOf(signature); assert.ok(central >= 0);
  const corrupt = Buffer.from(buffer); const wrongCrc = (corrupt.readUInt32LE(central + 16) ^ 1) >>> 0;
  corrupt.writeUInt32LE(wrongCrc, central + 16); corrupt.writeUInt32LE(wrongCrc, 14);
  assert.throws(() => new AdmZip(corrupt).getEntries()[0].getData(), /CRC/);
  checks.push('crc-invalido-no-se-extrae-como-correcto');

  // Defensa del propio QA: jamás permitir una asignación grande, incluso si regresa el defecto.
  const excessive = Buffer.from(buffer); excessive.writeUInt32LE(128 * 1024 * 1024, central + 24); excessive.writeUInt32LE(128 * 1024 * 1024, 22);
  const original = Buffer.alloc; let trips = 0;
  Buffer.alloc = function (size, ...args) { if (size > 1024 * 1024) { trips++; throw new Error('Asignación excesiva bloqueada por QA.'); } return original(size, ...args); };
  try { assert.deepEqual(new AdmZip(excessive).getEntries()[0].getData(), payload); }
  finally { Buffer.alloc = original; }
  assert.equal(trips, 0); checks.push('tamano-declarado-no-provoca-asignacion-anticipada');

  const zeroSize = Buffer.from(buffer); zeroSize.writeUInt32LE(0, central + 24); zeroSize.writeUInt32LE(0, 22);
  assert.throws(() => new AdmZip(zeroSize).getEntries()[0].getData());
  checks.push('tamano-cero-no-desactiva-limite-de-inflado');
  let callbacks = 0;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('El error ZIP asíncrono no respondió.')), 2000);
    new AdmZip(zeroSize).getEntries()[0].getDataAsync((data, error) => {
      callbacks++; clearTimeout(timer);
      try { assert.ok(error); assert.equal(data.length, 0); resolve(); } catch (failure) { reject(failure); }
    });
  });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(callbacks, 1);
  checks.push('error-de-inflado-asincrono-entregado-una-vez');
  return checks;
};

exports.runContracts = async directory => {
  const checks = [];
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected.json'), 'utf8'));
  const versions = Object.fromEntries(['zod', 'onnxruntime-node', 'onnxruntime-common', 'adm-zip'].map(name =>
    [name, JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules', name, 'package.json'), 'utf8')).version]));
  assert.equal(versions.zod, expected.zod); assert.equal(versions['onnxruntime-node'], expected.onnx);
  assert.equal(versions['onnxruntime-common'], expected.onnx); assert.equal(versions['adm-zip'], expected.zip);
  checks.push('versiones-fisicas-coherentes');
  const { z } = require('zod');
  let visits = 0;
  assert.equal(z.array(z.number().superRefine(() => visits++)).max(2).safeParse(Array(1000).fill(1)).success, false);
  assert.equal(visits, 0); checks.push('coleccion-excesiva-no-valida-hijos');
  checks.push(...await exports.runZipContracts(directory));
  const ort = require('onnxruntime-node');
  const model = identityModel(); const modelPath = path.join(directory, 'identity.onnx'); fs.writeFileSync(modelPath, model);
  const session = await ort.InferenceSession.create(modelPath, { executionProviders: ['cpu'], intraOpNumThreads: 1, interOpNumThreads: 1 });
  try {
    assert.deepEqual(session.inputNames, ['X']); assert.deepEqual(session.outputNames, ['Y']);
    const result = await session.run({ X: new ort.Tensor('float32', Float32Array.from([1, -2, 3.5]), [1, 3]) });
    assert.deepEqual(result.Y.dims, [1, 3]); assert.deepEqual([...result.Y.data], [1, -2, 3.5]);
    checks.push('inferencia-identity-cpu-con-valores-y-forma');
    await assert.rejects(session.run({ X: new ort.Tensor('float32', Float32Array.from([1, 2]), [1, 2]) }));
    checks.push('inferencia-rechaza-forma-incompatible');
  } finally { await session.release(); }
  checks.push('sesion-de-inferencia-directa-liberada');
  await assert.rejects(ort.InferenceSession.create(Buffer.from([0, 1, 2]), { executionProviders: ['cpu'], intraOpNumThreads: 1 }));
  checks.push('modelo-invalido-rechazado');

  const sharp = require('sharp');
  const { createOnnxVisualParser } = require('./electron/desktop-agent/visual-parser/onnx-parser');
  const detectorPath = path.join(directory, 'detecciones-propias.onnx'); fs.writeFileSync(detectorPath, detectionModel());
  const parser = createOnnxVisualParser({ resolveModelPath: () => detectorPath, inputSize: 16 });
  assert.equal(parser.disponible(), true);
  const image = await sharp({ create: { width: 32, height: 16, channels: 3, background: '#336699' } }).png().toBuffer();
  for (let attempt = 0; attempt < 2; attempt++) {
    const boxes = await parser.detectar(image.toString('base64')); assert.equal(boxes.length, 1);
    assert.deepEqual([boxes[0].x0, boxes[0].y0, boxes[0].x1, boxes[0].y1], [8, 4, 24, 12]);
    assert.ok(Math.abs(boxes[0].score - 0.9) < 0.00001);
  }
  checks.push('parser-real-sharp-onnx-letterbox-decode-nms');
  const unavailable = createOnnxVisualParser({ resolveModelPath: () => null });
  assert.equal(unavailable.disponible(), false); assert.deepEqual(await unavailable.detectar(image.toString('base64')), []);
  checks.push('modelo-ausente-conserva-degradacion');
  return { status: 'passed', checks, versions, node: process.versions.node, electron: process.versions.electron ?? null,
    platform: process.platform, architecture: process.arch, cudaUsed: false, externalModelsUsed: false, realScreenshotsUsed: false };
};
