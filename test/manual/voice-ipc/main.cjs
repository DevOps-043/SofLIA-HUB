const { app, BrowserWindow, dialog, session } = require('electron');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
app.setPath('userData', path.join(__dirname, 'profile'));
app.setPath('sessionData', path.join(__dirname, 'profile', 'session'));
app.disableHardwareAcceleration();
let window, orb, other;
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('file:') }));
  globalThis.fetch = () => { throw new Error('Red bloqueada en QA de voz.'); };
  const { setAuthState } = require('./electron/main/auth-state');
  const { registerVoicePassiveHandlers } = require('./electron/voice-passive-handlers');
  const { registerOrbIpcHandlers } = require('./electron/orb-ipc-handlers');
  const checks = []; let accept = false, captures = 0, installs = 0, permission;
  const config = { enabled: false, wakeWords: ['soflia'], micDevice: null, ttsVoice: 'Aoede', ttsSpeed: 1 };
  let listening = false, sequence = 0;
  dialog.showMessageBox = async (_parent, options) => {
    assert.equal(options.defaultId, 0); assert.equal(options.cancelId, 0);
    return { response: accept ? 1 : 0, checkboxChecked: false };
  };
  const runtime = Object.assign(new EventEmitter(), {
    configureCaptureAuthorization: fn => { permission = fn; },
    getConfig: () => ({ ...config, wakeWords: [...config.wakeWords] }),
    getStatus: () => ({ runtimeAvailable: true, sidecarRunning: false, listening, enabled: config.enabled, pythonPath: 'privado-python', modelPath: 'privado-modelo',
      largeModelInstalled: false, modelDownloadProgress: null, ttsReady: true, ttsDownloadProgress: null, dictating: false, lastError: null }),
    setConfig: async updates => { Object.assign(config, updates); return config; },
    stop: async () => { listening = false; }, stopPassiveListening: async () => { listening = false; },
    startPassiveListening: async () => { permission('start_wake', {}); captures++; listening = true; return { success: true }; },
    startDictation: async created => { permission('start_dictation', {}); captures++; const id = `dictation-qa-${++sequence}`; created(id); return { success: true, sessionId: id }; },
    stopDictation: async () => {}, resumeWakeAfterConversation: async () => {}, stopSpeaking: async () => {},
    speak: async (_text, created) => { const id = `speech-qa-${++sequence}`; created(id); return { success: true, speechId: id }; },
    installModel: async () => { installs++; return { success: true }; }, installTtsVoice: async () => { installs++; return { success: true }; },
    listTtsVoices: () => [], listMicDevices: async () => ({ success: true, devices: [] }),
    probeMic: async device => { permission('mic_probe', { device, seconds: 3 }); captures++; return { success: true, rms: 0, peak: 0, hasSignal: false }; },
  });
  const makeWindow = () => new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'dist/preload.cjs') } });
  window = makeWindow(); orb = makeWindow(); other = makeWindow();
  const document = path.join(__dirname, 'dist/index.html');
  await Promise.all([window.loadFile(document), orb.loadFile(document), other.loadFile(document)]);
  const voice = registerVoicePassiveHandlers(runtime, () => window, () => orb);
  registerOrbIpcHandlers({ pythonRuntimeService: runtime, voiceSession: voice, getMainWindow: () => window, getOrbWindow: () => orb,
    showOrbWindow: async () => {}, consumePendingWake: () => false,
    announcements: { consumePending: () => null, finish: async () => {}, clear: () => {} } });
  const invoke = (win, expression) => win.webContents.executeJavaScript(expression);
  const status = () => invoke(window, 'window.voicePassive.getStatus()');
  assert.equal((await status()).success, false); assert.equal(captures, 0); checks.push('sin-sesion-denegado');
  setAuthState({ authenticated: true, userId: 'usuario-qa' });
  const result = await status(); assert.equal(result.status.modelInstalled, true); assert.ok(!JSON.stringify(result).includes('privado')); checks.push('estado-minimo');
  assert.equal((await invoke(other, 'window.voicePassive.start()')).success, false); checks.push('ventana-ajena-denegada');
  assert.equal((await invoke(window, 'window.voicePassive.setConfig({approved:true})')).success, false); checks.push('payload-ajeno-denegado');
  assert.equal((await invoke(window, 'window.voicePassive.installModel("invalido")')).success, false); assert.equal(installs, 0);
  assert.equal((await invoke(window, 'window.voicePassive.start()')).success, false); assert.equal(captures, 0); checks.push('cancelacion-sin-captura');
  accept = true;
  assert.equal((await invoke(window, 'window.voicePassive.start()')).success, true); assert.equal(captures, 1); checks.push('aprobacion-simulada');
  assert.equal((await invoke(window, 'window.voicePassive.listTtsVoices()')).success, true);
  assert.equal((await invoke(window, 'window.voicePassive.listMicDevices()')).success, true);
  assert.equal((await invoke(window, 'window.voicePassive.installModel("small")')).success, true);
  assert.equal((await invoke(window, 'window.voicePassive.installTtsVoice("es_MX-ald-medium")')).success, true);
  assert.equal((await invoke(window, 'window.voicePassive.stop()')).success, true);
  assert.equal((await invoke(window, 'window.voicePassive.testMic(null)')).success, true);
  assert.equal((await invoke(window, 'window.voicePassive.setConfig({ttsSpeed:1.2})')).success, true); checks.push('nueve-metodos-preload-ipc');
  assert.equal((await invoke(window, 'window.orb.startDictation()')).success, false);
  assert.equal((await invoke(orb, 'window.orb.startDictation()')).success, false); checks.push('dictado-rol-y-visibilidad');
  const deliveries = [];
  for (const [label, win] of [['main', window], ['orb', orb], ['ajena', other]]) {
    const send = win.webContents.send.bind(win.webContents);
    win.webContents.send = (channel, payload) => { deliveries.push({ label, channel, payload }); send(channel, payload); };
  }
  const speech = await invoke(window, 'window.orb.speak("Prueba ficticia")'); assert.equal(speech.success, true);
  runtime.emit('tts-chunk', { speechId: speech.speechId, audioBase64: 'ficticio' });
  assert.deepEqual(deliveries.map(item => item.label), ['main']); checks.push('audio-solo-consumidor');
  await window.loadFile(path.join(__dirname, 'dist/other.html'));
  runtime.emit('tts-chunk', { speechId: speech.speechId, audioBase64: 'tardio' });
  assert.equal(deliveries.length, 1); assert.equal((await status()).success, false); checks.push('navegacion-retira-destinatario');
  await window.loadFile(document);
  assert.equal((await invoke(window, 'window.voicePassive.start()')).success, true);
  setAuthState({ authenticated: true, userId: 'otra-cuenta' }); setAuthState({ authenticated: true, userId: 'usuario-qa' });
  assert.equal(voice.isApproved(), false); assert.throws(() => permission('start_wake', {})); checks.push('cambio-aba-revoca');
  let release, entered;
  const approval = new Promise(resolve => { entered = resolve; });
  dialog.showMessageBox = async () => { entered(); return new Promise(resolve => { release = resolve; }); };
  const before = captures; const pending = invoke(window, 'window.voicePassive.start()'); await approval;
  setAuthState({ authenticated: true, userId: 'otra-cuenta' }); release({ response: 1, checkboxChecked: false });
  assert.equal((await pending).success, false); assert.equal(captures, before); checks.push('aprobacion-tardia-denegada');
  assert.ok(!Object.keys(require.cache).some(file => /(?:sofia-session|dotenv|python-runtime-service)/i.test(file)));
  voice.dispose();
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify({ status: 'passed', electron: process.versions.electron, checks,
    nativeIpc: true, hiddenWindows: true, profileIsolated: true, sandbox: true, contextIsolation: true, serviceSimulated: true, dialogSimulated: true,
    realMicrophoneUsed: false, realModelsUsed: false, realCredentialsUsed: false, networkBlocked: true }, null, 2));
  window.destroy(); orb.destroy(); other.destroy(); app.exit(0);
}).catch(error => { console.error('[Voz IPC nativa] Falló:', error.message); window?.destroy(); orb?.destroy(); other?.destroy(); app.exit(1); });

