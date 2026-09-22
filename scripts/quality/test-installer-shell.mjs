import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { execFileSync } from 'node:child_process';
import { compilerConfiguration, shellRoot, sha256 } from '../build-installer-shell.mjs';
import { buildEnvironment } from './smoke-app-build.mjs';

try {
  const { compiler } = compilerConfiguration();
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-installer-native-tests-'));
  const engine = path.join(stage, 'harmless-engine.exe');
  const common = ['/nologo', '/platform:x64', '/codepage:65001', '/utf8output'];
  const options = { windowsHide: true, encoding: 'utf8', timeout: 30000, env: buildEnvironment(process.env) };
  execFileSync(compiler, [...common, `/out:${engine}`, path.join(shellRoot, 'test/manual/installer-shell/HarmlessEngine.cs')], options);
  const info = path.join(stage, 'BuildInfo.cs');
  fs.writeFileSync(info, `namespace PulseInstaller { internal static class BuildInfo { public const string PayloadHash = "${await sha256(engine)}"; } }`, { flag: 'wx' });
  const runner = path.join(stage, 'tests.exe');
  execFileSync(compiler, [...common, `/out:${runner}`, `/resource:${engine},Pulse.Payload`, info,
    path.join(shellRoot, 'build/installer-shell/InstallService.cs'), path.join(shellRoot, 'test/manual/installer-shell/ServiceTests.cs')], options);
  console.log(execFileSync(runner, [], options));
  console.log(`[Pruebas del instalador] Evidencia conservada en ${stage}`);
} catch (error) {
  console.error(error.stdout?.toString() || error.message);
  if (error.stderr) console.error(error.stderr.toString());
  process.exitCode = 1;
}
