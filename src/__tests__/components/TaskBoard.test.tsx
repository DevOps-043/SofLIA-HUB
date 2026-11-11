import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectTasks } from '../../components/project-workspace/ProjectTasks';
import { taskDifficultyFor } from '../../shared/task-difficulty';
import { projectHubInputs } from '../../shared/project-hub';
import { taskColumns } from '../../components/project-workspace/task-board-model';

const workspace = '62beba2e-d36c-4b2e-a308-4885c53fd7d7', project = 'c66c432f-1e7b-427c-8124-bef8f5ed053d';
const todo = 'a12f1c01-e433-4f89-869a-8066d33654f3', doing = 'b12f1c01-e433-4f89-869a-8066d33654f3', done = 'c12f1c01-e433-4f89-869a-8066d33654f3';
const taskId = 'e12f1c01-e433-4f89-869a-8066d33654f3';
const configuredStatuses = [{ status_id: todo, name: 'Por hacer', status_type: 'todo' }, { status_id: doing, name: 'En curso', status_type: 'in_progress' }, { status_id: done, name: 'Completadas', status_type: 'done' }];
const task = { issue_id: taskId, issue_number: 12, title: 'Diseñar el tablero', status_id: todo, estimate_points: 3, priority_id: done, assignee_id: project, updated_at: '2026-10-24T10:00:00Z' };
const props = { workspaceId: workspace, projectId: project, canWrite: true, canManage: true, state: { loading: false, data: [] }, onRefresh: vi.fn() };
const ok = (data: unknown) => ({ success: true, data });
let bridge: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  bridge = { listTasks: vi.fn().mockResolvedValue(ok([task])), getTaskOptions: vi.fn().mockResolvedValue(ok({ statuses: [{ status_id: todo, name: 'Por hacer', status_type: 'todo' }, { status_id: doing, name: 'En curso', status_type: 'in_progress' }, { status_id: done, name: 'Completadas', status_type: 'done' }], assignees: [{ user: { user_id: project, display_name: 'Ana Torres' } }], cycles: [{ cycle_id: project, name: 'Lanzamiento' }] })), updateTask: vi.fn().mockResolvedValue({ success: false, cancelled: true }), createTask: vi.fn().mockResolvedValue(ok({})), getTaskDetail: vi.fn().mockResolvedValue(ok({})), listTaskDocuments: vi.fn().mockResolvedValue(ok([])) };
  Object.assign(window, { projectHubApi: bridge });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete (window as Window & { projectHubApi?: unknown }).projectHubApi; });
async function choose(label: string, option: string) { fireEvent.click(screen.getByRole('combobox', { name: label })); fireEvent.click(await screen.findByRole('option', { name: option })); }

