import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MultiAgentPanel } from '../components/meetings/MultiAgentPanel';
import { agentResult } from '../services/agent-runtime';
import type { AgentRun, AgentRuntimeBridge, AgentRuntimeState } from '../shared/agent-runtime';
const run: AgentRun = {
  id: 'run1', title: 'Reunión', source: 'Fuente privada', provider: 'gemini',
  scope: { userId: 'a', organizationId: null }, status: 'review',
  createdAt: '', updatedAt: '', digest: 'a'.repeat(64), approvalExpiresAt: Date.now() + 60_000,
  error: null, meetingRunId: null, parentRunId: null,
  steps: [{ role: 'coordinador', status: 'completed', output: 'Borrador para revisar', inputTokens: 5, outputTokens: 5, toolCalls: 2 }],
};
const state: AgentRuntimeState = { scope: run.scope, runs: [run], persistence: 'encrypted', geminiAvailable: true, codex: { configured: false, version: null, home: null } };
describe('Panel multiagente', () => {
  beforeEach(() => {
    window.agentRuntime = {
      setContext: vi.fn(async () => ({ success: true, data: state })),
      getState: vi.fn(async () => ({ success: true, data: state })),
      releaseContext: vi.fn(async () => ({ success: true, data: null })),
      onChanged: vi.fn(() => () => {}),
      publish: vi.fn(async () => ({ success: true, data: { ...run, status: 'published' } })),
    } as unknown as AgentRuntimeBridge;
  });
  afterEach(() => { cleanup(); delete window.agentRuntime; });
  it('requiere una decisión explícita y publica el digest de la minuta revisada', async () => {
    const published = vi.fn();
    render(<MultiAgentPanel userId="a" organizationId={null} title="Reunión" source="Transcripción suficiente" onPublished={published} />);
    const button = await screen.findByRole('button', { name: 'Crear borrador revisable' });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(window.agentRuntime?.publish).toHaveBeenCalledWith({ runId: 'run1', digest: 'a'.repeat(64) }));
    await waitFor(() => expect(published).toHaveBeenCalledTimes(1));
  });
  it('retira el contexto y la suscripción al salir del panel', async () => {
    const unsubscribe = vi.fn();
    window.agentRuntime!.onChanged = vi.fn(() => unsubscribe);
    const view = render(<MultiAgentPanel userId="a" organizationId={null} title="Reunión" source="Transcripción suficiente" onPublished={() => {}} />);
    await screen.findByText('Borrador para revisar');
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(window.agentRuntime!.releaseContext).toHaveBeenCalledTimes(1);
  });
  it('el wrapper propaga un rechazo controlado', async () => {
    await expect(agentResult(Promise.resolve({ success: false, error: 'No autorizado' }))).rejects.toThrow('No autorizado');
  });
});
