const { app, BrowserWindow, dialog, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
app.setPath('userData', path.join(__dirname, 'profile')); app.setPath('sessionData', path.join(__dirname, 'profile/session')); app.setPath('temp', __dirname);
app.disableHardwareAcceleration(); let window, other;
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('file:') }));
  globalThis.fetch = () => { throw new Error('Red bloqueada en QA documental.'); };
  const { setAuthState } = require('./electron/main/auth-state');
  const { registerPythonToolsHandlers } = require('./electron/python-tools-handlers');
  const { PythonPrivacyStore } = require('./electron/python/privacy-store');
  const store = new PythonPrivacyStore(() => path.join(__dirname, 'profile/privacy-config.json'));
  const checks = []; let parses = 0, accept = false, release, entered;
  const original = path.join(__dirname, 'ficticio.pdf'); fs.writeFileSync(original, '%PDF-1.7\ncontenido ficticio');
  const runtime = { getPrivacyConfig: () => store.get(), setPrivacyConfig: value => store.set(value), capturePrivacyContext: () => store.capture(), stop: async () => {},
    getStatus: () => ({ available: false, running: false, privacy: store.get(), lastError: 'ruta-privada', privatePath: 'no-publicar' }),
    parseDocument: async file => { parses++; assert.notEqual(file, original); assert.deepEqual(fs.readFileSync(file), fs.readFileSync(original)); if (entered) { entered(); await new Promise(resolve => { release = resolve; }); } return { success: true, data: { markdown: 'Contenido ficticio', tables: [], metadata: { format: 'pdf' } } }; },
    redactText: async () => ({ success: true, data: { redacted: '[EMAIL]', entities: [], redactedCount: 0, engine: 'soflia-regex-mx' } }),
    releaseDocumentCopy: async remove => { await remove(); return true; } };
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [original] });
  dialog.showMessageBox = async (_parent, options) => { assert.equal(options.defaultId, 0); assert.equal(options.cancelId, 0); return { response: accept ? 1 : 0, checkboxChecked: false }; };
  const make = () => new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'dist/preload.cjs') } });
  window = make(); other = make(); await Promise.all([window.loadFile(path.join(__dirname, 'dist/index.html')), other.loadFile(path.join(__dirname, 'dist/index.html'))]);
  const registration = registerPythonToolsHandlers(runtime, () => window);
  const invoke = expression => window.webContents.executeJavaScript(expression);
  assert.equal((await invoke('window.pythonTools.getStatus()')).success, false); checks.push('sin-sesion-denegado');
  setAuthState({ authenticated: true, userId: 'qa-A' });
  const status = await invoke('window.pythonTools.getStatus()'); assert.equal(status.success, true); assert.ok(!JSON.stringify(status).includes('privada')); assert.ok(!JSON.stringify(status).includes('no-publicar')); checks.push('estado-proyectado');
  assert.equal((await other.webContents.executeJavaScript('window.pythonTools.parseDocument()')).success, false); assert.equal(parses, 0); checks.push('ventana-ajena-denegada');
  assert.equal((await invoke('window.pythonTools.parseDocument("C:/ruta-ajena.pdf")')).success, false); assert.equal(parses, 0); checks.push('ruta-renderer-denegada');
  assert.equal((await invoke('window.pythonTools.setPrivacyConfig({redactDocuments:"true"})')).success, false); checks.push('schema-cerrado');
  const parsed = await invoke('window.pythonTools.parseDocument()'); assert.equal(parsed.success, true); assert.equal(parses, 1); assert.ok(!JSON.stringify(parsed).includes(__dirname)); assert.ok(!fs.readdirSync(__dirname).some(name => name.startsWith('soflia-document-'))); checks.push('snapshot-estable-y-limpio');
  assert.equal((await invoke('window.pythonTools.redactText("correo ficticio")')).success, true);
  assert.equal((await invoke('window.pythonTools.getPrivacyConfig()')).success, true); checks.push('cinco-metodos-preload-ipc');
  assert.equal((await invoke('window.pythonTools.setPrivacyConfig({redactDocuments:true})')).success, true);
  assert.equal((await invoke('window.pythonTools.setPrivacyConfig({redactDocuments:false})')).cancelled, true); assert.equal(store.get().redactDocuments, true); checks.push('cancelar-desactivacion-no-escribe');
  accept = true; assert.equal((await invoke('window.pythonTools.setPrivacyConfig({redactDocuments:false})')).success, true); checks.push('confirmacion-nativa-simulada');
  const started = new Promise(resolve => { entered = resolve; }); const pending = invoke('window.pythonTools.parseDocument()'); await started;
  setAuthState({ authenticated: true, userId: 'qa-B' }); setAuthState({ authenticated: true, userId: 'qa-A' }); release(); assert.equal((await pending).success, false); checks.push('sesion-aba-descarta-lectura');
  await window.loadFile(path.join(__dirname, 'dist/other.html')); assert.equal((await invoke('window.pythonTools.getStatus()')).success, false); checks.push('documento-ajeno-denegado');
  assert.ok(!Object.keys(require.cache).some(file => /(?:sofia-session|dotenv|python-tools-service|python-runtime-service)/i.test(file)));
  registration.dispose(); fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify({ status: 'passed', electron: process.versions.electron, checks,
    nativeIpc: true, serviceSimulated: true, dialogSimulated: true, profileIsolated: true, realUserDocumentsUsed: false, realCredentialsUsed: false, networkBlocked: true }, null, 2));
  window.destroy(); other.destroy(); app.exit(0);
}).catch(error => { console.error('[Documentos IPC nativo] Falló:', error.message); window?.destroy(); other?.destroy(); app.exit(1); });
