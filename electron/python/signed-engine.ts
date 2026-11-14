import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { app } from 'electron';

const VERIFY_SCRIPT = "$ErrorActionPreference='Stop'; $s=Get-AuthenticodeSignature -LiteralPath $env:SOFLIA_REPAIR_FILE; if($s.Status -ne 'Valid' -or !$s.SignerCertificate -or !$s.TimeStamperCertificate -or $s.SignerCertificate.Subject -cne $env:SOFLIA_REPAIR_SUBJECT){exit 1}; Write-Output 'voice-signature-ok'";
const VERIFY_NATIVE_SCRIPT = "$ErrorActionPreference='Stop'; $root=Get-Item -LiteralPath $env:SOFLIA_ENGINE_ROOT -Force; if($root.Attributes -band [IO.FileAttributes]::ReparsePoint){exit 1}; $count=0; foreach($f in Get-ChildItem -LiteralPath $root.FullName -Recurse -Force){if($f.Attributes -band [IO.FileAttributes]::ReparsePoint){exit 1}; if(!$f.PSIsContainer -and $f.Extension -in @('.exe','.dll','.pyd','.node')){$s=Get-AuthenticodeSignature -LiteralPath $f.FullName; if($s.Status -ne 'Valid' -or !$s.SignerCertificate){exit 1}; $count++}}; if($count -eq 0){exit 1}; Write-Output 'voice-native-signatures-ok'";
const PROBE = 'import vosk, sounddevice; print("voice-engine-ready")';

function environment(): NodeJS.ProcessEnv {
  const env = {} as NodeJS.ProcessEnv;
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}
function execute(file: string, args: string[], env = environment()): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { env, encoding: 'utf8', windowsHide: true, timeout: 5 * 60_000, maxBuffer: 65536 }, (error, stdout, stderr) => {
      if (!error) { resolve(stdout.trim()); return; }
      const blocked = /(?:Control de aplicaciones|Application Control|App Control|WinError 4551)/iu.test(stderr);
      reject(new Error(blocked ? 'voice_runtime_blocked' : 'voice_setup_failed'));
    });
  });
}
function verifyScript(script: string, env: NodeJS.ProcessEnv): Promise<string> {
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  return execute(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], env);
}
export function restoredVoiceEngineDirectory(): string {
  const version = app.getVersion();
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/u.test(version) || version.length > 128) throw new Error('voice_setup_failed');
  return path.join(app.getPath('userData'), 'voice-engine', version);
}
async function ready(root: string): Promise<boolean> {
  const required = ['python/python.exe', 'python-sidecar/main.py', 'python-tools/main.py', 'models/vosk-model-small-es-0.42/conf/model.conf', 'models/vosk-model-small-es-0.42/am/final.mdl'];
  try {
    if (required.some(relative => { const stat = fs.lstatSync(path.join(root, relative)); return !stat.isFile() || stat.isSymbolicLink() || !stat.size; })) return false;
    const env = environment(); env.SOFLIA_ENGINE_ROOT = root;
    if (await verifyScript(VERIFY_NATIVE_SCRIPT, env) !== 'voice-native-signatures-ok') return false;
    return await execute(path.join(root, 'python/python.exe'), ['-I', '-c', PROBE]) === 'voice-engine-ready';
  } catch { return false; }
}

/** Contenedor local firmado: nunca pip, shell ni descarga de código en equipos de usuarios. */
export async function ensureSignedVoiceEngine(): Promise<string> {
  const restored = restoredVoiceEngineDirectory();
  for (const root of [restored, process.resourcesPath]) if (await ready(root)) return root;
  let subject: string;
  try {
    const metadataPath = path.join(app.getAppPath(), 'package.json');
    if (fs.statSync(metadataPath).size > 65536) throw new Error('voice_engine_untrusted');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')).sofliaVoiceEngine;
    if (metadata?.version !== app.getVersion() || typeof metadata.subject !== 'string' || !metadata.subject.trim()
      || metadata.subject.length > 2048 || /[\r\n\0]/u.test(metadata.subject)) throw new Error('voice_engine_untrusted');
    subject = metadata.subject;
  } catch { throw new Error('voice_engine_untrusted'); }
  const helper = path.join(process.resourcesPath, 'voice-engine/Soflia-Voice-Engine.exe');
  const env = environment(); env.SOFLIA_REPAIR_FILE = helper; env.SOFLIA_REPAIR_SUBJECT = subject;
  try {
    const result = await verifyScript(VERIFY_SCRIPT, env);
    if (result !== 'voice-signature-ok') throw new Error('voice_engine_untrusted');
  } catch { throw new Error('voice_engine_untrusted'); }
  if (await execute(helper, ['--destination', restored]) !== 'voice-engine-restored' || !await ready(restored)) throw new Error('voice_setup_failed');
  return restored;
}
