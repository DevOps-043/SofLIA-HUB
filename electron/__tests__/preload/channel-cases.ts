import { expect, it } from 'vitest';
import { ALLOWED_IPC_CHANNELS, validateChannel } from './helpers';

export function registerPreloadChannelTests() {
  it('SEC-016: allowed channel passes without error', () => {
    expect(() => validateChannel('whatsapp:connect')).not.toThrow();
  });

  it.each([
    ['SEC-017: unauthorized channel throws error', 'hacker:steal-data'],
    ['SEC-018: empty string channel throws', ''],
    ['SEC-020: random string channel throws', 'random:nonexistent:channel'],
  ])('%s', (_label, channel) => {
    expect(() => validateChannel(channel)).toThrow('Unauthorized IPC channel');
  });

  it('SEC-019: all computer:* channels pass', () => {
    const computerChannels = ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('computer:'));
    expect(computerChannels.length).toBeGreaterThanOrEqual(15);
    computerChannels.forEach((channel) => {
      expect(() => validateChannel(channel)).not.toThrow();
    });
  });

  it('SEC-019b: federated sign-in channels are allowed', () => {
    // El flujo SSO no funciona si falta cualquiera de los tres: apertura del
    // navegador, retorno en caliente y retorno retenido del arranque en frio.
    ['auth:open-sso', 'app:auth-callback', 'app:get-pending-auth-callback'].forEach((channel) => {
      expect(ALLOWED_IPC_CHANNELS).toContain(channel);
      expect(() => validateChannel(channel)).not.toThrow();
    });
  });

  it('SEC-021: has 150+ channels total', () => {
    expect(ALLOWED_IPC_CHANNELS.length).toBeGreaterThanOrEqual(150);
  });

  it('SEC-022 to SEC-025: required namespaces are present', () => {
    const namespaceMinimums = [
      ['computer:', 15],
      ['whatsapp:', 5],
      ['desktop-agent:', 15],
      ['monitoring:', 3],
      ['calendar:', 3],
      ['gmail:', 3],
      ['drive:', 3],
      ['gchat:', 3],
    ] as const;
    for (const [namespace, minimum] of namespaceMinimums) {
      const count = ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith(namespace)).length;
      expect(count, `Expected ${namespace} channels`).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('SEC-030 to SEC-032: updater, memory and workflow-hub namespaces are present', () => {
    expect(ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('updater:')).length).toBeGreaterThanOrEqual(4);
    expect(ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('memory:')).length).toBeGreaterThanOrEqual(3);
    expect(ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('workflow-hub:')).length).toBeGreaterThanOrEqual(6);
  });

  it('SEC-035: el navegador integrado expone solo su contrato allowlisted', () => {
    const browserChannels = ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('integrated-browser:'));
    expect(browserChannels).toHaveLength(59);
    expect(browserChannels).toContain('integrated-browser:toggle-devtools');
    expect(browserChannels).toContain('integrated-browser:clear-browsing-data');
    expect(browserChannels).toContain('integrated-browser:site-permissions-get');
    expect(browserChannels).toContain('integrated-browser:site-permissions-set');
    expect(browserChannels).toContain('integrated-browser:site-permissions-reset');
    expect(browserChannels).toContain('integrated-browser:site-permissions-changed');
    expect(browserChannels).toContain('integrated-browser:permission-prompt');
    expect(browserChannels).toContain('integrated-browser:permission-decide');
    expect(browserChannels).toContain('integrated-browser:tab-summaries');
    expect(browserChannels).toContain('integrated-browser:get-tab-content');
    expect(browserChannels).toContain('integrated-browser:selection-action');
    expect(browserChannels).toContain('integrated-browser:reading-mode-requested');
    expect(browserChannels).toContain('integrated-browser:reading-prepare');
    expect(browserChannels).toContain('integrated-browser:reading-synthesize');
    expect(browserChannels).toContain('integrated-browser:reading-highlight');
    expect(browserChannels).toContain('integrated-browser:reading-toolbar-wait');
    expect(browserChannels).toContain('integrated-browser:reading-toolbar-sync');
    expect(browserChannels).toContain('integrated-browser:reading-cancel');
    expect(browserChannels).toContain('integrated-browser:reading-close');
    expect(browserChannels).not.toContain('integrated-browser:reading-download');
    // Panel de redaccion de la pagina: main pide al renderer y el renderer
    // devuelve el texto. Son dos canales, no una via libre a la pagina.
    expect(browserChannels).toContain('integrated-browser:writing-request');
    expect(browserChannels).toContain('integrated-browser:writing-resolve');
    expect(browserChannels).toContain('integrated-browser:capture-visible');
    expect(browserChannels).toContain('integrated-browser:element-click');
    expect(browserChannels).toContain('integrated-browser:element-type');
    expect(browserChannels).toContain('integrated-browser:scroll');
    expect(browserChannels).toContain('integrated-browser:get-observation');
    expect(browserChannels).toContain('integrated-browser:set-observation-enabled');
    expect(browserChannels).toContain('integrated-browser:set-viewport');
    expect(browserChannels).toContain('integrated-browser:tab-create');
    expect(browserChannels).toContain('integrated-browser:tab-detach');
    expect(browserChannels).toContain('integrated-browser:tab-reattach');
    // Sin este canal en la allowlist, `validateChannel` lanzaba de forma
    // sincrona dentro de un updater de React y la aplicacion se quedaba en
    // blanco al arrastrar una pestana.
    expect(browserChannels).toContain('integrated-browser:tab-reorder');
    expect(browserChannels).toContain('integrated-browser:view-mode');
    expect(browserChannels).toContain('integrated-browser:open-requested');
    expect(browserChannels).toContain('integrated-browser:credentials-save');
    expect(browserChannels).toContain('integrated-browser:extensions-install');
    expect(browserChannels).toContain('integrated-browser:extensions-confirm-install');
    expect(ALLOWED_IPC_CHANNELS).toContain('orb:show');
  });

  it('SEC-036: el espacio de trabajo de skills expone solo su contrato allowlisted', () => {
    const workspaceChannels = ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('skill-workspace:'));
    expect(workspaceChannels).toHaveLength(14);
    expect(workspaceChannels).toContain('skill-workspace:create');
    expect(workspaceChannels).toContain('skill-workspace:find-by-conversation');
    // Ata la presentacion al chat cuando la conversacion se crea despues que
    // ella. Main se niega a reasignar la que ya tiene dueño.
    expect(workspaceChannels).toContain('skill-workspace:attach-conversation');
    expect(workspaceChannels).toContain('skill-workspace:get-state');
    expect(workspaceChannels).toContain('skill-workspace:read-file');
    expect(workspaceChannels).toContain('skill-workspace:write-file');
    expect(workspaceChannels).toContain('skill-workspace:edit-file');
    expect(workspaceChannels).toContain('skill-workspace:delete-file');
    expect(workspaceChannels).toContain('skill-workspace:open-folder');
    expect(workspaceChannels).toContain('skill-workspace:progress');
    expect(workspaceChannels).toContain('skill-workspace:preview-url');
    expect(workspaceChannels).toContain('skill-workspace:write-image');
    expect(workspaceChannels).toContain('skill-workspace:download-image');
    // El workspace nunca expone un canal de ruta absoluta ni de ejecucion:
    // main resuelve la ruta real y el renderer solo maneja rutas relativas.
    expect(workspaceChannels).not.toContain('skill-workspace:absolute-path');
    expect(workspaceChannels).not.toContain('skill-workspace:execute');
  });

  it('SEC-037: las presentaciones exponen vista, exportacion y branding', () => {
    const presentationChannels = ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('presentation'));
    expect(presentationChannels).toHaveLength(5);
    expect(presentationChannels).toContain('presentation-view:open');
    expect(presentationChannels).toContain('presentation-view:close');
    expect(presentationChannels).toContain('presentation-view:closed');
    expect(presentationChannels).toContain('presentation:export-html');
    // La exportacion es HTML, no PDF: imprimir aplanaria las animaciones.
    expect(presentationChannels).not.toContain('presentation:export-pdf');
    expect(presentationChannels).toContain('presentation:prepare-branding');
  });
}
