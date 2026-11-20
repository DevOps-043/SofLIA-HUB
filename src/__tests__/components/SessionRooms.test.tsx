import { useState } from 'react';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructorRoomPanel } from '../../components/learning-live/rooms/InstructorRoomPanel';
import { RoomWorkspace } from '../../components/learning-live/rooms/RoomWorkspace';
import { InstructorStudio } from '../../components/learning-live/instructor/InstructorStudio';
import { ParticipantStudio } from '../../components/learning-live/ParticipantStudio';
import { StudioRuntimeContext, type StudioRuntime } from '../../components/learning-live/instructor/StudioRuntimeContext';
import { StudioMediaContext, type StudioMediaRuntime } from '../../components/learning-live/instructor/StudioMediaContext';
import { emptyStudioState, applyStudioCommand } from '../../shared/live-studio-domain';
import { studioStateSchema, type StudioSnapshot, type StudioCommand } from '../../shared/live-studio.contract';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = '2026-11-18T16:00:00.000Z';
let snapshot: StudioSnapshot;
const send = vi.fn(), visit = vi.fn();
let media: StudioMediaRuntime;
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); }; });
beforeEach(() => {
  vi.clearAllMocks(); send.mockResolvedValue(true); visit.mockResolvedValue(true);
  const state = emptyStudioState();
  state.practices = [{ id: id(3), title: 'Diseña una solución', instructions: 'Analicen el problema.\nPropongan una solución.', collaboration: { mode: 'teams', team_size: 3 } }, { id: id(4), title: 'Reflexión individual', instructions: 'Reflexiona sobre el caso.', collaboration: { mode: 'individual' } }];
  state.members = Array.from({ length: 7 }, (_, index) => ({ user_id: id(10 + index), name: `Persona ${index + 1}`, instructor: false, room_id: null, seen_at: now }));
  snapshot = { rooms_version: 1, participation_version: 1, user_id: id(1), session_id: id(2), can_manage: true, title: 'Sesión de prueba', server_time: now, state, asset_urls: {} };
  media = { zoomConnected: true, zoomPending: false, zoomStage: <iframe title="Llamada persistente" />, zoomMic: false, zoomCamera: false, visitRoom: visit, callControls: { camera: true, captions: false, captionsEnabled: false }, roomsStatus: { status: 'ready', missing: 0 } } as unknown as StudioMediaRuntime;
});
function openRooms() {
  snapshot.state = applyStudioCommand(studioStateSchema.parse(snapshot.state), { type: 'open_rooms', practice_id: id(3), mode: 'size', value: 3 }, { id: id(1), name: 'Instructora', canManage: true, courseId: id(2), status: 'in_progress' }, id(90), now, () => crypto.randomUUID());
}
function Harness({ children, reactive = false }: { children: React.ReactNode; reactive?: boolean }) {
  const [value, setValue] = useState(snapshot);
  async function execute(command: StudioCommand) {
    const ok = await send(command);
    if (ok && reactive) setValue(previous => ({ ...previous, state: applyStudioCommand(studioStateSchema.parse(previous.state), command, { id: previous.user_id, name: 'Instructora', canManage: previous.can_manage, courseId: id(2), status: 'in_progress' }, crypto.randomUUID(), now, () => crypto.randomUUID()) }));
    return ok;
  }
  return <StudioRuntimeContext.Provider value={{ snapshot: value, busy: false, realtime: '', error: '', send: execute, refresh: vi.fn(), upload: vi.fn() } as StudioRuntime}><StudioMediaContext.Provider value={media}>{children}</StudioMediaContext.Provider></StudioRuntimeContext.Provider>;
}
describe('panel y espacio de salas', () => {
  it('recibe propuesta, permite ajustarla y abre con los valores efectivos confirmados', async () => {
    render(<Harness reactive><InstructorRoomPanel onReturn={vi.fn()} /></Harness>);
    fireEvent.change(screen.getByLabelText('Actividad de las salas'), { target: { value: id(3) } });
    expect(screen.getByLabelText('Personas por sala')).toHaveValue(3);
    expect(screen.getByText(/PROPUESTA DE ARCHITECT/)).toHaveTextContent('≈ 3');
    fireEvent.change(screen.getByLabelText('Personas por sala'), { target: { value: '2' } });
    expect(screen.getByLabelText('Vista previa de distribución')).toHaveTextContent('4 salas');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir salas de trabajo' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith({ type: 'open_rooms', practice_id: id(3), mode: 'size', value: 2 }));
    await screen.findByRole('region', { name: 'Asignaciones del grupo' });
    expect(screen.getAllByRole('button', { name: /Visitar Sala/ })).toHaveLength(4);
  });
  it('bloquea la apertura vacía e individual y degrada explícitamente contra servidor antiguo', () => {
    snapshot.state.members = [];
    const first = render(<Harness><InstructorRoomPanel onReturn={vi.fn()} /></Harness>);
    expect(screen.getByRole('button', { name: 'Abrir salas de trabajo' })).toBeDisabled(); first.unmount();
    beforeEmptyRestore();
    const second = render(<Harness><InstructorRoomPanel onReturn={vi.fn()} /></Harness>);
    fireEvent.change(screen.getByLabelText('Actividad de las salas'), { target: { value: id(4) } });
    expect(screen.getByRole('button', { name: 'Abrir salas de trabajo' })).toBeDisabled(); second.unmount();
    delete snapshot.rooms_version;
    render(<Harness><InstructorRoomPanel onReturn={vi.fn()} /></Harness>);
    expect(screen.getByLabelText('Actividad de las salas')).toBeDisabled(); expect(screen.getByText(/Actualiza Learning/)).toBeVisible();
  });
  it('mantiene asignación anterior ante fallo y no anuncia visita exitosa sin confirmación', async () => {
    openRooms(); send.mockResolvedValue(false); visit.mockResolvedValue(false);
    render(<Harness><InstructorRoomPanel onReturn={vi.fn()} /></Harness>);
    const select = screen.getByLabelText('Sala de Persona 1'); const old = (select as HTMLSelectElement).value;
    fireEvent.change(select, { target: { value: snapshot.state.rooms[1].id } });
    await screen.findByText(/No se guardó el cambio/); expect(select).toHaveValue(old);
    fireEvent.click(screen.getByRole('button', { name: `Visitar ${snapshot.state.rooms[0].name}` }));
    await screen.findByText(/No se confirmó el cambio de sala/); expect(visit).toHaveBeenCalledOnce();
  });
  it('renombra y exige cierre explícito conservando la actividad', async () => {
    openRooms(); render(<Harness reactive><InstructorRoomPanel onReturn={vi.fn()} /></Harness>);
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar Sala 1' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Equipo norte' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    await screen.findByRole('heading', { name: 'Equipo norte' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar salas' }));
    expect(send).not.toHaveBeenCalledWith({ type: 'close_rooms' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar salas y reunir al grupo' }));
    await screen.findByRole('button', { name: 'Abrir salas de trabajo' });
    expect(screen.getByLabelText('Actividad de las salas')).toHaveTextContent('Diseña una solución');
  });
  it('muestra instrucciones, integrantes y entrega personal conservando borrador al reintentar', async () => {
    openRooms(); snapshot.can_manage = false; snapshot.user_id = id(10); snapshot.state.members[0].room_id = snapshot.state.rooms[0].id;
    send.mockResolvedValue(false);
    render(<Harness><RoomWorkspace /></Harness>);
    expect(screen.getByText(/Analicen el problema/)).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Mi equipo' }));
    expect(screen.getByText('Persona 1 (tú)')).toBeVisible(); expect(screen.getByText('3 asignados', { exact: false })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Mi entrega' }));
    fireEvent.change(screen.getByLabelText('Tu respuesta individual'), { target: { value: 'Nuestra propuesta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mi entrega' }));
    await screen.findByText(/No se guardó tu entrega/);
    expect(screen.getByLabelText('Tu respuesta individual')).toHaveValue('Nuestra propuesta');
    send.mockResolvedValue(true); fireEvent.click(screen.getByRole('button', { name: 'Guardar mi entrega' }));
    await screen.findByText('Entrega guardada en Learning.');
    expect(send).toHaveBeenLastCalledWith({ type: 'submit_practice', practice_id: id(3), content: 'Nuestra propuesta' });
  });
  it('serializa visitas y conserva la ubicación visible cuando falla el transporte', async () => {
    openRooms(); snapshot.user_id = id(10); snapshot.can_manage = false; snapshot.state.members[0].room_id = snapshot.state.rooms[0].id;
    let resolve!: (ok: boolean) => void; visit.mockImplementation(() => new Promise<boolean>(done => { resolve = done; }));
    render(<Harness><RoomWorkspace /></Harness>);
    fireEvent.click(screen.getByRole('button', { name: 'Volver al grupo principal' }));
    expect(screen.getByRole('button', { name: 'Cambiando…' })).toBeDisabled();
    await act(async () => resolve(false));
    expect(screen.getByRole('region', { name: 'Espacio de trabajo de la sala' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('No se confirmó'); expect(visit).toHaveBeenCalledOnce();
  });
  it('conserva iframe, chat y controles al gestionar salas desde el estudio', async () => {
    render(<Harness><InstructorStudio onBack={vi.fn()} onClose={vi.fn()} /></Harness>);
    const frame = screen.getByTitle('Llamada persistente');
    fireEvent.click(screen.getByRole('button', { name: 'Gestionar salas de trabajo' }));
    expect(screen.getByRole('region', { name: 'Panel de salas' })).toBeVisible();
    expect(screen.getByTitle('Llamada persistente')).toBe(frame);
    expect(screen.getByRole('navigation', { name: 'Controles de la transmisión' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Ver transmisión' }));
    expect(screen.getByTitle('Llamada persistente')).toBe(frame);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Panel de salas' })).not.toBeInTheDocument());
  });
  it('mantiene escenario, chat lateral y barra inferior dentro de la sala', () => {
    openRooms(); snapshot.user_id = id(10); snapshot.can_manage = false; snapshot.state.members[0].room_id = snapshot.state.rooms[0].id;
    render(<Harness><ParticipantStudio onBack={vi.fn()} onClose={vi.fn()} /></Harness>);
    expect(screen.getByRole('region', { name: 'Espacio de trabajo de la sala' })).toBeVisible();
    expect(screen.getByTitle('Llamada persistente')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Conversaciones de la sesión' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Controles de participación' })).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Espacio de trabajo de la sala' })).getByRole('tab', { name: 'Instrucciones' })).toHaveAttribute('aria-selected', 'true');
  });
  it('oculta y amplía el lateral sin perder la llamada, el mensaje ni la entrega', () => {
    openRooms(); snapshot.user_id = id(10); snapshot.can_manage = false;
    const roomId = snapshot.state.rooms[0].id;
    snapshot.state.members[0].room_id = roomId;
    media.callVisual = { roomId, cameras: true, remoteShare: false };
    render(<Harness><ParticipantStudio onBack={vi.fn()} onClose={vi.fn()} /></Harness>);
    const frame = screen.getByTitle('Llamada persistente');
    const controls = within(screen.getByRole('navigation', { name: 'Vista de la sala' }));
    const panel = () => screen.queryByRole('region', { name: 'Espacio de trabajo de la sala' });
    const chat = () => screen.queryByRole('log', { name: 'Mensajes de Sala 1' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tu mensaje al grupo' }), { target: { value: 'Mensaje en borrador' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Mi entrega' }));
    fireEvent.change(screen.getByLabelText('Tu respuesta individual'), { target: { value: 'Entrega en borrador' } });

    fireEvent.click(controls.getByRole('button', { name: 'Solo video' }));
    expect(panel()).toBeNull(); expect(chat()).toBeNull(); expect(frame).toBeVisible();
    fireEvent.click(controls.getByRole('button', { name: 'Chat' }));
    expect(panel()).toBeNull(); expect(chat()).toBeVisible();
    fireEvent.click(controls.getByRole('button', { name: 'Ampliar lateral' }));
    expect(frame).not.toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Tu mensaje al grupo' })).toHaveValue('Mensaje en borrador');
    fireEvent.click(controls.getByRole('button', { name: 'Actividad' }));
    expect(panel()).toBeVisible(); expect(chat()).toBeNull(); expect(frame).not.toBeVisible();
    expect(screen.getByLabelText('Tu respuesta individual')).toHaveValue('Entrega en borrador');
    expect(screen.getByRole('navigation', { name: 'Controles de participación' })).toBeVisible();
    fireEvent.click(controls.getByRole('button', { name: 'Mostrar video' }));
    fireEvent.click(controls.getByRole('button', { name: 'Ambos' }));
    expect(panel()).toBeVisible(); expect(chat()).toBeVisible();
    expect(screen.getByTitle('Llamada persistente')).toBe(frame); expect(frame).toBeVisible();
    expect(send).not.toHaveBeenCalled();
  });
  it('muestra presentes en la galería y solo revela el iframe cuando coincide la sala audiovisual', () => {
    openRooms(); snapshot.user_id=id(10); snapshot.can_manage=false;
    const roomId=snapshot.state.rooms[0].id;
    snapshot.state.members[0].room_id=roomId;
    snapshot.state.members[1].room_id=snapshot.state.rooms[1].id;
    media.programAudioAvailable=true;
    media.callVisual={roomId:snapshot.state.rooms[1].id,cameras:true,remoteShare:false};
    const renderStudio=()=><Harness><ParticipantStudio onBack={vi.fn()} onClose={vi.fn()} /></Harness>;
    const view=render(renderStudio());
    const gallery=screen.getByRole('region',{name:'Galería de la sala'});
    const frame=screen.getByTitle('Llamada persistente');
    expect(frame).not.toBeVisible();
    expect(within(gallery).getByText('Persona 1 (tú)')).toBeVisible();
    expect(within(gallery).queryByText('Persona 2')).not.toBeInTheDocument();
    const side=screen.getByRole('complementary',{name:'Conversaciones de la sesión'});
    expect(within(side).getByText(/Analicen el problema/)).toBeVisible();
    expect(within(side).getByRole('log',{name:'Mensajes de Sala 1'})).toBeVisible();
    media={...media,callVisual:{roomId,cameras:false,remoteShare:false}};
    view.rerender(renderStudio());
    expect(screen.getByTitle('Llamada persistente')).toBe(frame);
    expect(frame).toBeVisible();
    expect(within(gallery).queryByText('Persona 1 (tú)')).not.toBeInTheDocument();
  });
  it('abre la galería del instructor al confirmar una visita y coloca actividad y chat en su lateral', async () => {
    openRooms(); media.visitRoom=undefined;
    render(<Harness reactive><InstructorStudio onBack={vi.fn()} onClose={vi.fn()} /></Harness>);
    const frame=screen.getByTitle('Llamada persistente');
    fireEvent.click(screen.getByRole('button',{name:'Gestionar salas de trabajo'}));
    fireEvent.click(screen.getByRole('button',{name:'Visitar Sala 1'}));
    const gallery=await screen.findByRole('region',{name:'Galería de la sala'});
    expect(within(gallery).getByText('Instructora (tú)')).toBeVisible();
    expect(screen.getByTitle('Llamada persistente')).toBe(frame);
    const details=screen.getByRole('region',{name:'Espacio de trabajo de la sala'});
    expect(within(details).getByText(/Analicen el problema/)).toBeVisible();
    expect(screen.getByRole('log',{name:'Mensajes de Sala 1'}).closest('.room-split-sidebar')).toContainElement(details);

    const controls = within(screen.getByRole('navigation', { name: 'Vista de la sala' }));
    fireEvent.click(controls.getByRole('button', { name: 'Solo video' }));
    expect(details).not.toBeVisible(); expect(gallery).toBeVisible();
    fireEvent.click(controls.getByRole('button', { name: 'Chat' }));
    expect(details).not.toBeVisible(); expect(screen.getByRole('log', { name: 'Mensajes de Sala 1' })).toBeVisible();
    fireEvent.click(controls.getByRole('button', { name: 'Actividad' }));
    fireEvent.click(controls.getByRole('button', { name: 'Ampliar lateral' }));
    expect(details).toBeVisible(); expect(gallery).not.toBeVisible();
    expect(screen.queryByRole('log', { name: 'Mensajes de Sala 1' })).toBeNull();
    expect(screen.getByTitle('Llamada persistente')).toBe(frame);
  });
  it('mantiene acceso a actividades, quizzes y materiales también en salas anteriores', () => {
    openRooms(); snapshot.user_id = id(10); snapshot.can_manage = false; snapshot.state.members[0].room_id = snapshot.state.rooms[0].id;
    delete snapshot.rooms_version; delete snapshot.state.room_activity;
    snapshot.state.quizzes=[{id:id(70),question:'¿Cómo resolver el caso?',options:['A','B']}];snapshot.state.active_quiz_id=id(70);
    snapshot.state.materials=[{id:id(71),name:'Lectura del equipo',kind:'reading',asset_path:'sesion/lectura',mime:'text/plain',bytes:20}];snapshot.asset_urls['sesion/lectura']='https://example.test/material';
    render(<Harness><ParticipantStudio onBack={vi.fn()} onClose={vi.fn()} /></Harness>);
    fireEvent.click(screen.getByRole('tab',{name:'Actividades y materiales'}));
    expect(screen.getByRole('button',{name:'Abrir quiz'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:'Materiales 1'}));
    expect(screen.getByRole('link',{name:'Abrir material'})).toHaveAttribute('href','https://example.test/material');
    fireEvent.click(screen.getByRole('tab',{name:'Actividades 3'}));
    fireEvent.click(screen.getAllByRole('button',{name:'Abrir actividad'})[0]);
    fireEvent.change(screen.getByRole('textbox',{name:'Tu entrega'}),{target:{value:'Borrador de la sala anterior'}});
    fireEvent.click(screen.getByRole('tab',{name:'Instrucciones'}));
    fireEvent.click(screen.getByRole('tab',{name:'Actividades y materiales'}));
    expect(screen.getByRole('textbox',{name:'Tu entrega'})).toHaveValue('Borrador de la sala anterior');
  });
  it('comparte un solo borrador entre la entrega de sala y la misma práctica en actividades', () => {
    openRooms();snapshot.user_id=id(10);snapshot.can_manage=false;snapshot.state.members[0].room_id=snapshot.state.rooms[0].id;
    render(<Harness><ParticipantStudio onBack={vi.fn()} onClose={vi.fn()}/></Harness>);
    fireEvent.click(screen.getByRole('tab',{name:'Mi entrega'}));
    fireEvent.change(screen.getByLabelText('Tu respuesta individual'),{target:{value:'Una única respuesta'}});
    fireEvent.click(screen.getByRole('tab',{name:'Actividades y materiales'}));
    fireEvent.click(screen.getAllByRole('button',{name:'Abrir actividad'})[0]);
    expect(screen.getByLabelText('Tu entrega')).toHaveValue('Una única respuesta');
    fireEvent.change(screen.getByLabelText('Tu entrega'),{target:{value:'Respuesta compartida actualizada'}});
    fireEvent.click(screen.getByRole('tab',{name:'Mi entrega'}));
    expect(screen.getByLabelText('Tu respuesta individual')).toHaveValue('Respuesta compartida actualizada');
  });
});
function beforeEmptyRestore() { snapshot.state.members = [{ user_id: id(10), name: 'Persona 1', instructor: false, room_id: null, seen_at: now }]; }
