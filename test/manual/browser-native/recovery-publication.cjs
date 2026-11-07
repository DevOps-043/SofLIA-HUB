const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/** Disco real del sandbox; fallos limitados a esta llamada síncrona y restaurados en finally. */
module.exports = function exerciseRecoveryPublication({ sandbox, load, check }) {
  const root = path.join(sandbox, 'policies', 'sync-publication'); fs.mkdirSync(root);
  const file = path.join(root, 'fixture.bin'), data = Buffer.from([0, 255, 1, 0]);
  const { publishRecoveryFile } = load('recovery-file-publication');
  const guard = () => {};
  publishRecoveryFile(file, data, guard, true); assert.deepEqual(fs.readFileSync(file), data);
  publishRecoveryFile(file, Buffer.from('siguiente'), guard); assert.equal(fs.readFileSync(file, 'utf8'), 'siguiente');
  assert.deepEqual(fs.readdirSync(root), ['fixture.bin']);
  check('publicación síncrona: creación exclusiva y reemplazo conservan bytes y retiran temporales reales');

  assert.throws(() => publishRecoveryFile(file, data, guard, true));
  assert.equal(fs.readFileSync(file, 'utf8'), 'siguiente'); assert.deepEqual(fs.readdirSync(root), ['fixture.bin']);
  check('publicación síncrona: destino exclusivo ocupado permanece intacto');

  const sync = fs.fsyncSync; let current = true;
  try {
    fs.fsyncSync = fd => { sync(fd); current = false; };
    assert.throws(() => publishRecoveryFile(file, data, () => { if (!current) throw new Error('Revisión ficticia revocada'); }));
  } finally { fs.fsyncSync = sync; }
  assert.equal(fs.readFileSync(file, 'utf8'), 'siguiente'); assert.deepEqual(fs.readdirSync(root), ['fixture.bin']);
  check('publicación síncrona: revocación después de fsync impide reemplazo');

  const primary = Object.assign(new Error('Error primario ficticio'), { code: 'EIO' });
  const secondary = Object.assign(new Error('Error secundario ficticio'), { code: 'EACCES' });
  const close = fs.closeSync, warn = console.warn; const warnings = [];
  try {
    console.warn = (...args) => { warnings.push(args); };
    fs.fsyncSync = () => { throw primary; };
    fs.closeSync = fd => { close(fd); throw secondary; };
    assert.throws(() => publishRecoveryFile(file, data, guard), error => error === primary);
  } finally { fs.fsyncSync = sync; fs.closeSync = close; console.warn = warn; }
  assert.equal(warnings.length, 1); assert.equal(JSON.stringify(warnings).includes(JSON.stringify(root).slice(1, -1)), false);
  assert.equal(fs.readFileSync(file, 'utf8'), 'siguiente'); assert.deepEqual(fs.readdirSync(root), ['fixture.bin']);
  check('publicación síncrona: fallo doble de fsync/cierre preserva identidad y no publica');

  const rename = fs.renameSync, unlink = fs.unlinkSync; warnings.length = 0;
  try {
    console.warn = (...args) => { warnings.push(args); };
    fs.renameSync = () => { throw primary; }; fs.unlinkSync = () => { throw secondary; };
    assert.throws(() => publishRecoveryFile(file, data, guard), error => error === primary);
  } finally { fs.renameSync = rename; fs.unlinkSync = unlink; console.warn = warn; }
  assert.equal(fs.readFileSync(file, 'utf8'), 'siguiente'); assert.equal(warnings.length, 1);
  assert.equal(JSON.stringify(warnings).includes(JSON.stringify(root).slice(1, -1)), false);
  const leftovers = fs.readdirSync(root).filter(name => name.startsWith('fixture.bin.') && name.endsWith('.tmp'));
  assert.equal(leftovers.length, 1); assert.deepEqual(fs.readFileSync(path.join(root, leftovers[0])), data);
  fs.unlinkSync(path.join(root, leftovers[0]));
  check('publicación síncrona: fallo doble de rename/limpieza conserva causa, principal y residuo observado');
};
