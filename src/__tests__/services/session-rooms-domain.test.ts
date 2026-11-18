import { describe, expect, it } from 'vitest';
import { applyStudioCommand, emptyStudioState, projectStudioState, type StudioActor } from '../../shared/live-studio-domain';
import { studioCommandSchema, type StudioCommand } from '../../shared/live-studio.contract';
import { engineSessionManifestSchema } from '../../shared/engine-preparation.contract';
import { roomDistribution } from '../../components/learning-live/rooms/room-model';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = '2026-11-18T16:00:00.000Z';
const host: StudioActor = { id: id(1), name: 'Instructora', canManage: true, courseId: id(2), status: 'in_progress' };
const student: StudioActor = { ...host, id: id(10), name: 'Ana', canManage: false };
function fixture() {
  const state = emptyStudioState();
  state.practices = [{ id: id(3), title: 'Resuelve el caso', instructions: 'Analicen el caso y documenten su respuesta.', collaboration: { mode: 'teams', team_size: 3 } }];
  state.members = Array.from({ length: 7 }, (_, index) => ({ user_id: id(index + 10), name: `Persona ${index + 1}`, instructor: false, room_id: null, seen_at: now }));
  state.members.push({ user_id: host.id, name: host.name, instructor: true, room_id: null, seen_at: now });
  return state;
}
let next = 100;
const apply = (state: ReturnType<typeof fixture>, command: StudioCommand, actor = host) => applyStudioCommand(state, command, actor, id(90), now, () => id(next++));
const open = (state = fixture()) => apply(state, { type: 'open_rooms', practice_id: id(3), mode: 'size', value: 3 });

