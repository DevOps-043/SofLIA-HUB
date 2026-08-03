// =============================================================================
// Pulse Hub - PythonRuntimeService
// =============================================================================
// Gestiona el runtime Python embebido que se distribuye con el instalador
// (ver scripts/setup-python-runtime.js) y el sidecar de voz pasiva local
// (python/sidecar/main.py). Comunicacion por NDJSON sobre stdin/stdout.
//
// Feature flag: la escucha pasiva viene DESACTIVADA por defecto y se controla
// desde userData/voice-passive.json ({ enabled, wakeWords, modelPath }).
// Evento principal: 'wake-word' → el bootstrap abre Flow Mode.
// =============================================================================
import { EventEmitter } from 'node:events';
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { app } from 'electron';
import https from 'node:https';
import path from 'node:path';
import fs from 'node:fs';

export interface VoicePassiveConfig {
  enabled: boolean;
  wakeWords: string[];
  modelPath?: string;
  micDevice?: string | number | null;
  /** Voz Piper para el TTS local de la orbe (id del catalogo). */
  ttsVoice: string;
  /** Velocidad de habla (0.5-2.0). */
  ttsSpeed: number;
}

export interface TtsVoiceInfo {
  id: string;
  label: string;
  installed: boolean;
}

export interface MicDeviceInfo {
  index: number;
  name: string;
  default: boolean;
}

export interface PythonRuntimeStatus {
  runtimeAvailable: boolean;
  sidecarRunning: boolean;
  listening: boolean;
  enabled: boolean;
  pythonPath: string;
  modelPath: string | null;
  /** true si el modelo grande (~1.4GB, mejor precision) esta instalado. */
  largeModelInstalled: boolean;
  /** Porcentaje 0-100 mientras se descarga el modelo; null si no hay descarga. */
  modelDownloadProgress: number | null;
  /** Estado del TTS local (Piper). */
  ttsReady: boolean;
  ttsDownloadProgress: number | null;
  dictating: boolean;
  lastError: string | null;
}

export interface DictationStartResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

export interface DictationEventPayload {
  sessionId: string;
  text?: string;
  reason?: string;
}

export interface SpeechStartResult {
  success: boolean;
  speechId?: string;
  error?: string;
}

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

const DEFAULT_CONFIG: VoicePassiveConfig = {
  enabled: false,
  wakeWords: ['soflia', 'oye soflia'],
  micDevice: null,
  // Voz Gemini (misma del modo Live del chat). Piper local es solo respaldo offline.
  ttsVoice: 'Aoede',
  ttsSpeed: 1.0,
};

// Modelos Vosk español: small (39MB, rapido) y large (~1.4GB, mucha mejor
// precision — WER ~7% vs ~12%). Si el grande esta instalado, se usa siempre.
const VOSK_MODELS = {
  small: { dir: 'vosk-model-small-es-0.42' },
  large: { dir: 'vosk-model-es-0.42' },
} as const;
export type VoskModelSize = keyof typeof VOSK_MODELS;
const voskModelUrl = (size: VoskModelSize) => `https://alphacephei.com/vosk/models/${VOSK_MODELS[size].dir}.zip`;
// El modelo grande tarda en cargar (~1.5GB en RAM): timeout amplio para el arranque.
const MODEL_START_TIMEOUT_MS = 90_000;

// Piper TTS: binario standalone (MIT) + voces en español (MIT). Debe coincidir
// con el catalogo de scripts/install-piper-voice.js.
const PIPER_BIN_URL = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';
const PIPER_HF_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';
const PIPER_VOICES: Record<string, { path: string; label: string }> = {
  'es_MX-claude-high': { path: 'es/es_MX/claude/high/es_MX-claude-high', label: 'Claude (México, alta calidad)' },
  'es_MX-ald-medium': { path: 'es/es_MX/ald/medium/es_MX-ald-medium', label: 'Ald (México)' },
  'es_ES-davefx-medium': { path: 'es/es_ES/davefx/medium/es_ES-davefx-medium', label: 'Davefx (España)' },
  'es_ES-sharvard-medium': { path: 'es/es_ES/sharvard/medium/es_ES-sharvard-medium', label: 'Sharvard (España)' },
};
const COMMAND_TIMEOUT_MS = 10_000;
const MAX_RESTARTS = 3;

function hasContent(filePath: string): boolean {
  try { return fs.statSync(filePath).size > 0; } catch { return false; }
}

