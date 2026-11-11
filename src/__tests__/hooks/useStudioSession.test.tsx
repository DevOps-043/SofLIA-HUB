import { act,renderHook,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { useStudioSession } from '../../components/learning-live/instructor/useStudioSession';
import { emptyStudioState } from '../../shared/live-studio-domain';
import type { StudioSnapshot } from '../../shared/live-studio.contract';

const ref={organization_slug:'prueba',session_id:'00000000-0000-4000-8000-000000000031'};
const studio=vi.fn(),watch=vi.fn(),unwatch=vi.fn();let invalidate:(notice:unknown)=>void;
let snapshot:StudioSnapshot;
beforeEach(()=>{
  vi.clearAllMocks();snapshot={session_id:ref.session_id,user_id:'00000000-0000-4000-8000-000000000013',can_manage:false,title:'Prueba',server_time:new Date().toISOString(),state:emptyStudioState(),asset_urls:{}};
  studio.mockImplementation(async(reference)=>({success:true,snapshot:{...snapshot,session_id:reference.session_id}}));watch.mockResolvedValue({success:true});
  window.learningLive={studio,watchStudio:watch,unwatchStudio:unwatch,onStudioEvent:callback=>{invalidate=callback;return vi.fn();},workspace:vi.fn(),open:vi.fn(),getPending:async()=>null,onRequested:()=>()=>{}};
});
afterEach(()=>{delete window.learningLive;});

describe('suscripción y recuperación del estudio',()=>{
  it('reanuda suscripción y presencia si la primera lectura falla y después se reintenta',async()=>{
    studio.mockResolvedValueOnce({success:false,code:'unavailable',error:'Primera carga sin red'});
    const {result}=renderHook(()=>useStudioSession(ref));await waitFor(()=>expect(result.current.error).toBe('Primera carga sin red'));expect(watch).not.toHaveBeenCalled();
    await act(async()=>result.current.reconnect());expect(watch).toHaveBeenCalledOnce();expect(studio.mock.calls.some(([,operation])=>operation.type==='command'&&operation.command.type==='presence')).toBe(true);expect(result.current.error).toBe('');
  });
  it('recupera el snapshot tras invalidación y limpia un fallo transitorio de lectura',async()=>{
    const {result}=renderHook(()=>useStudioSession(ref));await waitFor(()=>expect(watch).toHaveBeenCalledOnce());
    await waitFor(()=>expect(result.current.busy).toBe(false));
    studio.mockResolvedValueOnce({success:false,code:'unavailable',error:'Sin red'});
    await act(async()=>invalidate({session_id:ref.session_id,status:'changed'}));expect(result.current.error).toBe('Sin red');
    snapshot={...snapshot,state:{...snapshot.state,revision:1,messages:[{id:'00000000-0000-4000-8000-000000000071',user_id:snapshot.user_id,author:'Alumno',instructor:false,content:'Nuevo',question:false,room_id:null,created_at:new Date().toISOString()}]}};
    await act(async()=>invalidate({session_id:ref.session_id,status:'connected'}));await waitFor(()=>expect(result.current.snapshot?.state.messages[0].content).toBe('Nuevo'));expect(result.current.error).toBe('');expect(result.current.realtime).toBe('Realtime conectado');
  });
  it('permite reintentar la suscripción fallida sin crear intentos simultáneos',async()=>{
    watch.mockResolvedValueOnce({success:false});const {result}=renderHook(()=>useStudioSession(ref));await waitFor(()=>expect(result.current.realtime).toBe('Realtime no disponible'));
    await act(async()=>{await Promise.all([result.current.reconnect(),result.current.reconnect()]);});expect(watch).toHaveBeenCalledTimes(2);
  });
  it('no permite que una suscripción anterior pendiente cierre la nueva sesión',async()=>{
    let complete!:(value:{success:boolean})=>void;watch.mockReturnValueOnce(new Promise(resolve=>{complete=resolve;}));
    const {rerender}=renderHook(({reference})=>useStudioSession(reference),{initialProps:{reference:ref}});await waitFor(()=>expect(watch).toHaveBeenCalledOnce());
    rerender({reference:{...ref,session_id:'00000000-0000-4000-8000-000000000032'}});await waitFor(()=>expect(watch).toHaveBeenCalledTimes(2));expect(unwatch).toHaveBeenCalledOnce();
    await act(async()=>complete({success:false}));expect(unwatch).toHaveBeenCalledOnce();
  });
  it('ignora invalidaciones de otra sesión y libera la suscripción al salir',async()=>{
    const {unmount}=renderHook(()=>useStudioSession(ref));await waitFor(()=>expect(watch).toHaveBeenCalledOnce());await waitFor(()=>expect(studio.mock.calls.some(([,op])=>op.type==='command')).toBe(true));
    studio.mockClear();await act(async()=>invalidate({session_id:'otra',status:'changed'}));expect(studio).not.toHaveBeenCalled();unmount();expect(unwatch).toHaveBeenCalledOnce();
  });
});
