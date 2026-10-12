import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { BackgroundChatResult } from '../../components/agents/BackgroundChatResult';
import { BackgroundJobControls } from '../../components/agents/BackgroundJobControls';
import { AgentActivityContext } from '../../components/agents/agent-activity-context';
import { backgroundJobId, cleanTeamText } from '../../shared/background-team-display';
import { dedupeMessages, normalizeMessage } from '../../services/chat/normalize/messages';
import type { AgentActivity } from '../../shared/agent-activity';

const id = '4bc25420-46e1-4a93-9886-faf34152758a';
const item: AgentActivity = {
  id: 'background:' + id, sequence: 2, surface: 'chat', kind: 'document', status: 'completed', durationMs: 107000,
  agents: [{ role: 'especialista-uno', status: 'completed' }, { role: 'especialista-dos', status: 'completed' }, { role: 'coordinador', status: 'completed' }],
  execution: { id, status: 'completed', title: 'Encargo', conversationId: 'chat-a', summary: '**Listo:** creé el [archivo final](artifact://' + id + ').', error: null, tokens: 10,
    artifacts: ['especialista-uno', 'especialista-dos', 'coordinador'].map((role, index) => ({ id: id.slice(0, -1) + index, role, name: 'aporte_' + index + '.md', format: 'md', bytes: 400, hash: 'hash', inputHash: 'entrada', verified: true })),
    actions: [{ id, role: 'especialista-uno', tool: 'research_web', status: 'completed', at: '2026-10-11T00:00:00.000Z' }],
  },
};
it('muestra síntesis y todos los archivos sin exponer agentes ni operaciones', () => {
  render(<AgentActivityContext.Provider value={{ items: [item], error: '', open: false, runningCount: 0, setOpen: () => {}, toggle: () => {} }}><BackgroundChatResult jobId={id} messageId={id} conversationId="chat-a" /></AgentActivityContext.Provider>);
  expect(screen.queryByText('Especialista 1')).not.toBeInTheDocument();
  expect(screen.queryByText('Coordinador')).not.toBeInTheDocument();
  expect(screen.queryByText('Investigó fuentes web')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Abrir aporte_/ })).toHaveLength(3);
  expect(screen.getByText('Listo:').closest('strong')).not.toBeNull();
  expect(screen.getByRole('region', { name: 'Trabajo del equipo' }).textContent).not.toContain('**');
  expect(screen.getByRole('region', { name: 'Trabajo del equipo' }).textContent).not.toContain('artifact://');
});
it('renderiza Markdown en el monitor sin mostrar URLs ni UUID internos', () => {
  const { container } = render(<BackgroundJobControls execution={item.execution!} />);
  expect(container.textContent).not.toContain('artifact://');
  expect(container.textContent).not.toContain('**');
  expect(container.textContent).not.toContain(id);
});
it('un identificador sin trabajo autorizado no muestra archivos de otros equipos', () => {
  render(<AgentActivityContext.Provider value={{ items: [item], error: '', open: false, runningCount: 0, setOpen: () => {}, toggle: () => {} }}><BackgroundChatResult jobId="ajeno" messageId={id} conversationId="chat-a" /></AgentActivityContext.Provider>);
  expect(screen.queryByRole('button', { name: /^Abrir/ })).not.toBeInTheDocument();
  expect(screen.getByText(/contexto esté disponible/)).toBeInTheDocument();
});
it('conserva la referencia en metadata y reconoce mensajes antiguos sin mostrarla', () => {
  expect(normalizeMessage({ id: 'mensaje', role: 'model', text: 'Equipo trabajando', backgroundJobId: id })?.backgroundJobId).toBe(id);
  expect(normalizeMessage({ id: 'mensaje', role: 'model', text: 'Equipo', backgroundJobId: 'no-es-uuid' })?.backgroundJobId).toBeUndefined();
  expect(backgroundJobId({ text: 'Equipo ejecutor iniciado.\n\nTrabajo: ' + id })).toBe(id);
  expect(cleanTeamText('Inicio\n\nTrabajo: ' + id)).toBe('Inicio');
  expect(cleanTeamText('[Resultado](artifac://' + id + ')')).toBe('Resultado');
  expect(backgroundJobId({ text: '```\nTrabajo: ' + id + '\n```' })).toBeUndefined();
  expect(backgroundJobId({ text: '> Equipo ejecutor iniciado.\n> Trabajo: ' + id })).toBeUndefined();
});
it('preserva el vínculo al combinar una copia pendiente sin metadata', () => {
  const message = { id: 'mensaje', role: 'model' as const, text: 'Equipo trabajando', timestamp: 1 };
  expect(dedupeMessages([{ ...message, backgroundJobId: id }, message])[0].backgroundJobId).toBe(id);
});
it('no convierte enlaces file, data o javascript de la síntesis en anchors', () => {
  const summary = cleanTeamText('[Local](file:///privado) [Dato](data:text/html,contenido) [Acción](javascript:alert) [Fuente](https://example.com/doc)');
  expect(summary).not.toContain('file:'); expect(summary).not.toContain('data:'); expect(summary).not.toContain('javascript:');
  expect(summary).toContain('[Fuente](https://example.com/doc)');
});
it('no atribuye al mensaje de otro chat los entregables del equipo', () => {
  render(<AgentActivityContext.Provider value={{ items: [item], error: '', open: false, runningCount: 0, setOpen: () => {}, toggle: () => {} }}><BackgroundChatResult jobId={id} messageId={id} conversationId="otro-chat" /></AgentActivityContext.Provider>);
  expect(screen.queryByRole('region', { name: 'Trabajo del equipo' })).not.toBeInTheDocument();
});

