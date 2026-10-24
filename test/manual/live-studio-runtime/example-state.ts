import { emptyStudioState } from '../../../src/shared/live-studio-domain';

/** Contenido ficticio exclusivo de la prueba local, nunca datos de producción. */
export function exampleStudioState() {
  const state=emptyStudioState();
  // Este ejemplo arranca con cinco segundos para revisar la cuenta regresiva.
  state.moderation.message_interval_seconds=5;
  const scene='00000000-0000-4000-8000-000000000051';
  const instructor='00000000-0000-4000-8000-000000000011';
  const student='00000000-0000-4000-8000-000000000013';
  const now=new Date().toISOString();
  state.scenes=[{id:scene,name:'Inicio',kind:'slide',title:'De una idea\na un flujo de trabajo.',description:'Elige una tarea repetitiva.\nConstruye el primer paso con tu equipo.'}];state.active_scene_id=scene;
  state.practices=[{id:'00000000-0000-4000-8000-000000000052',title:'Diseña tu primer flujo',instructions:'Identifica una tarea repetitiva y define sus pasos. Comparte tu propuesta con el equipo.'}];
  state.quizzes=[{id:'00000000-0000-4000-8000-000000000053',question:'¿Qué tarea conviene automatizar primero?',options:['Una tarea repetitiva con entradas claras','Una tarea sin resultado definido'],correct:0}];state.active_quiz_id=state.quizzes[0].id;
  state.rooms=[{id:'00000000-0000-4000-8000-000000000054',name:'Equipo 01',user_ids:[student]}];
  state.messages=[{id:'00000000-0000-4000-8000-000000000055',user_id:instructor,author:'Instructor de prueba',instructor:true,content:'¡Bienvenidos! Hoy vamos a convertir una idea en algo que podamos usar.',question:false,room_id:null,created_at:now}];
  state.members=[{user_id:instructor,name:'Instructor de prueba',instructor:true,room_id:null,seen_at:now}];
  return state;
}
