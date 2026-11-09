import { describe, expect, it } from 'vitest';
import { COMPUTER_IPC_TOOLS } from '../computer-use/ipc-tools';
import { computerInputSnapshot } from '../../src/shared/computer-use-input';
import { computerActionReview } from '../computer-use/ipc-review';

const contracts: [string, unknown[], Record<string, unknown>][] = [
  ['list-screens', [], {}], ['list-processes', [], {}], ['kill-process', [123], { pid: 123 }],
  ['list-directory', ['', undefined], { path: '', show_hidden: false }],
  ['read-file', ['ruta'], { path: 'ruta' }], ['write-file', ['ruta', ''], { path: 'ruta', content: '' }],
  ['create-word-document', [{ content: 'texto', design: { preset: 'corporate' }, chart_images: [] }], { content: 'texto', design: { preset: 'corporate' }, chart_images: [] }],
  ['create-directory', ['ruta'], { path: 'ruta' }],
  ['move-item', ['origen', 'destino'], { source_path: 'origen', destination_path: 'destino' }],
  ['copy-item', ['origen', 'destino'], { source_path: 'origen', destination_path: 'destino' }],
  ['delete-item', ['ruta'], { path: 'ruta' }], ['get-file-info', ['ruta'], { path: 'ruta' }],
  ['search-files', ['', '*.pdf'], { directory: '', pattern: '*.pdf' }],
  ['organize-files', [{ mode: 'type', dry_run: true }], { mode: 'type', dry_run: true }],
  ['batch-move-files', [{ source_directory: 'origen', destination_directory: 'destino', recursive: true }], { source_directory: 'origen', destination_directory: 'destino', recursive: true }],
  ['list-directory-summary', [{ path: '', max_depth: 12 }], { path: '', max_depth: 12 }],
  ['undo-last-file-operation', [undefined], {}], ['execute-command', ['dir'], { command: 'dir' }],
  ['open-application', ['aplicación'], { path: 'aplicación' }], ['open-file-on-computer', ['ruta'], { path: 'ruta' }],
  ['open-url', ['example.invalid'], { url: 'example.invalid' }],
  ['run-background-command', [{ command: 'dir', title: 'Consulta' }], { command: 'dir', title: 'Consulta' }],
  ['list-process-sessions', [], {}], ['poll-process-session', ['sesión'], { session_id: 'sesión' }],
  ['kill-process-session', ['sesión'], { session_id: 'sesión' }], ['get-system-info', [], {}],
  ['clipboard-read', [], {}], ['clipboard-write', [''], { text: '' }],
  ['use-computer', [{}], { action: 'screenshot' }], ['take-screenshot', ['pantalla'], { display_id: 'pantalla' }],
  ['get-email-config', [], {}], ['configure-email', ['qa@example.invalid', 'clave-ficticia'], { email: 'qa@example.invalid', password: 'clave-ficticia' }],
  ['send-email', ['qa@example.invalid', 'Asunto', 'Texto', ['archivo'], true], { to: 'qa@example.invalid', subject: 'Asunto', body: 'Texto', attachment_paths: ['archivo'], is_html: true }],
];
describe('Contratos públicos de Computer Use', () => {
  it.each(contracts)('conserva parámetros y opciones de %s', (channel, args, expected) => {
    const mapping = COMPUTER_IPC_TOOLS.find(item => item.channel === `computer:${channel}`);
    expect(mapping).toBeDefined(); expect(mapping?.parse(computerInputSnapshot(args))).toEqual(expected);
  });
  it('cubre todos los canales y exige revisión de todos los efectos', () => {
    expect(new Set(contracts.map(([name]) => `computer:${name}`))).toEqual(new Set(COMPUTER_IPC_TOOLS.map(item => item.channel)));
    for (const tool of COMPUTER_IPC_TOOLS.filter(item => ['delete_item', 'kill_process', 'write_file', 'send_email', 'execute_command', 'configure_email'].includes(item.tool))) expect(tool.review({})).toBe(true);
    const gui = COMPUTER_IPC_TOOLS.find(item => item.tool === 'use_computer')!;
    expect(gui.review({ action: 'screenshot' })).toBe(false); expect(gui.review({ action: 'type' })).toBe(true);
  });
  it('muestra comando/directorio completos y marca previews largas con digest completo', () => {
    const review = computerActionReview('run_background_command', { command: 'x'.repeat(20000), working_directory: 'destino' });
    expect(review).toContain('x'.repeat(20000)); expect(review).toContain('destino');
    const body = 'a'.repeat(3000), otherBody = body.slice(0, -1) + 'b';
    const first = computerActionReview('send_email', { body });
    expect(first).toContain('Vista previa'); expect(first).not.toEqual(computerActionReview('send_email', { body: otherBody }));
  });
});
