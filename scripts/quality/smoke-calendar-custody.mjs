import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { buildEnvironment } from './smoke-app-build.mjs';

// Opt-in: módulos reales y DPAPI, sin bootstrap, ventanas, .env ni perfil del usuario.
assert.equal(process.platform, 'win32', 'Este smoke nativo verifica DPAPI en Windows.');
assert.equal(process.argv.length, 2, 'El smoke no admite rutas de perfiles ni opciones.');
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const executable = require('electron');
assert.equal(typeof executable, 'string', 'Falta el ejecutable Electron instalado.');
const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).devDependencies.electron;
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-calendar-native-'));
console.log('[Calendario nativo] Perfil aislado: ' + sandbox);
await fs.symlink(path.join(root, 'node_modules'), path.join(sandbox, 'node_modules'), 'junction');
for (const name of ['electron/calendar/credential-files', 'electron/calendar/credential-store', 'electron/storage/private-files',
  'electron/storage/os-cipher', 'electron/gmail/plan-schema', 'electron/gmail/plan-storage', 'src/shared/gmail-organization',
  'src/shared/gmail-mailbox', 'src/shared/gmail-delivery', 'electron/project-hub/session-store', 'electron/project-hub/session-contract']) {
  const source = await fs.readFile(path.join(root, name + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const destination = path.join(sandbox, name + '.js');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, compiled.outputText);
}
await fs.writeFile(path.join(sandbox, 'main.cjs'), `
const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { CalendarCredentialStore } = require('./electron/calendar/credential-store');
const { GmailPlanStore } = require('./electron/gmail/plan-storage');
const { ProjectHubSessionStore } = require('./electron/project-hub/session-store');
const { createHash } = require('node:crypto');
const profile = path.join(__dirname, 'profile');
app.setPath('userData', profile); app.setPath('sessionData', path.join(profile, 'session'));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  assert.equal(process.versions.electron, ${JSON.stringify(version)});
  const phase = process.argv.at(-1);
  const store = new CalendarCredentialStore(); const guard = () => {};
  const plans = new GmailPlanStore();
  const projects = new ProjectHubSessionStore();
  const projectOwner = 'usuario-ficticio-A';
  const projectLegacy = path.join(profile, 'project-hub-session.enc');
  const projectFile = user => path.join(profile, 'project-hub-sessions', createHash('sha256').update(user).digest('hex') + '.bin');
  const projectSession = { refreshToken: 'renovacion-proyecto-ficticia', workspaces: [{ id: '12345678-1234-4123-8123-123456789012', name: 'Espacio ficticio', slug: 'prueba', role: 'owner' }] };
  const owner = { userId: 'usuario-ficticio-A', email: 'cuenta-ficticia@example.test' };
  const planId = 'gmail-plan-12345678-1234-4234-8234-123456789abc';
  const legacy = path.join(profile, 'calendar-connections.json');
  if (phase === 'write') {
    await fs.writeFile(projectLegacy, 'legado-ficticio-sin-propietario');
    await projects.save(projectOwner, projectSession, guard);
    const connection = { userId: 'usuario-ficticio-A', provider: 'google', accessToken: 'acceso-ficticio-nativo', refreshToken: 'renovacion-ficticia-nativa', isActive: true };
    await fs.writeFile(legacy, JSON.stringify([connection, { ...connection, userId: '' }]));
    assert.equal((await store.load('usuario-ficticio-A', guard)).length, 1);
    await store.save('usuario-ficticio-A', [{ ...connection, accessToken: 'rotado-ficticio-nativo' }], guard);
    await plans.account(owner).save({ id: planId, createdAt: new Date().toISOString(), queryUsed: 'in:inbox',
      removeFromInbox: true, minGroupSize: 1, scannedMessages: 1, truncated: false, status: 'preview',
      groups: [{ groupKey: 'ficticio', labelName: 'Etiqueta ficticia privada', count: 1, messageIds: ['mensaje-ficticio'] }] }, guard);
  } else if (phase === 'read') {
    assert.deepEqual(await projects.load(projectOwner, guard), projectSession);
    assert.equal(await projects.load('usuario-ficticio-B', guard), null);
    await fs.copyFile(projectFile(projectOwner), projectFile('usuario-ficticio-B'));
    await assert.rejects(projects.load('usuario-ficticio-B', guard));
    await projects.clear('usuario-ficticio-B');
    await projects.save(projectOwner, { ...projectSession, refreshToken: 'renovacion-proyecto-rotada-ficticia' }, guard);
    assert.equal((await store.load('usuario-ficticio-A', guard))[0].accessToken, 'rotado-ficticio-nativo');
    assert.deepEqual(await store.load('usuario-ficticio-B', guard), []);
    await store.save('usuario-ficticio-A', [], guard);
    const plan = await plans.account(owner).load(planId, guard);
    await assert.rejects(plans.account({ ...owner, email: 'otra-ficticia@example.test' }).load(planId, guard));
    plan.status = 'applying';
    plan.applyResult = { appliedAt: new Date().toISOString(), labelsCreated: [], labelsReused: [], messageChanges: {},
      removeFromInbox: true, messagesLabeled: 0, completedGroups: [] };
    plan.pending = { kind: 'create-label', labelName: 'Etiqueta ficticia privada' };
    await plans.account(owner).save(plan, guard);
  } else {
    assert.equal(phase, 'disconnect');
    assert.equal((await projects.load(projectOwner, guard)).refreshToken, 'renovacion-proyecto-rotada-ficticia');
    await projects.clear(projectOwner);
    assert.equal(await projects.load(projectOwner, guard), null);
    assert.deepEqual(await store.load('usuario-ficticio-A', guard), []);
    assert.equal((await plans.account(owner).load(planId, guard)).pending.kind, 'create-label');
  }
  assert.equal(await fs.readFile(projectLegacy, 'utf8'), 'legado-ficticio-sin-propietario');
  for (const name of await fs.readdir(path.join(profile, 'project-hub-sessions'))) {
    const bytes = await fs.readFile(path.join(profile, 'project-hub-sessions', name));
    assert.doesNotMatch(bytes.toString(), /renovacion-proyecto|refreshToken|Espacio ficticio|usuario-ficticio/);
  }
  for (const scope of await fs.readdir(path.join(profile, 'gmail-private-plans'))) {
    for (const name of await fs.readdir(path.join(profile, 'gmail-private-plans', scope))) {
      const bytes = await fs.readFile(path.join(profile, 'gmail-private-plans', scope, name));
      assert.doesNotMatch(bytes.toString(), /Etiqueta ficticia|cuenta-ficticia|mensaje-ficticio|usuario-ficticio/);
    }
  }
  for (const directory of [profile, path.join(profile, 'calendar-credentials')]) {
    for (const name of await fs.readdir(directory)) {
      const file = path.join(directory, name);
      if (!(await fs.stat(file)).isFile() || (!name.endsWith('.bin') && name !== 'calendar-connections.json')) continue;
      assert.doesNotMatch((await fs.readFile(file)).toString(), /acceso-ficticio|renovacion-ficticia|rotado-ficticio|refreshToken/);
    }
  }
  await fs.writeFile(path.join(__dirname, phase + '-report.json'), JSON.stringify({ phase, electron: process.versions.electron, success: true, gmailPlansVerified: true, projectSessionsVerified: true }));
  app.exit(0);
}).catch(() => { console.error('Falló la custodia nativa del calendario.'); app.exit(1); });
`);
await fs.mkdir(path.join(sandbox, 'profile', 'session'), { recursive: true });
for (const phase of ['write', 'read', 'disconnect']) {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, [path.join(sandbox, 'main.cjs'), phase], { cwd: sandbox, env: buildEnvironment(process.env), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => process.stdout.write(chunk)); child.stderr.on('data', chunk => process.stderr.write(chunk));
    const timer = setTimeout(() => { child.kill(); reject(new Error('El smoke de calendario excedió 30 segundos.')); }, 30000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error('Falló la fase nativa: ' + phase)); });
  });
}
await fs.writeFile(path.join(sandbox, 'report.json'), JSON.stringify({ version: 1, success: true, electron: version, phases: ['write', 'read', 'disconnect'], profileIsolated: true, realCredentialsUsed: false, gmailPlansVerified: true, projectSessionsVerified: true }, null, 2));
console.log('[Calendario nativo] Cifrado, restauración y desconexión aprobados en tres procesos aislados.');
console.log('[Gmail nativo] Cifrado, cuenta aislada y checkpoint pendiente aprobados sin correo real.');
console.log('[Project Hub nativo] DPAPI, propietario, rotación, cierre y legado conservado aprobados con credenciales ficticias.');
