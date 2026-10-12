import { afterEach, expect, it, vi } from 'vitest';
import { backgroundTeamsService } from '../../services/background-teams';
import { sendMessageStream } from '../../services/gemini-chat/send-message-stream';
import { wantsBackgroundTeam } from '../../shared/background-teams';
import type { BackgroundTeamsBridge } from '../../shared/background-teams';
vi.mock('../../services/model-routing', () => ({ resolveRoutedModel: () => ({ modelId: 'gemini-3.8-flash' }) }));
vi.mock('../../services/gemini-chat/client', () => ({ getGenAiClient: vi.fn(() => { throw new Error('No debe usar el modelo del renderer para este trabajo.'); }) }));
afterEach(() => { delete window.backgroundTeams; vi.restoreAllMocks(); });
it('admite un trabajo y termina el turno sin esperar a los agentes', async () => {
  const context = vi.fn(async () => ({ success: true, data: { scope: { userId: 'actor', organizationId: null }, jobs: [], persistence: 'encrypted' } }));
  const start = vi.fn(async () => ({ success: true, data: { id: 'equipo-real', status: 'running' } }));
  window.backgroundTeams = { context, start } as unknown as BackgroundTeamsBridge;
  const stream = await sendMessageStream('Usa multiagentes para crear dos propuestas', [], { model: 'gemini-3.8-flash',
    backgroundRequest: { messageId: '4bc25420-46e1-4a93-9886-faf34152758a', task: 'Usa multiagentes para crear dos propuestas', conversationId: 'chat-a', organizationId: null } });
  let text = ''; for await (const chunk of stream.stream) text += chunk;
  expect(stream.backgroundJobId).toBe('equipo-real'); expect(text).toContain('seguir conversando');
  expect(start).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'chat-a', allowResearch: true }));
});
it('conserva el alcance de extractos y no activa investigación externa', async () => {
  window.backgroundTeams = { context: vi.fn(async () => ({ success: true, data: { scope: { userId: 'actor', organizationId: null } } })), start: vi.fn(async () => ({ success: true, data: { id: 'equipo' } })) } as unknown as BackgroundTeamsBridge;
  await sendMessageStream('Datos adjuntos', [], { browserSourceMode: 'attached-fragments',
    backgroundRequest: { messageId: '4bc25420-46e1-4a93-9886-faf34152758a', task: 'Crea un documento con multiagentes', conversationId: 'chat', organizationId: null } });
  expect(window.backgroundTeams!.start).toHaveBeenCalledWith(expect.objectContaining({ allowResearch: false }));
});
it('comunica un rechazo real sin fingir que empezó el equipo', async () => {
  window.backgroundTeams = { context: vi.fn(async () => ({ success: false, error: 'Sin sesión' })) } as unknown as BackgroundTeamsBridge;
  await expect(backgroundTeamsService.start({} as never, null)).rejects.toThrow('Sin sesión');
});


it.each([
  'Propón tres ideas diferentes de activación para Rethink & Delight',
  'No olvides crear tres propuestas diferentes para la campaña',
  'Recuerda generar tres alternativas para esta activación',
  'Investiga y compara tres plataformas de formación para una empresa, considerando costes, privacidad e integración.',
  'Prepara un informe Word y un presupuesto Excel para la campaña',
  'Genera un Excel y un Markdown con las alternativas',
])('delega automáticamente trabajo independiente: %s', task => {
  expect(wantsBackgroundTeam(task)).toBe(true);
});
it.each([
  'No quiero varias propuestas; crea solo una idea breve para el cliente.',
  'Explica por qué no conviene generar varias propuestas cuando el cliente solo pidió una.',
  'Explica cómo crear un informe Word y un presupuesto Excel',
  '¿Puedes explicarme por qué conviene generar tres propuestas en lugar de una?',
  'Puedes explicarme cómo generar tres alternativas para una campaña antes de ponernos a trabajar.',
  'Hola', 'Resume esto en un párrafo', 'Convierte este documento a Word',
  'Ahora guárdalo como un documento Word',
  'Modo directo: prepara un informe Word y un Excel',
  'Sin usar multiagentes, crea un informe',
  'Crea un informe y envíalo por correo',
  'Investiga y compara la página actual con competidores y prepara una propuesta de mejoras de contenido.',
  'Explica este texto: "Crea un informe Word y un presupuesto Excel"',
  "Explica este texto: 'Usa multiagentes para crear un informe'",
  'Explica este código: ```prepara un informe Word y un Excel```',
  '> Usa multiagentes para crear tres propuestas',
])('mantiene flujo directo o supervisado: %s', task => {
  expect(wantsBackgroundTeam(task)).toBe(false);
});
it('el modo directo prevalece sobre una tarea apta para delegar', () => {
  expect(wantsBackgroundTeam('Propón tres ideas distintas para una campaña', 'direct')).toBe(false);
});
it('el encargo automático inicia el ejecutor real y conserva su vínculo con el mensaje', async () => {
  const start = vi.fn(async () => ({ success: true, data: { id: 'equipo-automatico', status: 'running' } }));
  window.backgroundTeams = { context: vi.fn(async () => ({ success: true, data: { scope: { userId: 'actor', organizationId: null } } })), start } as unknown as BackgroundTeamsBridge;
  const task = 'Propón tres ideas diferentes de activación para Rethink & Delight';
  const result = await sendMessageStream(task, [], { model: 'gemini-3.8-flash', backgroundRequest: { task, messageId: '4bc25420-46e1-4a93-9886-faf34152758a', conversationId: 'automatico', organizationId: null } });
  expect(result.backgroundJobId).toBe('equipo-automatico');
  expect(start).toHaveBeenCalledWith(expect.objectContaining({ task, messageId: '4bc25420-46e1-4a93-9886-faf34152758a', conversationId: 'automatico' }));
});

it.each([
  'Analiza esta página y propón tres alternativas de mejora para la navegación y la experiencia de los clientes.',
  'Analiza el documento abierto y prepara un informe Word y un Excel con los datos.',
  'Revisa el programa abierto y propón tres alternativas de mejora de la experiencia.',
  String.raw`Busca en C:\Presupuestos las propuestas actuales, compara sus costos, ventajas y desventajas y entrega tres alternativas concretas.`,
  'Observa Codex en el escritorio y prepara tres alternativas para enviarlas a Google Chat en el navegador.',
])('no delega antes de recoger evidencia de la superficie visible: %s', async task => {
  const start = vi.fn(); window.backgroundTeams = { start } as unknown as BackgroundTeamsBridge;
  // El flujo supervisado llega al proveedor de este fixture; no debe iniciar un equipo.
  await expect(sendMessageStream(task, [], { model: 'gemini-3.8-flash', backgroundRequest: { task, messageId: '4bc25420-46e1-4a93-9886-faf34152758a', conversationId: 'visible', organizationId: null } })).rejects.toThrow('No debe usar el modelo del renderer');
  expect(start).not.toHaveBeenCalled();
});