describe('salas por actividad', () => {
  it('recibe la propuesta opcional y acepta manifiestos anteriores', () => {
    const manifest = { version: 1, course_id: host.courseId, revision: 'preparacion-1', scenes: [], materials: [], quizzes: [], practices: fixture().practices };
    expect(engineSessionManifestSchema.safeParse(manifest).success).toBe(true);
    expect(engineSessionManifestSchema.safeParse({ ...manifest, practices: [{ id: id(3), title: 'Anterior', instructions: 'Sin modalidad' }] }).success).toBe(true);
    expect(engineSessionManifestSchema.safeParse({ ...manifest, practices: [{ ...fixture().practices[0], collaboration: { mode: 'teams', team_size: 0 } }] }).success).toBe(false);
  });
  it('vincula actividad, balancea equipos y no mueve participantes automáticamente', () => {
    const initial = fixture(), state = open(initial);
    expect(state.rooms.map(room => room.user_ids.length)).toEqual([3, 2, 2]);
    expect(state.room_activity).toEqual({ practice_id: id(3), mode: 'size', value: 3, opened_at: now });
    expect(state.members.every(member => member.room_id === null)).toBe(true);
    expect(new Set(state.rooms.flatMap(room => room.user_ids)).size).toBe(7);
    expect(initial.rooms).toEqual([]);
    expect(state.practices[0].collaboration).toEqual({ mode: 'teams', team_size: 3 });
  });
  it('excluye leases vencidos, instructores y participantes bloqueados', () => {
    const initial = fixture();
    initial.members[1].seen_at = '2026-11-18T15:00:00.000Z';
    initial.moderation.restrictions[id(12)] = 'blocked';
    const users = open(initial).rooms.flatMap(room => room.user_ids);
    expect(users).toHaveLength(5); expect(users).not.toContain(host.id); expect(users).not.toContain(id(11)); expect(users).not.toContain(id(12));
  });
  it('rechaza actividades ajenas, individuales, vacíos y reemplazos durante el trabajo', () => {
    const individual = fixture(); individual.practices[0].collaboration = { mode: 'individual' };
    expect(() => open(individual)).toThrow('individual');
    expect(() => apply(fixture(), { type: 'open_rooms', practice_id: id(999), mode: 'count', value: 2 })).toThrow('sesión');
    const empty = fixture(); empty.members = [];
    expect(() => open(empty)).toThrow('No hay participantes');
    expect(() => open(open())).toThrow('Cierra las salas');
  });
  it('rechaza administración de participantes, estado cerrado y payloads fuera de límite', () => {
    for (const command of [{ type: 'open_rooms', practice_id: id(3), mode: 'size', value: 3 }, { type: 'assign_room', user_id: student.id, room_id: null }, { type: 'rename_room', room_id: id(100), name: 'Nuevo' }, { type: 'close_rooms' }] as StudioCommand[]) {
      expect(() => apply(fixture(), command, student)).toThrow('permisos');
    }
    expect(() => apply(fixture(), { type: 'open_rooms', practice_id: null, mode: 'count', value: 2 }, { ...host, status: 'ended' })).toThrow('cerrada');
    expect(studioCommandSchema.safeParse({ type: 'open_rooms', practice_id: null, mode: 'size', value: 51 }).success).toBe(false);
  });
  it('reasigna una sola vez y devuelve al contexto principal a quien cambia de equipo', () => {
    let state = open(); const source = state.rooms[0], destination = state.rooms[1], user = source.user_ids[0];
    state = apply(state, { type: 'presence', room_id: source.id }, { ...student, id: user });
    state = apply(state, { type: 'assign_room', user_id: user, room_id: destination.id });
    expect(state.rooms.filter(room => room.user_ids.includes(user))).toHaveLength(1);
    expect(state.rooms[1].user_ids).toContain(user);
    expect(state.members.find(member => member.user_id === user)?.room_id).toBeNull();
    expect(() => apply(state, { type: 'presence', room_id: source.id }, { ...student, id: user })).toThrow('asignada');
    expect(apply(state, { type: 'assign_room', user_id: user, room_id: destination.id }).rooms[1].user_ids.filter(entry => entry === user)).toHaveLength(1);
  });
  it('rechaza identidades, destinos, nombres duplicados y actividad modificada en salas abiertas', () => {
    const state = open();
    for (const user of [host.id, id(999)]) expect(() => apply(state, { type: 'assign_room', user_id: user, room_id: state.rooms[0].id })).toThrow('disponible');
    state.moderation.restrictions[student.id] = 'blocked';
    expect(() => apply(state, { type: 'assign_room', user_id: student.id, room_id: state.rooms[0].id })).toThrow('disponible');
    expect(() => apply(state, { type: 'assign_room', user_id: id(11), room_id: id(999) })).toThrow('sesión');
    expect(() => apply(state, { type: 'rename_room', room_id: state.rooms[0].id, name: state.rooms[1].name })).toThrow('nombre');
    expect(() => apply(state, { type: 'practice', practice: state.practices[0] })).toThrow('Cierra las salas');
  });
  it('cierra salas conservando prácticas y entregas', () => {
    let state = open(); state = apply(state, { type: 'submit_practice', practice_id: id(3), content: 'Una respuesta' }, student);
    const closed = apply(state, { type: 'close_rooms' });
    expect(closed.rooms).toEqual([]); expect(closed.room_activity).toBeNull(); expect(closed.practices).toEqual(state.practices); expect(closed.submissions).toEqual(state.submissions);
  });
  it('expone compañeros solo para sus salas y conserva proyección anterior', () => {
    const state = open();
    expect(projectStudioState(state, student, now).rooms.flatMap(room => room.user_ids)).toEqual([student.id]);
    const visible = projectStudioState(state, student, now, true);
    expect(visible.rooms.find(room => room.user_ids.includes(student.id))?.user_ids).toHaveLength(3);
    expect(visible.rooms.filter(room => !room.user_ids.includes(student.id)).every(room => room.user_ids.length === 0)).toBe(true);
  });
  it('previsualiza los mismos tamaños del dominio y valida límites', () => {
    expect(roomDistribution(7, 'size', 3)).toEqual([3, 2, 2]);
    expect(roomDistribution(2, 'count', 50)).toEqual([1, 1]);
    expect(roomDistribution(500, 'size', 1)).toHaveLength(50);
    for (const count of [0, -1, 501, NaN]) expect(roomDistribution(count, 'size', 4)).toEqual([]);
  });
});
