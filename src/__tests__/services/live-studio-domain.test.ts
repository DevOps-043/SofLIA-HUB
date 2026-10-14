import { describe, expect, it } from 'vitest';
import { applyStudioCommand, emptyStudioState, projectStudioState, type StudioActor } from '../../shared/live-studio-domain';
import { studioRequestSchema, studioSnapshotSchema, type StudioCommand } from '../../shared/live-studio.contract';

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const now = '2026-10-12T20:00:00.000Z';
const teacher: StudioActor = { id: uuid(1), name: 'Instructor', canManage: true, courseId: uuid(100), status: 'live' };
const student: StudioActor = { ...teacher, id: uuid(2), name: 'Participante', canManage: false };
const another: StudioActor = { ...student, id: uuid(3), name: 'Otro participante' };
const apply = (state: ReturnType<typeof emptyStudioState>, command: StudioCommand, actor = teacher) => applyStudioCommand(state, command, actor, uuid(9), now, () => crypto.randomUUID());

describe('dominio del estudio en vivo', () => {
  it('rechaza elevar permisos, campos extra y tamaños fuera de contrato', () => {
    expect(studioRequestSchema.safeParse({ organization_slug: 'acme', session_id: uuid(4), operation: { type: 'zoom', role: 1 } }).success).toBe(false);
    expect(() => apply(emptyStudioState(), { type: 'moderation', locked: true, reactions: false }, student)).toThrow('permisos');
    expect(() => apply(emptyStudioState(), { type: 'post', content: 'x'.repeat(2001), question: false, room_id: null })).toThrow();
  });
  it('deriva identidad del servidor, respeta bloqueo y conserva el chat del instructor', () => {
    let state = apply(emptyStudioState(), { type: 'presence', room_id: null }, student);
    state = apply(state, { type: 'moderation', locked: true, reactions: false });
    expect(() => apply(state, { type: 'post', content: 'Hola', question: false, room_id: null }, student)).toThrow('modo lectura');
    state = apply(state, { type: 'post', content: 'Hola grupo', question: false, room_id: null });
    expect(state.messages[0]).toMatchObject({ user_id: teacher.id, instructor: true, author: teacher.name });
    state = apply(state, { type: 'restrict', user_id: student.id, restriction: 'blocked' });
    expect(() => projectStudioState(state, student, now)).toThrow('bloqueado');
    state = apply(state, { type: 'restrict', user_id: student.id, restriction: 'none' });
    expect(() => projectStudioState(state, student, now)).not.toThrow();
  });
  it('distribuye identidades conectadas y aísla lectura/escritura de salas', () => {
    let state = apply(emptyStudioState(), { type: 'presence', room_id: null }, student);
    state = apply(state, { type: 'presence', room_id: null }, another);
    state = apply(state, { type: 'rooms', mode: 'count', value: 2 });
    expect(state.rooms).toHaveLength(2);
    expect(state.rooms.flatMap((room) => room.user_ids).sort()).toEqual([student.id, another.id].sort());
    const own = state.rooms.find((room) => room.user_ids.includes(student.id))!;
    const other = state.rooms.find((room) => !room.user_ids.includes(student.id))!;
    expect(() => apply(state, { type: 'presence', room_id: other.id }, student)).toThrow('asignada');
    state = apply(state, { type: 'presence', room_id: own.id }, student);
    state = apply(state, { type: 'post', content: 'Pregunta privada de sala', question: true, room_id: own.id }, student);
    expect(projectStudioState(state, another, now).messages).toEqual([]);
    expect(projectStudioState(state, teacher, now).messages).toHaveLength(1);
    state = apply(state, { type: 'close_rooms' });
    expect(state.members.every((member) => member.room_id === null)).toBe(true);
  });
  it('oculta claves y entregas ajenas, y no acepta respuestas fuera de rango o duplicadas', () => {
    let state = apply(emptyStudioState(), { type: 'quiz', quiz: { id: uuid(10), question: '¿Cuál?', options: ['Uno', 'Dos'], correct: 1 } });
    state = apply(state, { type: 'publish_quiz', quiz_id: uuid(10) });
    expect(() => apply(state, { type: 'answer_quiz', quiz_id: uuid(10), answer: 2 }, student)).toThrow('disponibles');
    state = apply(state, { type: 'answer_quiz', quiz_id: uuid(10), answer: 1 }, student);
    expect(() => apply(state, { type: 'answer_quiz', quiz_id: uuid(10), answer: 0 }, student)).toThrow('Ya respondiste');
    expect(projectStudioState(state, student, now).quizzes[0]).not.toHaveProperty('correct');
    expect(projectStudioState(state, another, now).answers).toEqual([]);
    expect(studioSnapshotSchema.safeParse({ session_id: uuid(30), user_id: student.id, can_manage: false, title: 'Clase', server_time: now, state: projectStudioState(state, student, now), asset_urls: {} }).success).toBe(true);
  });
  it('valida curso Engine, ids duplicados y prepara estado sin datos ficticios', () => {
    const manifest = { version: 1 as const, course_id: uuid(100), revision: 'rev-1', scenes: [{ id: uuid(40), name: 'Inicio', kind: 'slide' as const, title: 'Hola', description: '' }], materials: [], quizzes: [], practices: [] };
    expect(() => apply(emptyStudioState(), { type: 'import_engine', manifest: { ...manifest, course_id: uuid(101) } })).toThrow('otro curso');
    expect(() => apply(emptyStudioState(), { type: 'import_engine', manifest: { ...manifest, scenes: [manifest.scenes[0], manifest.scenes[0]] } })).toThrow('duplicados');
    const state = apply(emptyStudioState(), { type: 'import_engine', manifest });
    expect(state.messages).toEqual([]); expect(state.members).toEqual([]); expect(state.active_scene_id).toBe(uuid(40));
  });
  it('limita historia, ignora leases vencidos y deniega una sesión cerrada', () => {
    let state = emptyStudioState();
    for (let i = 0; i < 102; i++) state = apply(state, { type: 'post', content: `Mensaje ${i}`, question: false, room_id: null });
    expect(state.messages).toHaveLength(100);
    state = apply(state, { type: 'presence', room_id: null }, student);
    expect(projectStudioState(state, teacher, '2026-10-12T20:02:00.000Z').members).toEqual([]);
    expect(() => apply(state, { type: 'post', content: 'Hola', question: false, room_id: null }, { ...teacher, status: 'ended' })).toThrow('cerrada');
  });
});
