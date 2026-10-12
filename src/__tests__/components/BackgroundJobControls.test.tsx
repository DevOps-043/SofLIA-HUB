import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BackgroundJobControls } from '../../components/agents/BackgroundJobControls';
import { backgroundTeamsService } from '../../services/background-teams';
import { ArtifactViewerContext } from '../../components/artifacts/artifact-viewer-context';
afterEach(() => vi.restoreAllMocks());
it('pausa y abre entregables por identificador, sin exponer rutas arbitrarias', async () => {
  const control = vi.spyOn(backgroundTeamsService, 'control').mockResolvedValue();
  const open = vi.fn();
  render(<ArtifactViewerContext.Provider value={{ files: [], selected: null, error: '', open, select: vi.fn(), pick: vi.fn(), close: vi.fn() }}><BackgroundJobControls execution={{ id: 'trabajo', status: 'running', title: 'Encargo', conversationId: 'chat', summary: '', error: null, tokens: 50,
    artifacts: [{ id: 'archivo', role: 'uno', name: 'aporte.md', format: 'md', bytes: 10, hash: 'hash', inputHash: 'entrada', verified: true }] }} /></ArtifactViewerContext.Provider>);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pausar trabajo' })); });
  expect(control).toHaveBeenCalledWith('trabajo', 'pause');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Abrir aporte/ })); });
  expect(open).toHaveBeenCalledWith(expect.any(Array), { kind: 'team', jobId: 'trabajo', artifactId: 'archivo' });
});
it('una ejecución completada muestra archivos y resultado sin controles de cancelación', () => {
  render(<BackgroundJobControls execution={{ id: 'trabajo', status: 'completed', title: 'Encargo', conversationId: 'chat', summary: 'Resultado verificado', error: null, tokens: 50, artifacts: [] }} />);
  expect(screen.queryByText('Ver resultado del trabajo')).not.toBeInTheDocument();
  expect(screen.queryByText(/tokens utilizados/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancelar trabajo' })).not.toBeInTheDocument();
});

