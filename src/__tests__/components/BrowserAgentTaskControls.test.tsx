import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserAgentTaskControls } from '../../components/browser/BrowserAgentTaskControls';
import { integratedBrowserService } from '../../services/integrated-browser-service';
import type { BrowserAgentTaskState, BrowserAgentControlResponse } from '../../shared/browser-agent-control';

const task: BrowserAgentTaskState = { taskId: 'browser-cu-prueba', revision: 1, status: 'executing', currentStep: 2, maxSteps: 20 };
afterEach(() => vi.restoreAllMocks());
describe('Controles de supervisión', () => {
  it('pausa sin duplicar y espera el estado autoritativo para ofrecer reanudación', async () => {
    const send = vi.spyOn(integratedBrowserService, 'controlAgentTask').mockResolvedValue({ success: true, agentTask: { ...task, status: 'paused' } });
    const view = render(<BrowserAgentTaskControls task={task} profileRevision={4} />);
    const button = screen.getByRole('button', { name: 'Pausar' });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send).toHaveBeenCalledWith({ action: 'pause', taskId: task.taskId, taskRevision: 1, profileRevision: 4 });
    expect(screen.queryByRole('button', { name: 'Reanudar' })).not.toBeInTheDocument();
    view.rerender(<BrowserAgentTaskControls task={{ ...task, status: 'paused' }} profileRevision={4} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    expect(send).toHaveBeenLastCalledWith({ action: 'resume', taskId: task.taskId, taskRevision: 1, profileRevision: 4 });
  });
  it('permite detener una pausa cuyo acuse no llega; descarta el error tardío', async () => {
    let resolve!: (value: BrowserAgentControlResponse) => void;
    const send = vi.spyOn(integratedBrowserService, 'controlAgentTask').mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue({ success: true });
    render(<BrowserAgentTaskControls task={task} profileRevision={4} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tomar control' }));
    fireEvent.click(screen.getByRole('button', { name: 'Detener' }));
    expect(send).toHaveBeenCalledTimes(2);
    await act(async () => resolve({ success: false, error: 'viejo' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('SofLIA controla');
  });
  it.each(['starting', 'pausing', 'stopping'] as const)('no permite reanudar desde %s', status => {
    render(<BrowserAgentTaskControls task={{ ...task, status }} profileRevision={4} />);
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reanudar' })).not.toBeInTheDocument();
    if (status === 'stopping') expect(screen.getByRole('button', { name: 'Tomar control' })).toBeDisabled();
  });
  it.each(['perfil', 'tarea', 'estado', 'desmontaje'])('descarta resultados obsoletos por %s', async change => {
    let reject!: (reason: Error) => void;
    vi.spyOn(integratedBrowserService, 'controlAgentTask').mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const view = render(<BrowserAgentTaskControls task={task} profileRevision={4} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    if (change === 'desmontaje') view.unmount();
    else view.rerender(<BrowserAgentTaskControls task={change === 'tarea' ? { ...task, taskId: 'nuevo' } : change === 'estado' ? { ...task, status: 'pausing' } : task} profileRevision={change === 'perfil' ? 5 : 4} />);
    await act(async () => reject(new Error('secreto')));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('muestra error saneado y permite reintentar', async () => {
    vi.spyOn(integratedBrowserService, 'controlAgentTask').mockRejectedValue(new Error('secreto'));
    render(<BrowserAgentTaskControls task={task} profileRevision={4} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(await screen.findByRole('alert')).not.toHaveTextContent('secreto');
    expect(screen.getByRole('button', { name: 'Pausar' })).not.toBeDisabled();
  });
  it('falla cerrado si la versión de main no entrega revisión de perfil', () => {
    render(<BrowserAgentTaskControls task={task} />);
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});
