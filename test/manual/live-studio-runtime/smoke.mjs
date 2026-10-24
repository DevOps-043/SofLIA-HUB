import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Exclusivamente contra la fixture local. No acepta destino ni credenciales externos.
const base='http://127.0.0.1:4321';
const reference={organization_slug:'prueba',session_id:'00000000-0000-4000-8000-000000000031'};
const signal=AbortSignal.timeout(20000);
async function request(actor,operation){const response=await fetch(`${base}/__studio?actor=${actor}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...reference,operation}),signal});assert.equal(response.status,200);return response.json();}
async function snapshot(actor){const result=await request(actor,{type:'snapshot'});assert.equal(result.success,true);assert.equal(result.snapshot.title,'Prueba funcional del estudio');return result.snapshot;}
const initial=await snapshot('instructor');assert.equal(initial.can_manage,true);const pupil=await snapshot('alumno');assert.equal(pupil.can_manage,false);
const stream=await fetch(`${base}/__studio-events?actor=alumno`,{signal});assert.equal(stream.headers.get('content-type'),'text/event-stream');
const reader=stream.body.getReader(),decoder=new TextDecoder();let buffer='';
async function event(){while(!buffer.includes('\n\n')){const chunk=await reader.read();assert.equal(chunk.done,false);buffer+=decoder.decode(chunk.value,{stream:true});}const index=buffer.indexOf('\n\n');const message=buffer.slice(0,index);buffer=buffer.slice(index+2);return message;}
assert.match(await event(),/connected/);
async function command(actor,command,success=true){const state=await snapshot(actor);const operation={type:'command',id:randomUUID(),revision:state.state.revision,command};const result=await request(actor,operation);assert.equal(result.success,success,JSON.stringify(result));if(success)assert.match(await event(),/changed/);return {result,operation};}
const marker=`Ensayo local ${randomUUID()}`;
let materialId,quizId;
try{
  await command('alumno',{type:'presence',room_id:null});
  await command('instructor',{type:'post',content:marker,question:false,room_id:null});
  assert.ok((await snapshot('alumno')).state.messages.some(item=>item.content===marker&&item.instructor));
  const sent=await command('alumno',{type:'post',content:`${marker} pregunta`,question:true,room_id:null});
  await request('alumno',sent.operation);
  assert.equal((await snapshot('instructor')).state.messages.filter(item=>item.content===`${marker} pregunta`).length,1);
  await command('instructor',{type:'moderation',locked:true,reactions:false});
  await command('alumno',{type:'post',content:'No debe publicarse',question:false,room_id:null},false);
  await command('instructor',{type:'post',content:`${marker} instructor en modo lectura`,question:false,room_id:null});
  await command('instructor',{type:'moderation',locked:false,reactions:true});
  await command('instructor',{type:'restrict',user_id:pupil.user_id,restriction:'chat'});
  await command('alumno',{type:'post',content:'No debe publicarse',question:false,room_id:null},false);
  await command('instructor',{type:'restrict',user_id:pupil.user_id,restriction:'none'});
  await command('alumno',{type:'presence',room_id:randomUUID()},false);
  const own=(await snapshot('alumno')).state.rooms.find(room=>room.user_ids.includes(pupil.user_id));assert.ok(own);
  await command('alumno',{type:'presence',room_id:own.id});
  await command('alumno',{type:'post',content:`${marker} equipo`,question:false,room_id:own.id});
  await command('alumno',{type:'presence',room_id:null});
  const practice=pupil.state.practices[0];assert.ok(practice);await command('alumno',{type:'submit_practice',practice_id:practice.id,content:marker});assert.equal((await snapshot('alumno')).state.submissions.find(item=>item.practice_id===practice.id).content,marker);
  quizId=randomUUID();await command('instructor',{type:'quiz',quiz:{id:quizId,question:'Quiz de prueba local',options:['A','B'],correct:1}});await command('instructor',{type:'publish_quiz',quiz_id:quizId});
  assert.equal((await snapshot('alumno')).state.quizzes.find(quiz=>quiz.id===quizId).correct,undefined);
  await command('alumno',{type:'answer_quiz',quiz_id:quizId,answer:1});await command('alumno',{type:'answer_quiz',quiz_id:quizId,answer:0},false);
  const bytes=new TextEncoder().encode('Lectura local de prueba');const upload=await request('instructor',{type:'upload',name:'prueba.txt',mime:'text/plain',bytes:bytes.length});assert.equal(upload.success,true);assert.equal(new URL(upload.upload.url).origin,base);
  assert.equal((await fetch(upload.upload.url,{method:'PUT',body:bytes,signal})).status,200);
  materialId=randomUUID();await command('instructor',{type:'material',material:{id:materialId,name:'Lectura local de prueba',kind:'reading',asset_path:upload.upload.path,mime:'text/plain',bytes:bytes.length}});
  const url=(await snapshot('alumno')).asset_urls[upload.upload.path];assert.equal(new URL(url).origin,base);assert.equal(await(await fetch(url,{signal})).text(),'Lectura local de prueba');
  console.log('Ensayo local aprobado: SSE, chat bidireccional, deduplicación, moderación, salas, entrega, quiz y material. Sin reunión Zoom real.');
}finally{
  // Restablece la moderación y el quiz publicados; los mensajes/entrega son ejemplos en memoria.
  await command('instructor',{type:'restrict',user_id:pupil.user_id,restriction:'none'});
  await command('instructor',{type:'moderation',locked:initial.state.moderation.locked,reactions:initial.state.moderation.reactions});
  await command('instructor',{type:'publish_quiz',quiz_id:initial.state.active_quiz_id});
  if(materialId)await command('instructor',{type:'remove_material',material_id:materialId});
  await reader.cancel();
}