export class PythonRuntimeService extends EventEmitter {
  private config: VoicePassiveConfig = { ...DEFAULT_CONFIG };
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private listening = false;
  private restarts = 0;
  private stopping = false;
  private lastError: string | null = null;
  private stdoutBuffer = '';
  private modelDownloadProgress: number | null = null;
  private ttsDownloadProgress: number | null = null;
  private dictating = false;
  private wakeSuspended = false;
  private activeDictationSessionId: string | null = null;
  private dictationSequence = 0;
  private dictationStartPromise: Promise<DictationStartResult> | null = null;
  private activeSpeechId: string | null = null;
  private speechSequence = 0;

  async init(): Promise<void> {
    this.loadConfig();
    if (!this.isRuntimeAvailable()) {
      console.log('[PythonRuntime] Runtime Python no encontrado. Ejecuta "npm run python:setup" (dev) o reinstala la app.');
      return;
    }
    console.log(`[PythonRuntime] Runtime Python disponible: ${this.getPythonPath()}`);
    if (this.config.enabled) {
      await this.startPassiveListening();
    }
  }

  async startPassiveListening(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.listening) return { success: true };
      if (this.activeDictationSessionId || this.dictating) {
        return { success: false, error: 'El dictado activo conserva el uso exclusivo del microfono.' };
      }
      const modelPath = this.resolveWakeModelPath();
      if (!modelPath) {
        const msg = 'Modelo Vosk no encontrado. Ejecuta "npm run python:install-vosk-model" o descargalo a userData/models.';
        this.lastError = msg;
        return { success: false, error: msg };
      }
      await this.ensureSidecar();
      // Timeout amplio: el modelo grande tarda en cargar la primera vez.
      const res = await this.sendCommand('start_wake', {
        model_path: modelPath,
        wake_words: this.config.wakeWords,
        device: this.config.micDevice ?? null,
        // Precarga en segundo plano el modelo del dictado: sin esto, la primera
        // peticion perdia las palabras iniciales mientras Vosk lo cargaba.
        preload_dictation_model: this.resolveDictationModelPath() ?? '',
      }, MODEL_START_TIMEOUT_MS);
      if (res.ok !== true) {
        const msg = String(res.error ?? 'El sidecar rechazo start_wake');
        this.lastError = msg;
        return { success: false, error: msg };
      }
      this.listening = true;
      this.lastError = null;
      console.log(`[PythonRuntime] Escucha pasiva activa. Wake words: ${this.config.wakeWords.join(', ')}`);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.lastError = msg;
      console.error(`[PythonRuntime] Error iniciando escucha pasiva: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async stopPassiveListening(): Promise<void> {
    if (!this.proc) { this.listening = false; return; }
    try {
      await this.sendCommand('stop_wake', {});
    } catch { /* el sidecar puede haber muerto; el kill de stop() cubre este caso */ }
    this.listening = false;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const proc = this.proc;
    this.activeDictationSessionId = null;
    this.activeSpeechId = null;
    this.dictating = false;
    if (!proc) return;
    try {
      await this.sendCommand('shutdown', {}, 2_000);
    } catch { /* forzamos kill abajo */ }
    if (!proc.killed) proc.kill();
    this.proc = null;
    this.listening = false;
    this.wakeSuspended = false;
  }

  getConfig(): VoicePassiveConfig {
    return { ...this.config, wakeWords: [...this.config.wakeWords] };
  }

  async setConfig(partial: Partial<VoicePassiveConfig>): Promise<VoicePassiveConfig> {
    const wasListening = this.listening;
    this.config = { ...this.config, ...partial };
    this.saveConfig();
    if (wasListening) {
      await this.stopPassiveListening();
      if (this.config.enabled) await this.startPassiveListening();
    } else if (this.config.enabled && this.isRuntimeAvailable()) {
      await this.startPassiveListening();
    }
    return this.getConfig();
  }

  getStatus(): PythonRuntimeStatus {
    return {
      runtimeAvailable: this.isRuntimeAvailable(),
      sidecarRunning: this.proc !== null,
      listening: this.listening,
      enabled: this.config.enabled,
      pythonPath: this.getPythonPath(),
      modelPath: this.resolveModelPath(),
      largeModelInstalled: this.resolveModelPathFor('large') !== null,
      modelDownloadProgress: this.modelDownloadProgress,
      ttsReady: this.resolvePiperPaths() !== null,
      ttsDownloadProgress: this.ttsDownloadProgress,
      dictating: this.dictating,
      lastError: this.lastError,
    };
  }

  // ── Dictado libre (Vosk sin gramatica) ─────────────────────────────────────

  /**
   * Inicia un unico dictado libre y devuelve el ID propietario de sus eventos.
   * Llamadas simultaneas comparten la misma promesa: nunca crean dos listeners.
   */
  async startDictation(): Promise<DictationStartResult> {
    if (this.dictationStartPromise) return this.dictationStartPromise;
    if (this.activeDictationSessionId && this.dictating) {
      return { success: true, sessionId: this.activeDictationSessionId };
    }

    const operation = this.startDictationTransaction();
    this.dictationStartPromise = operation;
    try {
      return await operation;
    } finally {
      if (this.dictationStartPromise === operation) this.dictationStartPromise = null;
    }
  }

  private async startDictationTransaction(): Promise<DictationStartResult> {
    // El dictado usa el modelo grande si esta instalado (sin gramatica: aprovecha
    // toda su precision); el wake word se queda con el pequeño.
    const modelPath = this.resolveDictationModelPath();
    if (!modelPath) {
      return { success: false, error: 'Modelo Vosk no encontrado. Descargalo desde Configuracion → Voz.' };
    }

    const sessionId = this.createDictationSessionId();
    const shouldRestoreWakeOnFailure = this.listening || this.wakeSuspended;
    this.activeDictationSessionId = sessionId;
    this.dictating = true;
    if (this.listening) {
      this.wakeSuspended = true;
      this.listening = false;
    }

    try {
      await this.ensureSidecar();
      const response = await this.sendCommand('start_dictation', {
        model_path: modelPath,
        device: this.config.micDevice ?? null,
        session_id: sessionId,
      }, MODEL_START_TIMEOUT_MS);
      if (response.ok !== true) {
        throw new Error(String(response.error ?? 'El sidecar rechazo start_dictation'));
      }
      if (this.activeDictationSessionId !== sessionId) {
        return { success: false, error: 'La sesion de dictado fue reemplazada antes de iniciar.' };
      }
      this.lastError = null;
      return { success: true, sessionId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.activeDictationSessionId === sessionId) {
        this.activeDictationSessionId = null;
        this.dictating = false;
      }
      this.lastError = message;
      if (shouldRestoreWakeOnFailure) {
        this.wakeSuspended = false;
        if (this.config.enabled) await this.startPassiveListening();
      }
      return { success: false, error: message };
    }
  }

  /** Detiene solo la sesion solicitada; un cleanup viejo no puede matar la nueva. */
  async stopDictation(sessionId?: string | null): Promise<void> {
    const activeSessionId = this.activeDictationSessionId;
    if (sessionId && activeSessionId !== sessionId) return;
    if (!activeSessionId) return;

    // Invalidar antes del await hace inocuos los eventos que ya estaban en vuelo.
    this.activeDictationSessionId = null;
    this.dictating = false;
    if (!this.proc) return;
    try {
      await this.sendCommand('stop_dictation', { session_id: activeSessionId });
    } catch { /* el sidecar pudo morir; la sesion ya esta invalidada */ }
  }

  /**
   * Reanuda wake solo si no existe una sesion mas nueva. `force` se reserva para
   * el cierre explicito de la ventana desde main.
   */
  async resumeWakeAfterConversation(sessionId?: string | null, force = false): Promise<void> {
    const activeSessionId = this.activeDictationSessionId;
    if (!force && activeSessionId && activeSessionId !== sessionId) return;
    if (activeSessionId) await this.stopDictation(activeSessionId);
    this.dictating = false;
    if (!this.wakeSuspended && this.listening) return;
    this.wakeSuspended = false;
    if (this.config.enabled) await this.startPassiveListening();
  }

  private createDictationSessionId(): string {
    this.dictationSequence += 1;
    return `dictation-${process.pid}-${Date.now().toString(36)}-${this.dictationSequence.toString(36)}`;
  }

  // ── TTS local (Piper) ──────────────────────────────────────────────────────

  /** Sintetiza texto con Piper; el audio llega como eventos 'tts-chunk'. */
  async speak(text: string): Promise<SpeechStartResult> {
    const speechId = this.createSpeechId();
    this.activeSpeechId = speechId;
    try {
      const paths = this.resolvePiperPaths();
      if (!paths) {
        this.activeSpeechId = null;
        return { success: false, error: 'Piper TTS no instalado. Descarga la voz desde Configuracion → Voz.' };
      }
      await this.ensureSidecar();
      const res = await this.sendCommand('tts_speak', {
        text,
        voice_path: paths.voicePath,
        piper_exe: paths.piperExe,
        utterance_id: speechId,
        speed: this.config.ttsSpeed,
      });
      if (res.ok !== true) {
        if (this.activeSpeechId === speechId) this.activeSpeechId = null;
        return { success: false, error: String(res.error ?? 'El sidecar rechazo tts_speak') };
      }
      if (this.activeSpeechId !== speechId) {
        return { success: false, error: 'La sintesis fue reemplazada antes de iniciar.' };
      }
      return { success: true, speechId };
    } catch (error) {
      if (this.activeSpeechId === speechId) this.activeSpeechId = null;
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async stopSpeaking(speechId?: string | null): Promise<void> {
    const activeSpeechId = this.activeSpeechId;
    if (speechId && activeSpeechId !== speechId) return;
    if (!activeSpeechId) return;
    this.activeSpeechId = null;
    if (!this.proc) return;
    try {
      await this.sendCommand('tts_stop', { utterance_id: activeSpeechId });
    } catch { /* no critico */ }
  }

  private createSpeechId(): string {
    this.speechSequence += 1;
    return `speech-${process.pid}-${Date.now().toString(36)}-${this.speechSequence.toString(36)}`;
  }

  // ── Dispositivos de microfono ──────────────────────────────────────────────

  /** Lista los microfonos disponibles (via sounddevice en el sidecar). */
  async listMicDevices(): Promise<{ success: boolean; devices?: MicDeviceInfo[]; error?: string }> {
    try {
      await this.ensureSidecar();
      const res = await this.sendCommand('list_devices', {});
      if (res.ok !== true) return { success: false, error: String(res.error ?? 'No se pudieron listar los microfonos.') };
      return { success: true, devices: (res.devices as MicDeviceInfo[]) ?? [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Captura ~3s del microfono indicado y mide si hay señal de voz. */
  async probeMic(device: string | number | null): Promise<{ success: boolean; rms?: number; peak?: number; hasSignal?: boolean; error?: string }> {
    try {
      await this.ensureSidecar();
      const res = await this.sendCommand('mic_probe', { device, seconds: 3 }, 15_000);
      if (res.ok !== true) return { success: false, error: String(res.error ?? 'No se pudo probar el microfono.') };
      return {
        success: true,
        rms: Number(res.rms ?? 0),
        peak: Number(res.peak ?? 0),
        hasSignal: res.has_signal === true,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  listTtsVoices(): TtsVoiceInfo[] {
    return Object.entries(PIPER_VOICES).map(([id, info]) => ({
      id,
      label: info.label,
      installed: this.resolveVoicePath(id) !== null,
    }));
  }

  /** Descarga el binario Piper (si falta) y la voz indicada a userData/models/piper. */
  async installTtsVoice(voiceId: string): Promise<{ success: boolean; error?: string }> {
    const voiceInfo = PIPER_VOICES[voiceId];
    if (!voiceInfo) return { success: false, error: `Voz desconocida: ${voiceId}` };
    if (this.ttsDownloadProgress !== null) {
      return { success: false, error: 'Ya hay una descarga de voz en curso.' };
    }
    this.ttsDownloadProgress = 0;
    const piperDir = path.join(app.getPath('userData'), 'models', 'piper');
    try {
      fs.mkdirSync(piperDir, { recursive: true });
      const piperExe = path.join(piperDir, 'piper', 'piper.exe');
      if (!fs.existsSync(piperExe)) {
        console.log('[PythonRuntime] Descargando binario Piper...');
        const zipPath = path.join(piperDir, 'piper-bin.download.zip');
        await this.downloadFile(PIPER_BIN_URL, zipPath, 0, (p) => { this.ttsDownloadProgress = Math.round(p * 0.2); });
        await new Promise<void>((resolve, reject) => {
          execFile('powershell', ['-NoProfile', '-Command',
            `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${piperDir}" -Force`],
          (err) => (err ? reject(err) : resolve()));
        });
        fs.rmSync(zipPath, { force: true });
        if (!fs.existsSync(piperExe)) throw new Error('La extraccion no produjo piper.exe');
      }
      const onnxPath = path.join(piperDir, `${voiceId}.onnx`);
      console.log(`[PythonRuntime] Descargando voz Piper '${voiceId}'...`);
      await this.downloadFile(`${PIPER_HF_BASE}/${voiceInfo.path}.onnx?download=true`, onnxPath, 0,
        (p) => { this.ttsDownloadProgress = 20 + Math.round(p * 0.78); });
      await this.downloadFile(`${PIPER_HF_BASE}/${voiceInfo.path}.onnx.json?download=true`, `${onnxPath}.json`, 0);
      console.log('[PythonRuntime] Voz Piper instalada.');
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.lastError = msg;
      return { success: false, error: msg };
    } finally {
      this.ttsDownloadProgress = null;
    }
  }

  private resolveVoicePath(voiceId: string): string | null {
    const candidates = [
      path.join(app.getPath('userData'), 'models', 'piper', `${voiceId}.onnx`),
      path.join(app.getAppPath(), 'models', 'piper', `${voiceId}.onnx`),
    ];
    for (const candidate of candidates) {
      if (hasContent(candidate) && hasContent(`${candidate}.json`)) return candidate;
    }
    return null;
  }

  private resolvePiperPaths(): { piperExe: string; voicePath: string } | null {
    // config.ttsVoice guarda la voz Gemini; para el respaldo offline se usa la
    // primera voz Piper local instalada (si existe alguna).
    const voicePath = Object.keys(PIPER_VOICES)
      .map((voiceId) => this.resolveVoicePath(voiceId))
      .find((candidate): candidate is string => candidate !== null) ?? null;
    if (!voicePath) return null;
    const exeCandidates = [
      path.join(app.getPath('userData'), 'models', 'piper', 'piper', 'piper.exe'),
      path.join(app.getAppPath(), 'models', 'piper', 'piper', 'piper.exe'),
    ];
    for (const piperExe of exeCandidates) {
      if (fs.existsSync(piperExe)) return { piperExe, voicePath };
    }
    return null;
  }

  /** Descarga el modelo Vosk español indicado (small ~39MB / large ~1.4GB). */
  async installModel(size: VoskModelSize = 'small'): Promise<{ success: boolean; error?: string }> {
    const modelDir = VOSK_MODELS[size]?.dir;
    if (!modelDir) return { success: false, error: `Modelo desconocido: ${String(size)}` };
    // El wake word SIEMPRE necesita el modelo pequeño (el grande no soporta
    // gramaticas en runtime): asegurarlo antes de traer el grande.
    if (size === 'large' && !this.resolveModelPathFor('small')) {
      const smallResult = await this.installModel('small');
      if (!smallResult.success) return smallResult;
    }
    if (this.resolveModelPathFor(size)) return { success: true };
    if (this.modelDownloadProgress !== null) {
      return { success: false, error: 'Ya hay una descarga del modelo en curso.' };
    }
    this.modelDownloadProgress = 0;
    const modelsDir = path.join(app.getPath('userData'), 'models');
    const zipPath = path.join(modelsDir, `${modelDir}.download.zip`);
    try {
      fs.mkdirSync(modelsDir, { recursive: true });
      console.log(`[PythonRuntime] Descargando modelo Vosk (${size}) desde ${voskModelUrl(size)}...`);
      await this.downloadFile(voskModelUrl(size), zipPath, 0, (p) => { this.modelDownloadProgress = p; });
      console.log('[PythonRuntime] Extrayendo modelo Vosk...');
      await new Promise<void>((resolve, reject) => {
        // Expand-Archive exige extension .zip; bsdtar no maneja rutas "C:\" locales.
        execFile('powershell', ['-NoProfile', '-Command',
          `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${modelsDir}" -Force`],
        (err) => (err ? reject(err) : resolve()));
      });
      if (!fs.existsSync(path.join(modelsDir, modelDir, 'conf'))) {
        throw new Error('La extraccion del modelo no produjo el directorio esperado.');
      }
      console.log(`[PythonRuntime] Modelo Vosk (${size}) instalado correctamente.`);
      // Reiniciar la escucha para que tome el modelo recien instalado (el
      // grande tiene prioridad en resolveModelPath).
      if (this.config.enabled) {
        await this.stopPassiveListening();
        void this.startPassiveListening();
      }
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.lastError = msg;
      console.error(`[PythonRuntime] Error instalando modelo Vosk: ${msg}`);
      return { success: false, error: msg };
    } finally {
      fs.rmSync(zipPath, { force: true });
      this.modelDownloadProgress = null;
    }
  }

  private downloadFile(url: string, dest: string, redirects: number, onProgress?: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (redirects > 5) { reject(new Error(`Demasiadas redirecciones para ${url}`)); return; }
      const file = fs.createWriteStream(dest);
      https.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.rmSync(dest, { force: true });
          // La redireccion puede ser relativa (HuggingFace): resolver contra el origen.
          const nextUrl = new URL(res.headers.location, url).toString();
          resolve(this.downloadFile(nextUrl, dest, redirects + 1, onProgress));
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.rmSync(dest, { force: true });
          reject(new Error(`HTTP ${res.statusCode} al descargar ${url}`));
          return;
        }
        const total = Number(res.headers['content-length'] ?? 0);
        let received = 0;
        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (total > 0 && onProgress) onProgress(Math.round((received / total) * 100));
        });
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      }).on('error', (err) => {
        file.close();
        fs.rmSync(dest, { force: true });
        reject(err);
      });
    });
  }

  /**
   * Escribe un comando SIN esperar respuesta (el sidecar no la emite). Uso:
   * chunks de audio de reunion (~2-4/seg), donde una respuesta por chunk solo
   * duplicaria el trafico stdio. Devuelve false si el sidecar no esta corriendo.
   */
  sendNotification(cmd: string, params: Record<string, unknown>): boolean {
    const proc = this.proc;
    if (!proc || proc.stdin.destroyed) return false;
    return proc.stdin.write(`${JSON.stringify({ cmd, params })}\n`);
  }

  /** Garantiza que el sidecar este corriendo (lo lanza si es necesario). */
  async ensureSidecarRunning(): Promise<void> {
    await this.ensureSidecar();
  }

  /** Ejecuta un comando arbitrario en el sidecar (base para futuras capacidades Python). */
  async sendCommand(cmd: string, params: Record<string, unknown>, timeoutMs = COMMAND_TIMEOUT_MS): Promise<Record<string, unknown>> {
    const proc = this.proc;
    if (!proc || proc.stdin.destroyed) throw new Error('El sidecar Python no esta en ejecucion.');
    const id = this.nextId++;
    const payload = `${JSON.stringify({ id, cmd, params })}\n`;
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout esperando respuesta del sidecar para '${cmd}'.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      proc.stdin.write(payload, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private getPythonPath(): string {
    const executable = process.platform === 'win32' ? ['python.exe'] : ['bin', 'python3'];
    return app.isPackaged
      ? path.join(process.resourcesPath, 'python', ...executable)
      : path.join(app.getAppPath(), 'python-runtime', ...executable);
  }

  private getSidecarPath(): string {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'python-sidecar', 'main.py')
      : path.join(app.getAppPath(), 'python', 'sidecar', 'main.py');
  }

  private isRuntimeAvailable(): boolean {
    return fs.existsSync(this.getPythonPath())
      && fs.existsSync(this.getSidecarPath());
  }

  private resolveModelPathFor(size: VoskModelSize): string | null {
    const dir = VOSK_MODELS[size].dir;
    const candidates = [
      path.join(app.getPath('userData'), 'models', dir),
      path.join(app.getAppPath(), 'models', dir),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'conf'))) return candidate;
    }
    return null;
  }

  private resolveModelPath(): string | null {
    if (this.config.modelPath && fs.existsSync(path.join(this.config.modelPath, 'conf'))) {
      return this.config.modelPath;
    }
    // El modelo grande (mejor precision) tiene prioridad si esta instalado.
    return this.resolveModelPathFor('large') ?? this.resolveModelPathFor('small');
  }

  /**
   * Modelo del WAKE WORD: siempre el pequeño. El grande NO soporta gramaticas
   * en runtime ("Runtime graphs are not supported by this model") y la wake word
   * dejaria de detectarse. El pequeño es ideal aqui: gramatica restringida a la
   * palabra de activacion, CPU minima y 24/7.
   */
  private resolveWakeModelPath(): string | null {
    return this.resolveModelPathFor('small') ?? this.resolveModelPathFor('large');
  }

  /** Modelo del DICTADO: el grande si esta instalado (mucha mejor precision). */
  private resolveDictationModelPath(): string | null {
    return this.resolveModelPath();
  }

  private async ensureSidecar(): Promise<void> {
    if (this.proc) return;
    const pythonPath = this.getPythonPath();
    const sidecarPath = this.getSidecarPath();
    const runtimeLib = path.join(path.dirname(path.dirname(pythonPath)), 'lib');
    const libraryPath = process.platform === 'linux'
      ? [runtimeLib, process.env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter)
      : process.env.LD_LIBRARY_PATH;
    console.log(`[PythonRuntime] Lanzando sidecar: ${sidecarPath}`);
    const proc = spawn(pythonPath, ['-u', sidecarPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', LD_LIBRARY_PATH: libraryPath },
    });
    this.proc = proc;
    this.stopping = false;
    this.stdoutBuffer = '';

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => this.handleStdout(chunk));
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk: string) => {
      const text = chunk.trim();
      if (text) console.warn(`[PythonRuntime][stderr] ${text}`);
    });
    proc.on('exit', (code) => this.handleExit(code));
    proc.on('error', (err) => {
      this.lastError = err.message;
      this.emit('error', err);
    });

    await this.waitForReady();
  }

  private waitForReady(timeoutMs = COMMAND_TIMEOUT_MS): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('sidecar-ready', onReady);
        reject(new Error('Timeout esperando el evento ready del sidecar.'));
      }, timeoutMs);
      const onReady = () => { clearTimeout(timer); resolve(); };
      this.once('sidecar-ready', onReady);
    });
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    let newlineIdx = this.stdoutBuffer.indexOf('\n');
    while (newlineIdx !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIdx).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIdx + 1);
      if (line) this.handleMessage(line);
      newlineIdx = this.stdoutBuffer.indexOf('\n');
    }
  }

  private getCurrentDictationEvent(msg: Record<string, unknown>): DictationEventPayload | null {
    const sessionId = String(msg.session_id ?? '').trim();
    if (!sessionId || sessionId !== this.activeDictationSessionId) {
      console.log('[PythonRuntime] Evento de dictado obsoleto ignorado.', {
        event: String(msg.event ?? ''),
        sessionId: sessionId || '(sin sesion)',
        activeSessionId: this.activeDictationSessionId,
      });
      return null;
    }
    return {
      sessionId,
      text: String(msg.text ?? ''),
      reason: String(msg.reason ?? ''),
    };
  }

  private handleMessage(line: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      console.warn(`[PythonRuntime] Linea no-JSON del sidecar: ${line.slice(0, 200)}`);
      return;
    }
    if (typeof msg.id === 'number') {
      const pending = this.pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        pending.resolve(msg);
      }
      return;
    }
    switch (msg.event) {
      case 'ready':
        this.emit('sidecar-ready');
        break;
      case 'wake_word':
        console.log(`[PythonRuntime] Wake word detectada: "${String(msg.text ?? '')}"`);
        this.emit('wake-word', { text: String(msg.text ?? '') });
        break;
      case 'meeting_segment':
        this.emit('meeting-segment', {
          sessionId: String(msg.session_id ?? ''),
          source: msg.source === 'mic' ? 'mic' : 'system',
          speaker: String(msg.speaker ?? (msg.source === 'mic' ? 'usuario' : 'participantes')),
          text: String(msg.text ?? ''),
          t0Ms: Number(msg.t0_ms ?? 0),
          t1Ms: Number(msg.t1_ms ?? 0),
        });
        break;
      case 'meeting_error':
        console.warn(`[PythonRuntime] Error de transcripcion de reunion: ${String(msg.message ?? '')}`);
        this.emit('meeting-error', {
          sessionId: String(msg.session_id ?? ''),
          message: String(msg.message ?? ''),
        });
        break;
      case 'model_preloaded':
        console.log(`[PythonRuntime] Modelo de dictado precargado en ${String(msg.seconds ?? '?')}s (la primera peticion ya no perdera palabras).`);
        break;
      case 'model_preload_failed':
        console.warn(`[PythonRuntime] No se pudo precargar el modelo de dictado: ${String(msg.message ?? '')}`);
        break;
      case 'wake_rejected':
        // Diagnostico de falsos positivos: candidato oido pero descartado.
        console.log('[PythonRuntime] Candidato de wake descartado.', {
          text: String(msg.text ?? ''),
          reason: String(msg.reason ?? 'unknown'),
        });
        break;
      case 'dictation_partial': {
        const payload = this.getCurrentDictationEvent(msg);
        if (payload) this.emit('dictation-partial', payload);
        break;
      }
      case 'dictation_final': {
        const payload = this.getCurrentDictationEvent(msg);
        if (!payload) break;
        this.dictating = false;
        this.activeDictationSessionId = null;
        this.emit('dictation-final', payload);
        break;
      }
      case 'dictation_timeout': {
        const payload = this.getCurrentDictationEvent(msg);
        if (!payload) break;
        this.dictating = false;
        this.activeDictationSessionId = null;
        this.emit('dictation-timeout', payload);
        break;
      }
      case 'dictation_stopped': {
        const payload = this.getCurrentDictationEvent(msg);
        if (!payload) break;
        this.dictating = false;
        this.activeDictationSessionId = null;
        this.emit('dictation-timeout', { ...payload, reason: payload.reason || 'stopped' });
        break;
      }
      case 'tts_chunk': {
        const speechId = String(msg.utterance_id ?? '').trim();
        if (!speechId) break;
        this.emit('tts-chunk', {
          speechId,
          index: Number(msg.index ?? 0),
          total: Number(msg.total ?? 1),
          sampleRate: Number(msg.sample_rate ?? 22050),
          audioBase64: String(msg.audio_b64 ?? ''),
        });
        break;
      }
      case 'tts_end': {
        const speechId = String(msg.utterance_id ?? '').trim();
        if (!speechId) break;
        if (this.activeSpeechId === speechId) this.activeSpeechId = null;
        this.emit('tts-end', { speechId, interrupted: msg.interrupted === true });
        break;
      }
      case 'tts_error': {
        const speechId = String(msg.utterance_id ?? '').trim();
        if (!speechId) break;
        if (this.activeSpeechId === speechId) this.activeSpeechId = null;
        this.lastError = String(msg.message ?? 'Error de TTS');
        this.emit('tts-end', { speechId, interrupted: true, error: this.lastError });
        break;
      }
      case 'error':
        this.lastError = String(msg.message ?? 'Error desconocido del sidecar');
        console.error(`[PythonRuntime] Error del sidecar: ${this.lastError}`);
        break;
      default:
        break; // wake_started / wake_stopped / dictation_started / audio_status: informativos
    }
  }

  private handleExit(code: number | null): void {
    console.log(`[PythonRuntime] Sidecar finalizo con codigo ${code ?? 'null'}.`);
    this.proc = null;
    const interruptedDictationSessionId = this.activeDictationSessionId;
    const interruptedSpeechId = this.activeSpeechId;
    this.activeDictationSessionId = null;
    this.activeSpeechId = null;
    this.dictating = false;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('El sidecar Python finalizo inesperadamente.'));
    }
    this.pending.clear();
    if (interruptedDictationSessionId) {
      this.emit('dictation-timeout', {
        sessionId: interruptedDictationSessionId,
        reason: 'sidecar_exit',
      } satisfies DictationEventPayload);
    }
    if (interruptedSpeechId) {
      this.emit('tts-end', {
        speechId: interruptedSpeechId,
        interrupted: true,
        error: 'El proceso local de voz finalizo inesperadamente.',
      });
    }
    const wasListening = this.listening;
    this.listening = false;
    if (!this.stopping && wasListening && this.restarts < MAX_RESTARTS) {
      this.restarts += 1;
      const delay = 1_000 * this.restarts;
      console.log(`[PythonRuntime] Reiniciando escucha pasiva en ${delay}ms (intento ${this.restarts}/${MAX_RESTARTS})...`);
      setTimeout(() => { void this.startPassiveListening(); }, delay);
    }
  }

  private getConfigPath(): string {
    return path.join(app.getPath('userData'), 'voice-passive.json');
  }

  private loadConfig(): void {
    try {
      const raw = fs.readFileSync(this.getConfigPath(), 'utf8');
      const parsed = JSON.parse(raw) as Partial<VoicePassiveConfig>;
      this.config = {
        ...DEFAULT_CONFIG,
        ...parsed,
        wakeWords: Array.isArray(parsed.wakeWords) && parsed.wakeWords.length > 0
          ? parsed.wakeWords.map((w) => String(w))
          : [...DEFAULT_CONFIG.wakeWords],
      };
    } catch {
      this.config = { ...DEFAULT_CONFIG, wakeWords: [...DEFAULT_CONFIG.wakeWords] };
    }
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.getConfigPath(), JSON.stringify(this.config, null, 2), 'utf8');
    } catch (error) {
      console.error(`[PythonRuntime] No se pudo guardar voice-passive.json: ${error instanceof Error ? error.message : error}`);
    }
  }
}

export const pythonRuntimeService = new PythonRuntimeService();
