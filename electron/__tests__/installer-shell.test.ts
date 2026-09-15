import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const { artifactNames } = await import(/* @vite-ignore */ pathToFileURL(resolve('scripts/build-installer-shell.mjs')).href);
const source = (file: string) => readFileSync(resolve('build/installer-shell', file), 'utf8');

describe('entrada de instalación independiente', () => {
  it('no dibuja un marco al enfocar la orbe y conserva una señal discreta de teclado', () => {
    const css = readFileSync(resolve('src/installer-orb/orb.css'), 'utf8');
    expect(css).toContain("[data-testid='orb-interaction-surface'] { outline: none; }");
    expect(css).not.toMatch(/outline:\s*1px|outline-offset:\s*-6px/);
    expect(css).toContain(":focus-visible ~ .orb-hint");
    expect(css).toContain('text-decoration: underline');
  });
  it('separa el EXE visual del artefacto de actualización', () => {
    expect(artifactNames('0.9.8')).toEqual({ engine: 'Pulse-Hub-Windows-0.9.8-Setup.exe', shell: 'Pulse-Hub-Windows-0.9.8-Install.exe' });
    expect(artifactNames('1.0.0-beta.2').shell).toContain('1.0.0-beta.2-Install.exe');
  });
  it.each(['', '../setup', '1.2', '1.2.3/../', '1.2.3"', '1.2.3\n'])('rechaza versión no apta para rutas %j', version => {
    expect(() => artifactNames(version)).toThrow();
  });
  it('no usa páginas NSIS ni marco estándar y mantiene controles de teclado', () => {
    const xaml = source('window.xaml');
    expect(xaml).toContain('WindowStyle="None"');
    expect(xaml).toContain('OrbHost');
    expect(xaml).toContain('IsKeyboardFocused');
    expect(xaml).toContain('AutomationProperties.Name="Cerrar"');
    expect(xaml).not.toMatch(/(?:Source|NavigateUri)="https?:|WebBrowser|nsDialogs/);
  });
  it('embebe el PNG original sin generar otra marca', () => {
    const build = readFileSync(resolve('scripts/build-installer-shell.mjs'), 'utf8');
    expect(build).toContain("public/assets/Icono.png");
    expect(build).toContain(',Pulse.Logo');
    expect(source('InstallerWindow.cs')).toContain('GetManifestResourceStream("Pulse.Logo")');
  });
  it('pausa escena al minimizar o reducir movimiento y libera el temporizador', () => {
    const window = source('InstallerWindow.cs');
    expect(window).toContain('SystemParameters.ClientAreaAnimation');
    expect(window).toContain('SystemParameters.HighContrast');
    expect(window).toContain('window.WindowState != WindowState.Minimized');
    expect(window).toContain('orb.Dispose()');
    expect(source('OrbScene.cs')).toContain('view.Dispose()');
    expect(source('OrbScene.cs')).not.toContain('MeshGeometry3D');
  });
  it('la compilación de preview no incorpora motor y bloquea instalación', () => {
    expect(source('InstallService.cs')).toMatch(/#if PREVIEW\s+throw new InvalidOperationException/);
    const build = readFileSync(resolve('scripts/build-installer-shell.mjs'), 'utf8');
    expect(build).toContain("if (preview) args.push('/define:PREVIEW')");
    expect(build).toContain('else args.push(`/resource:${engine},Pulse.Payload`)');
    expect(source('InstallerWindow.cs')).toContain('VISTA PREVIA · No instala Pulse Hub');
  });
  it('no acepta ejecución desatendida ni mata el motor en escritura', () => {
    const service = source('InstallService.cs');
    expect(source('InstallerWindow.cs')).toContain('if (args.Length != 0) return 2');
    expect(service).toContain('UseShellExecute = false');
    expect(service).toContain('start.EnvironmentVariables.Clear()');
    expect(service).toContain('FileAccess.Read, FileShare.Read');
    expect(service).not.toMatch(/\.Kill\(|Directory\.Delete\([^\n]*true\)/);
    expect(source('InstallerWindow.cs')).toContain('progress.IsIndeterminate = value.Phase != InstallPhase.Preparing');
  });
  it('el motor distingue la entrada consentida y no cierra la aplicación allí', () => {
    const backend = readFileSync(resolve('build/installer.nsh'), 'utf8');
    expect(backend).toContain('!macro customCheckAppRunning');
    expect(backend).toContain('"/pulseShell"');
    expect(backend).toContain('SetErrorLevel 73');
    expect(backend).toContain('!insertmacro _CHECK_APP_RUNNING');
  });
  it('aísla la orbe local sin puente de comandos, descargas ni permisos', () => {
    const host = source('OrbScene.cs');
    expect(host).toContain('AreHostObjectsAllowed = false');
    expect(host).toContain('CoreWebView2PermissionState.Deny');
    expect(host).toContain('args.Cancel = true');
    expect(host).toContain('args.Uri != Origin + "index.html"');
    expect(host).not.toContain('WebMessageReceived');
    expect(host).toContain('host.Loaded += Loaded');
    const entry = readFileSync(resolve('src/installer-orb/InstallerOrb.tsx'), 'utf8');
    expect(entry).toContain("import { OrbCanvas } from '../components/orb/OrbCanvas'");
    expect(entry).not.toMatch(/getUserMedia|useOrbConversation|postMessage\(/);
  });
});
