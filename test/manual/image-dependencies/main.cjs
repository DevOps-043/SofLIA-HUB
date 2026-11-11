const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mode = process.argv[2];
assert.ok(['node', 'electron'].includes(mode));
assert.equal(process.argv.length, 3);
const directory = path.join(__dirname, mode); fs.mkdirSync(directory);
const deny = () => { throw new Error('Red bloqueada en QA de imágenes.'); };
require('node:http').get = deny; require('node:http').request = deny;
require('node:https').get = deny; require('node:https').request = deny; globalThis.fetch = deny;

async function main() {
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected.json'), 'utf8'));
  if (mode === 'electron') assert.equal(process.versions.electron, expected.electron);
  else assert.equal(process.versions.electron, undefined);
  assert.equal(require('sharp').versions.sharp, expected.sharp);
  const { peerContracts, jimpContracts, providerContracts } = require('./contracts.cjs');
  const peers = peerContracts(expected.overrides);
  const checks = [...peers, ...await jimpContracts(directory), ...await providerContracts(directory)];
  const artifacts = fs.readdirSync(directory).map(file => ({ file, bytes: fs.statSync(path.join(directory, file)).size }));
  fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify({ status: 'passed', checks, artifacts,
    node: process.versions.node, electron: process.versions.electron ?? null, platform: process.platform,
    architecture: process.arch, electronRunAsNode: mode === 'electron', browserWindowCreated: false,
    desktopCapturedOrControlled: false, data: 'Imágenes sintéticas propias; HTTP(S)/fetch bloqueados.' }, null, 2));
}
void main().catch(error => {
  fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify({ status: 'failed', error: String(error.message).slice(0, 400) }, null, 2));
  console.error('[Imágenes] Falló el contrato; revisar reporte temporal.'); process.exitCode = 1;
});