describe('Tablero y lista de tareas', () => {
  it('presenta las siete fases y conserva los estados personalizados sin inventar destinos', () => {
    expect(taskColumns([], []).map(column => column.name)).toEqual(['Backlog', 'Pendientes', 'Por hacer', 'En curso', 'En revisión', 'Completadas', 'Canceladas']);
    expect(taskColumns([], []).every(column => !column.statusId)).toBe(true);
    const columns = taskColumns([{ ...task, status_id: 'custom', task_statuses: { name: 'Esperando cliente', status_type: 'custom' } }], []);
    expect(columns[columns.length - 1]).toMatchObject({ name: 'Esperando cliente', statusId: 'custom', tasks: [expect.objectContaining({ issue_id: taskId })] });
  });
  it.each([
    ['Backlog', 'backlog'], ['Pendientes', 'todo'], ['En revisión', 'in_review'], ['Canceladas', 'cancelled'],
  ])('usa el ID real de %s en filtros, creación y movimientos sin mezclar Por hacer', async (name, status_type) => {
    const extraId = 'd12f1c01-e433-4f89-869a-8066d33654f3';
    bridge.getTaskOptions.mockResolvedValue(ok({ statuses: [...configuredStatuses, { status_id: extraId, name, status_type }] }));
    render(<ProjectTasks {...props} />); await screen.findByRole('button', { name: /Diseñar el tablero/ });
    const region = screen.getByRole('region', { name });
    fireEvent.drop(region, { dataTransfer: { getData: () => taskId } });
    await waitFor(() => expect(bridge.updateTask).toHaveBeenCalledWith(expect.objectContaining({ updates: { status_id: extraId, expected_updated_at: task.updated_at } })));
    expect(within(screen.getByRole('region', { name: 'Por hacer' })).getByRole('button', { name: /Diseñar el tablero/ })).toBeInTheDocument();
    await choose('Filtrar estado', name);
    await waitFor(() => expect(bridge.listTasks).toHaveBeenLastCalledWith(expect.objectContaining({ statusId: extraId })));
    await waitFor(() => expect(screen.getByRole('button', { name: `Añadir tarea en ${name}` })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: `Añadir tarea en ${name}` }));
    fireEvent.change(screen.getByLabelText('Título de la tarea'), { target: { value: `Tarea ${name}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    await waitFor(() => expect(bridge.createTask).toHaveBeenCalledWith(expect.objectContaining({ task: expect.objectContaining({ status_id: extraId }) })));
  });
  it('las fases sin configuración no ofrecen creación ni aceptan arrastre', async () => {
    render(<ProjectTasks {...props} />); await screen.findByRole('button', { name: /Diseñar el tablero/ });
    const region = screen.getByRole('region', { name: 'Canceladas' });
    expect(within(region).queryByRole('button')).toBeNull();
    fireEvent.drop(region, { dataTransfer: { getData: () => taskId } });
    expect(bridge.updateTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getAllByRole('region').map(region => region.getAttribute('aria-label'))).toEqual(['Backlog', 'Pendientes', 'Por hacer', 'En curso', 'En revisión', 'Completadas', 'Canceladas']);
  });
  it('agrupa en estados reales, muestra responsable y dificultad y conserva los filtros al cambiar de vista', async () => {
    render(<ProjectTasks {...props} />);
    const card = await screen.findByRole('button', { name: /Diseñar el tablero/ });
    expect(within(screen.getByRole('region', { name: 'Por hacer' })).getByRole('button', { name: /Diseñar el tablero/ })).toBe(card);
    expect(within(card).getByText('Ana Torres')).toBeInTheDocument();
    expect(within(card).getByText('Media')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /prioridad/i })).toBeNull();
    await choose('Filtrar dificultad', 'Media');
    await waitFor(() => expect(bridge.listTasks).toHaveBeenLastCalledWith(expect.objectContaining({ difficulty: 'medium' })));
    await screen.findByRole('button', { name: /Diseñar el tablero/ });
    const before = bridge.listTasks.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getByLabelText('Lista de tareas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true');
    expect(bridge.listTasks).toHaveBeenCalledTimes(before);
    expect(screen.getByRole('combobox', { name: 'Filtrar dificultad' })).toHaveTextContent('Media');
  });
  it('combina responsable, estado, ciclo y dificultad y permite limpiar', async () => {
    render(<ProjectTasks {...props} />); await screen.findByText('Ana Torres');
    await choose('Filtrar responsable', 'Ana Torres'); await choose('Filtrar estado', 'En curso'); await choose('Filtrar ciclo', 'Lanzamiento'); await choose('Filtrar dificultad', 'Alta');
    await waitFor(() => expect(bridge.listTasks).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeId: project, statusId: doing, cycleId: project, difficulty: 'high' })));
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(bridge.listTasks).toHaveBeenLastCalledWith(expect.objectContaining({ difficulty: undefined, statusId: undefined, assigneeId: undefined, cycleId: undefined })));
  });
  it('crear desde una columna usa su estado y guarda dificultad sin alterar prioridad', async () => {
    render(<ProjectTasks {...props} />); await screen.findByRole('button', { name: /Diseñar el tablero/ });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir tarea en En curso' }));
    fireEvent.change(screen.getByLabelText('Título de la tarea'), { target: { value: 'Nueva del tablero' } });
    await choose('Dificultad', 'Alta'); fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    await waitFor(() => expect(bridge.createTask).toHaveBeenCalledWith(expect.objectContaining({ task: expect.objectContaining({ title: 'Nueva del tablero', status_id: doing, estimate_points: 8, priority_id: null }) })));
  });
  it('conserva puntos y prioridad preexistentes si sólo se cambia el título', async () => {
    render(<ProjectTasks {...props} />); fireEvent.click(await screen.findByRole('button', { name: /Diseñar el tablero/ }));
    fireEvent.change(screen.getByLabelText('Título de la tarea'), { target: { value: 'Título actualizado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tarea' }));
    await waitFor(() => expect(bridge.updateTask).toHaveBeenCalledWith(expect.objectContaining({ updates: expect.objectContaining({ title: 'Título actualizado', estimate_points: 3, priority_id: done }) })));
  });
  it('mover por arrastre envía la revisión y una cancelación conserva la tarjeta original', async () => {
    render(<ProjectTasks {...props} />); const card = await screen.findByRole('button', { name: /Diseñar el tablero/ });
    const transfer = { setData: vi.fn(), getData: vi.fn().mockReturnValue(taskId), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(card, { dataTransfer: transfer });
    expect(transfer.setData).toHaveBeenCalledWith('application/x-soflia-task', taskId);
    fireEvent.drop(screen.getByRole('region', { name: 'En curso' }), { dataTransfer: transfer });
    await waitFor(() => expect(bridge.updateTask).toHaveBeenCalledWith(expect.objectContaining({ updates: { status_id: doing, expected_updated_at: task.updated_at } })));
    expect(within(screen.getByRole('region', { name: 'Por hacer' })).getByRole('button', { name: /Diseñar el tablero/ })).toBeInTheDocument();
  });
  it('un lector puede abrir el detalle pero no arrastrar ni crear', async () => {
    render(<ProjectTasks {...props} canWrite={false} canManage={false} />); const card = await screen.findByRole('button', { name: /Diseñar el tablero/ });
    expect(card).toHaveAttribute('draggable', 'false'); expect(screen.queryByRole('button', { name: 'Nueva tarea' })).toBeNull();
    fireEvent.drop(screen.getByRole('region', { name: 'En curso' }), { dataTransfer: { getData: () => taskId } });
    expect(bridge.updateTask).not.toHaveBeenCalled(); fireEvent.click(card); expect(screen.getByLabelText('Título de la tarea')).toBeDisabled();
  });
  it('actualizar recarga las tareas y las opciones del filtro', async () => {
    render(<ProjectTasks {...props} />); await screen.findByRole('button', { name: /Diseñar el tablero/ });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar tareas' }));
    await waitFor(() => expect(bridge.getTaskOptions).toHaveBeenCalledTimes(2)); expect(bridge.listTasks).toHaveBeenCalledTimes(2);
  });
  it('no mezcla una respuesta anterior al cambiar de filtro', async () => {
    let finish!: (result: unknown) => void;
    bridge.listTasks.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(ok([{ ...task, title: 'Resultado nuevo' }]));
    render(<ProjectTasks {...props} />); await waitFor(() => expect(bridge.listTasks).toHaveBeenCalled());
    await choose('Filtrar dificultad', 'Baja'); await screen.findByRole('button', { name: /Resultado nuevo/ });
    await act(async () => finish(ok([{ ...task, title: 'Resultado antiguo' }])));
    expect(screen.queryByRole('button', { name: /Resultado antiguo/ })).toBeNull();
  });
  it('comparte límites de dificultad y rechaza valores ajenos al contrato', () => {
    expect([null, 0, 2, 2.5, 5, 5.5, 13].map(taskDifficultyFor)).toEqual(['unestimated', 'low', 'low', 'medium', 'medium', 'high', 'high']);
    expect(projectHubInputs.listTasks.safeParse({ workspaceId: workspace, projectId: project, difficulty: 'urgent' }).success).toBe(false);
  });
  it('una página fallida conserva las tarjetas cargadas y permite reintentar', async () => {
    bridge.listTasks.mockResolvedValueOnce({ ...ok([task]), meta: { next_cursor: '100', has_more: true } }).mockResolvedValueOnce({ success: false, error: 'Conexión interrumpida' });
    render(<ProjectTasks {...props} />); await screen.findByRole('button', { name: /Diseñar el tablero/ });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /Diseñar el tablero/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar tareas' })).toBeEnabled();
  });
  it('no muestra fechas de tareas completadas como vencidas', async () => {
    bridge.listTasks.mockResolvedValue(ok([{ ...task, due_date: '2000-01-01', status_id: done, task_statuses: { name: 'Completadas', status_type: 'done' } }]));
    render(<ProjectTasks {...props} />); const card = await screen.findByRole('button', { name: /Diseñar el tablero/ });
    expect(card.querySelector('.task-date')).not.toHaveClass('is-overdue');
  });
});
