const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let app, directory;

async function main() {
  const mode = process.argv[2]; assert.ok(['node', 'electron'].includes(mode));
  directory = path.join(__dirname, 'qa-' + mode); fs.mkdirSync(directory);
  if (mode === 'electron') {
    const electron = require('electron'); app = electron.app;
    for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
      const target = path.join(directory, name); fs.mkdirSync(target); app.setPath(name, target);
    }
    app.disableHardwareAcceleration(); app.commandLine.appendSwitch('disable-background-networking');
    app.commandLine.appendSwitch('disable-component-update'); await app.whenReady();
    electron.session.defaultSession.webRequest.onBeforeRequest((_details, done) => done({ cancel: true }));
  }
  const deny = () => { throw new Error('Red externa bloqueada en QA documental.'); };
  require('node:http').get = deny; require('node:http').request = deny;
  require('node:https').get = deny; require('node:https').request = deny; globalThis.fetch = deny;
  const { runParserContracts, runDocumentContracts, runHubExportContract } = require('./contracts.cjs');
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected.json'), 'utf8'));
  const versions = Object.fromEntries(['exceljs', 'pptxgenjs', 'uuid', 'image-size'].map(name =>
    [name, JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules', name, 'package.json'), 'utf8')).version]));
  assert.deepEqual(versions, expected.versions);
  if (mode === 'electron') assert.equal(process.versions.electron, expected.electron);
  const { createEditablePptx } = require('./compiled/hub-pptx.cjs');
  const checks = [...await runParserContracts(directory), ...await runDocumentContracts(directory),
    ...await runHubExportContract(directory, createEditablePptx)];
  fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify({ status: 'passed', checks, versions,
    node: process.versions.node, electron: process.versions.electron ?? null, platform: process.platform, architecture: process.arch,
    realAccountsUsed: false, officeApplicationValidated: false, externalNetworkUsed: false }, null, 2));
  if (app) app.exit(0); else process.exit(0);
}
void main().catch(error => {
  if (directory && fs.existsSync(directory)) fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify({ status: 'failed', failure: String(error.message).slice(0, 500) }, null, 2));
  console.error('[Exportación nativa] Falló el contrato; revisar el temporal de QA.');
  if (app) app.exit(1); else process.exit(1);
});
