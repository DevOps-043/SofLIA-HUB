const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const nut = createRequire(require.resolve('@nut-tree-fork/nut-js/package.json'));

function peerContracts(overrides) {
  const checks = [];
  for (const [parent, peers] of [['@jimp/plugin-scale', ['@jimp/plugin-resize']], ['@jimp/plugin-shadow', ['@jimp/plugin-resize', '@jimp/plugin-blur']]]) {
    const fromParent = createRequire(nut.resolve(parent + '/package.json'));
    const parentVersion = fromParent(parent + '/package.json').version;
    for (const peer of peers) {
      assert.equal(fromParent(peer + '/package.json').version, parentVersion, parent + ' → ' + peer);
      assert.equal(overrides[parent + '@' + parentVersion]?.[peer], parentVersion, 'El cierre declarado debe coincidir con el peer físico.');
      assert.equal(typeof fromParent(peer), 'function', 'El plugin debe conservar la factoría de la API 0.22.');
      checks.push({ parent, peer, version: parentVersion });
    }
  }
  return checks;
}

async function jimpContracts(directory) {
  const checks = [], sharp = require('sharp');
  const pixels = Buffer.from([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 255, 255, 255, 255, 255]);
  for (const [name, owner] of [['nut', nut], ['shared', createRequire(nut.resolve('@nut-tree-fork/shared/package.json'))]]) {
    const Jimp = owner('jimp'); assert.equal(typeof Jimp, 'function');
    const image = new Jimp({ width: 2, height: 2, data: Buffer.from(pixels) });
    const png = await image.getBufferAsync(Jimp.MIME_PNG);
    assert.deepEqual(await sharp(png).ensureAlpha().raw().toBuffer(), pixels);
    const file = path.join(directory, name + '.png'); await fs.writeFile(file, png);
    for (const input of [png, file]) {
      const decoded = await Jimp.read(input); assert.equal(decoded.bitmap.width, 2); assert.equal(decoded.bitmap.height, 2);
      assert.deepEqual(decoded.bitmap.data, pixels);
    }
    const jpeg = await image.getBufferAsync(Jimp.MIME_JPEG), jpegMeta = await sharp(jpeg).metadata();
    assert.equal(jpegMeta.width, 2); assert.equal(jpegMeta.height, 2);
    checks.push(name + ': PNG conserva RGBA por buffer/archivo y JPEG conserva dimensiones');
    assert.equal(image.clone().scale(2).bitmap.width, 4);
    assert.equal(image.clone().resize(4, 3).bitmap.height, 3);
    assert.equal(image.clone().blur(1).bitmap.width, 2);
    assert.equal(image.clone().shadow({ size: 1, x: 0, y: 0, blur: 1 }).bitmap.height, 2);
    assert.throws(() => image.clone().resize('inválido', 2));
    await assert.rejects(() => Jimp.read(Buffer.from('imagen inválida de QA')));
    checks.push(name + ': scale/resize/blur/shadow conservan API posicional y rechazan entrada inválida');
  }
  return checks;
}

async function providerContracts(directory) {
  const { Image, ColorMode, imageToJimp } = nut('@nut-tree-fork/shared');
  const Reader = nut('./dist/lib/provider/io/jimp-image-reader.class.js').default;
  const Writer = nut('./dist/lib/provider/io/jimp-image-writer.class.js').default;
  const Processor = nut('./dist/lib/provider/image/jimp-image-processor.class.js').default;
  const pixels = Buffer.from([255, 0, 0, 255, 0, 0, 255, 255]);
  const image = new Image(2, 1, Buffer.from(pixels), 4, 'imagen-ficticia', 4, 8, ColorMode.RGB);
  const file = path.join(directory, 'proveedor.png'); await new Writer().store({ image, path: file });
  assert.deepEqual(await require('sharp')(file).ensureAlpha().raw().toBuffer(), pixels);
  const loaded = await new Reader().load(file);
  assert.equal(loaded.colorMode, ColorMode.BGR); assert.equal(loaded.width, 2); assert.equal(loaded.height, 1);
  assert.deepEqual(loaded.data, Buffer.from([0, 0, 255, 255, 255, 0, 0, 255]));
  const rgb = await loaded.toRGB(); assert.deepEqual(rgb.data, pixels);
  assert.deepEqual(imageToJimp(loaded).bitmap.data, pixels);
  const color = await new Processor().colorAt(loaded, { x: 0, y: 0 });
  assert.deepEqual([color.R, color.G, color.B, color.A], [255, 0, 0, 255]);
  await assert.rejects(() => new Processor().colorAt(loaded, { x: 2, y: 0 }));
  await assert.rejects(() => new Processor().colorAt(loaded, { x: -1, y: 0 }));
  const invalid = path.join(directory, 'inválida.png'); await fs.writeFile(invalid, 'datos ficticios inválidos');
  await assert.rejects(() => new Reader().load(invalid));
  return ['lector/escritor reales conservan PNG y orden RGB/BGR', 'conversión compartida y colorAt conservan píxel RGBA', 'proveedores rechazan archivo inválido y coordenadas fuera de rango'];
}

module.exports = { peerContracts, jimpContracts, providerContracts };
