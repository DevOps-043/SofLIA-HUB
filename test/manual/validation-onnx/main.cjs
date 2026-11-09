const fs = require('node:fs');
const path = require('node:path');
const { runContracts } = require('./contracts.cjs');
const mode = process.argv[2];
if (!['node', 'electron'].includes(mode)) throw new Error('Modo de QA desconocido.');
const directory = path.join(__dirname, 'qa-' + mode); fs.mkdirSync(directory);
const denyNetwork = () => { throw new Error('Red externa no permitida en este QA.'); };
require('node:http').request = denyNetwork; require('node:http').get = denyNetwork;
require('node:https').request = denyNetwork; require('node:https').get = denyNetwork;
globalThis.fetch = denyNetwork;
let app;
async function run() {
  try {
    const report = await runContracts(directory);
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    if (app) app.exit(0); else process.exit(0);
  } catch (error) {
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify({ status: 'failed', failure: String(error.message).slice(0, 500) }, null, 2));
    console.error('[Validación nativa] Falló el contrato; revisar el temporal de QA.');
    if (app) app.exit(1); else process.exit(1);
  }
}
if (mode === 'electron') {
  const electron = require('electron'); app = electron.app;
  for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
    const target = path.join(directory, name); fs.mkdirSync(target); app.setPath(name, target);
  }
  app.disableHardwareAcceleration(); app.commandLine.appendSwitch('disable-background-networking');
  app.commandLine.appendSwitch('disable-component-update');
  app.whenReady().then(() => { electron.session.defaultSession.webRequest.onBeforeRequest((_details, done) => done({ cancel: true })); return run(); });
} else { void run(); }
