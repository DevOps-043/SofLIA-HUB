const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const profile = path.join(__dirname, 'profile');
app.setPath('userData', profile); app.setPath('sessionData', path.join(profile, 'session'));
app.disableHardwareAcceleration();
const ID = '12345678-1234-4123-8123-123456789012';
const checks = [];
let window, other;
app.whenReady().then(async () => {
  assert.equal(process.versions.electron, process.argv.at(-1));
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('file:') }));
  globalThis.fetch = () => { throw new Error('Red bloqueada en el smoke IPC.'); };
  const { setAuthState } = require('./electron/main/auth-state');
  const { registerProjectHubHandlers } = require('./electron/project-hub-handlers');
  setAuthState({ authenticated: true, userId: 'usuario-ficticio' });
  let registered, writes = 0, accept = false, hold = false, detail = '', release, entered;
  let observed;
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, handler) => handle(channel, async (...args) => {
    const result = await handler(...args); observed?.({ channel, result }); return result;
  });
  dialog.showMessageBox = async (_parent, options) => {
    assert.equal(options.defaultId, 0); assert.equal(options.cancelId, 0); detail = options.detail;
    return { response: accept ? 1 : 0, checkboxChecked: false };
  };
  const service = {
    getStatus: async auth => { auth.assertCurrent(); return { authenticated: true, workspaces: [{ id: ID, name: 'Workspace comprobado' }] }; },
    listProjects: async (_input, auth) => { auth.assertCurrent(); return { success: true, data: [] }; },
    getProject: async (_input, auth) => { auth.assertCurrent(); return { success: true, data: { project_id: ID, workspace_id: ID, project_name: 'Proyecto comprobado' } }; },
    uploadFiles: async (input, auth) => {
      auth.assertCurrent(); assert.deepEqual(input.paths, [path.join(__dirname, 'archivo-ficticio.txt')]);
      assert.equal(await auth.approve([{ name: 'archivo-ficticio.txt', mime_type: 'text/plain', size: 4, sha256: 'a'.repeat(64) }]), true);
      auth.assertCurrent(); return { success: true, data: { requested: 1, prepared: 1, stored: 1, uploaded: 1 } };
    },
    downloadFile: async (_input, auth) => {
      auth.assertCurrent();
      const destination = await auth.chooseDestination({ name: 'archivo-ficticio.txt', extension: 'txt', mime: 'text/plain', size: 4, sha256: 'a'.repeat(64), storagePath: 'ruta-main-ficticia' });
      auth.assertCurrent(); assert.equal(destination, path.join(__dirname, 'copia-ficticia.txt'));
      return { success: true, data: { saved: true, bytes: 4 } };
    },
    createProject: async (_input, auth) => {
      if (hold) { entered(); await new Promise(resolve => { release = resolve; }); }
      auth.assertCurrent(); writes++; return { success: true, data: { project_id: ID } };
    },
  };
  registerProjectHubHandlers(service, () => registered);
  const makeWindow = () => new BrowserWindow({ show: false, webPreferences: {
    sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'dist', 'preload.cjs'),
  } });
  window = makeWindow(); registered = window;
  const document = path.join(__dirname, 'dist', 'index.html');
  const alternate = path.join(__dirname, 'dist', 'other.html');
  await window.loadFile(document);
  const read = target => target.webContents.executeJavaScript(`window.projectHubApi.listProjects({workspaceId:${JSON.stringify(ID)}})`);
  const mutate = () => window.webContents.executeJavaScript(`window.projectHubApi.createProject({workspaceId:${JSON.stringify(ID)},project:{name:'Proyecto ficticio'}})`);
  const baseline = window.webContents.listenerCount('did-start-navigation');
  assert.equal((await read(window)).success, true);
  assert.equal(window.webContents.listenerCount('did-start-navigation'), baseline); checks.push('main-frame-autorizado');
  other = makeWindow(); await other.loadFile(document);
  assert.equal((await read(other)).success, false); checks.push('ventana-ajena-denegada');
  registered = null; assert.equal((await read(window)).success, false); registered = window;
  checks.push('ventana-ausente-denegada');
  const invalid = await window.webContents.executeJavaScript(`window.projectHubApi.createProject({workspaceId:${JSON.stringify(ID)},project:{name:'Prueba',admin:true}})`);
  assert.equal(invalid.code, 'INVALID_PAYLOAD'); assert.equal(writes, 0); checks.push('payload-ajeno-denegado');
  assert.equal((await mutate()).cancelled, true); assert.equal(writes, 0); checks.push('cancelacion-sin-escritura');
  accept = true; assert.equal((await mutate()).success, true); assert.equal(writes, 1);
  assert.ok(detail.includes('Workspace comprobado')); checks.push('aprobacion-simulada-con-destino');
  fs.writeFileSync(path.join(__dirname, 'archivo-ficticio.txt'), 'dato');
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path.join(__dirname, 'archivo-ficticio.txt')] });
  const upload = await window.webContents.executeJavaScript(`window.projectHubApi.uploadFiles({workspaceId:${JSON.stringify(ID)},projectId:${JSON.stringify(ID)},operationId:'32345678-1234-4123-8123-123456789012'})`);
  assert.equal(upload.success, true); assert.equal(upload.data.uploaded, 1);
  assert.ok(!JSON.stringify(upload).includes('archivo-ficticio')); checks.push('subida-nativa-sin-rutas-renderer');
  dialog.showSaveDialog = async (_parent, options) => {
    assert.equal(options.defaultPath, 'archivo-ficticio.txt');
    return { canceled: false, filePath: path.join(__dirname, 'copia-ficticia.txt') };
  };
  const download = await window.webContents.executeJavaScript(`window.projectHubApi.downloadFile({workspaceId:${JSON.stringify(ID)},projectId:${JSON.stringify(ID)},evidenceId:${JSON.stringify(ID)},operationId:'32345678-1234-4123-8123-123456789012'})`);
  assert.deepEqual(download, { success: true, data: { saved: true, bytes: 4 } });
  assert.ok(detail.includes('archivo-ficticio.txt')); assert.ok(!JSON.stringify(download).includes('ficticia'));
  assert.equal(await window.webContents.executeJavaScript(`'getDownload' in window.projectHubApi`), false);
  checks.push('descarga-nativa-sin-url-ruta-renderer');
  hold = true;
  const started = new Promise(resolve => { entered = resolve; });
  const result = new Promise(resolve => { observed = item => { if (item.channel === 'project-hub:create-project') resolve(item.result); }; });
  // La navegación destruye el contexto JS que inició executeJavaScript; la
  // evidencia de retorno se observa en main, sin esperar esa promesa retirada.
  void mutate().catch(() => undefined); await started;
  await window.loadFile(alternate); release();
  const discarded = await result;
  assert.equal(discarded.success, false); assert.equal(discarded.uncertain, true); assert.equal(writes, 1);
  assert.equal(window.webContents.listenerCount('did-start-navigation'), baseline); checks.push('navegacion-invalida-y-libera');
  assert.equal((await read(window)).success, false); checks.push('documento-ajeno-denegado');
  assert.ok(!Object.keys(require.cache).some(file => /(?:sofia-session|iris[\\/]clients|dotenv)/i.test(file)));
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify({ status: 'passed', electron: process.versions.electron,
    checks, hiddenWindows: true, profileIsolated: true, sandbox: true, contextIsolation: true,
    nativeIpc: true, serviceSimulated: true, dialogSimulated: true, networkBlocked: true, realCredentialsUsed: false }, null, 2));
  other.destroy(); window.destroy(); app.exit(0);
}).catch(error => { console.error('[IPC nativo] Comprobación fallida:', error.message); other?.destroy(); window?.destroy(); app.exit(1); });
