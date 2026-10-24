import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParticipantStudio } from '../../components/learning-live/ParticipantStudio';
import { StudioRuntimeContext, type StudioRuntime } from '../../components/learning-live/instructor/StudioRuntimeContext';
import { StudioMediaContext, type StudioMediaRuntime } from '../../components/learning-live/instructor/StudioMediaContext';
import { emptyStudioState } from '../../shared/live-studio-domain';
import type { StudioSnapshot } from '../../shared/live-studio.contract';
import { askParticipantTutor } from '../../services/participant-tutor';
vi.mock('../../services/participant-tutor',async()=>({...await vi.importActual('../../services/participant-tutor'),askParticipantTutor:vi.fn()}));
const send=vi.fn(),mute=vi.fn(),camera=vi.fn(),captions=vi.fn(),connect=vi.fn();
let snapshot:StudioSnapshot,media:StudioMediaRuntime;
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
beforeEach(()=>{
  vi.clearAllMocks(); send.mockResolvedValue(true);vi.mocked(askParticipantTutor).mockResolvedValue('Piensa en una tarea repetitiva.');
  const state=emptyStudioState();
  state.practices=[{id:'practice',title:'Diseña tu primer flujo',instructions:'Define los pasos de una tarea.'}];
  state.quizzes=[{id:'quiz',question:'¿Qué tarea elegirías?',options:['Repetitiva','Aleatoria'],correct:0}];state.active_quiz_id='quiz';
  state.rooms=[{id:'room',name:'Sala 03',user_ids:['student']},{id:'other',name:'Sala ajena',user_ids:['another']}];
  state.members=[{user_id:'student',name:'Alumno',instructor:false,room_id:null,seen_at:new Date().toISOString()}];
  snapshot={session_id:'session',user_id:'student',can_manage:false,title:'Mi clase',server_time:new Date().toISOString(),state,asset_urls:{}};
  media={zoomConnected:false,zoomPending:false,zoomStage:null,zoomMic:false,zoomCamera:false,connectZoom:connect,muteZoom:mute,toggleZoomCamera:camera,setCaptions:captions,pending:false,mic:null,camera:null,devices:[],callControls:{camera:true,captions:true,captionsEnabled:false}} as unknown as StudioMediaRuntime;
});
function open(){const runtime={snapshot,send,busy:false} as unknown as StudioRuntime;return render(<StudioRuntimeContext.Provider value={runtime}><StudioMediaContext.Provider value={media}><ParticipantStudio onBack={vi.fn()} onClose={vi.fn()}/></StudioMediaContext.Provider></StudioRuntimeContext.Provider>);}
describe('aula del participante',()=>{
  it('muestra un solo acceso a salas y no activa medios al entrar',()=>{
    open();expect(screen.getAllByRole('button',{name:'Salas'})).toHaveLength(1);
    expect(screen.queryByRole('region',{name:'Estadísticas de participación'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Moderar chat'})).not.toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();expect(mute).not.toHaveBeenCalled();expect(camera).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Activar micrófono'}));expect(mute).not.toHaveBeenCalled();expect(screen.getByRole('status')).toHaveTextContent('Únete a la sesión');
  });
  it('solo permite visitar salas asignadas y confirma el cambio académico',async()=>{
    open();fireEvent.click(screen.getByRole('button',{name:'Salas'}));
    const dialog=screen.getByRole('dialog');expect(dialog).toHaveTextContent('Sala 03');expect(dialog).not.toHaveTextContent('Sala ajena');
    fireEvent.click(within(dialog).getByRole('button',{name:'Entrar'}));
    await waitFor(()=>expect(send).toHaveBeenCalledWith({type:'presence',room_id:'room'}));
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('conserva borrador de entrega tras fallo y al cerrar la actividad',async()=>{
    send.mockResolvedValue(false);open();fireEvent.click(screen.getByRole('button',{name:'Abrir actividad'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Tu entrega'}),{target:{value:'Mi solución'}});fireEvent.click(screen.getByRole('button',{name:'Guardar entrega'}));
    await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('No se guardó'));
    fireEvent.click(screen.getByRole('button',{name:'Cerrar actividad'}));fireEvent.click(screen.getByRole('button',{name:'Abrir actividad'}));
    expect(screen.getByRole('textbox',{name:'Tu entrega'})).toHaveValue('Mi solución');
  });
  it('recupera entrega propia del servidor y permite sustituirla por un borrador vacío',()=>{
    snapshot.state.submissions=[{practice_id:'practice',user_id:'student',content:'Entrega guardada',created_at:new Date().toISOString()}];
    open();fireEvent.click(screen.getByRole('button',{name:'Abrir actividad'}));
    expect(screen.getByRole('textbox',{name:'Tu entrega'})).toHaveValue('Entrega guardada');
    fireEvent.change(screen.getByRole('textbox',{name:'Tu entrega'}),{target:{value:''}});
    fireEvent.click(screen.getByRole('button',{name:'Cerrar actividad'}));fireEvent.click(screen.getByRole('button',{name:'Abrir actividad'}));
    expect(screen.getByRole('textbox',{name:'Tu entrega'})).toHaveValue('');expect(screen.getByRole('button',{name:'Guardar entrega'})).toBeDisabled();
  });
  it('envía quiz y solicitudes de palabra a la sala actual con moderación',async()=>{
    snapshot.state.members[0].room_id='room';open();
    fireEvent.click(screen.getByRole('button',{name:'Abrir quiz'}));fireEvent.click(screen.getByRole('button',{name:'ARepetitiva'}));
    await waitFor(()=>expect(send).toHaveBeenCalledWith({type:'answer_quiz',quiz_id:'quiz',answer:0}));
    fireEvent.click(screen.getByRole('button',{name:'Cerrar actividad'}));fireEvent.click(screen.getByRole('button',{name:'Levantar la mano'}));
    await waitFor(()=>expect(send).toHaveBeenCalledWith({type:'post',content:'✋ Solicito la palabra.',question:false,room_id:'room'}));
  });
  it('desactiva solicitud de palabra y reacciones cuando el instructor cierra el chat',()=>{
    snapshot.state.moderation.locked=true;open();expect(screen.getByRole('button',{name:'Levantar la mano'})).toBeDisabled();expect(screen.getByRole('button',{name:'Reacciones'})).toBeDisabled();
  });
  it('conecta controles del SDK y no confunde la cámara con captura local',()=>{
    media.zoomConnected=true;open();fireEvent.click(screen.getByRole('button',{name:'Activar micrófono'}));fireEvent.click(screen.getByRole('button',{name:'Activar cámara'}));fireEvent.click(screen.getByRole('button',{name:'Activar subtítulos automáticos'}));
    expect(mute).toHaveBeenCalledOnce();expect(camera).toHaveBeenCalledOnce();expect(captions).toHaveBeenCalledWith(true);
  });
  it('informa captions no disponibles y rechazo de fullscreen',async()=>{
    media.zoomConnected=true;media.callControls!.captions=false;open();
    fireEvent.click(screen.getByRole('button',{name:'Activar subtítulos automáticos'}));expect(captions).not.toHaveBeenCalled();expect(screen.getByRole('status')).toHaveTextContent('no están habilitados');
    fireEvent.click(screen.getByRole('button',{name:'Ver presentación en pantalla completa'}));
    await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('No se pudo abrir pantalla completa'));
  });
  it('solicita pantalla completa para el escenario con sus controles y captions',async()=>{
    open();const element=screen.getByRole('region',{name:'Escenario de la clase'});const request=vi.fn().mockResolvedValue(undefined);element.requestFullscreen=request;
    fireEvent.click(screen.getByRole('button',{name:'Ver presentación en pantalla completa'}));await waitFor(()=>expect(request).toHaveBeenCalledOnce());
    expect(within(element).getByRole('button',{name:'Activar subtítulos automáticos'})).toBeInTheDocument();
  });
  it('mantiene el borrador público separado y Soflia no publica en el grupo',async()=>{
    open();fireEvent.change(screen.getByRole('textbox',{name:'Tu mensaje al grupo'}),{target:{value:'Borrador público'}});
    fireEvent.click(screen.getByRole('tab',{name:'Soflia'}));fireEvent.change(screen.getByRole('textbox',{name:'Tu pregunta a Soflia'}),{target:{value:'Ayúdame a comprender'}});
    fireEvent.click(screen.getByRole('button',{name:'Enviar pregunta a Soflia'}));
    expect(await screen.findByText('Piensa en una tarea repetitiva.')).toBeInTheDocument();expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab',{name:'Chat del grupo'}));expect(screen.getByRole('textbox',{name:'Tu mensaje al grupo'})).toHaveValue('Borrador público');
  });
  it('aborta la ayuda al salir y descarta una respuesta tardía',async()=>{
    let complete:(value:string)=>void=()=>{};
    vi.mocked(askParticipantTutor).mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
    const view=open();fireEvent.click(screen.getByRole('tab',{name:'Soflia'}));fireEvent.change(screen.getByRole('textbox',{name:'Tu pregunta a Soflia'}),{target:{value:'Pista'}});fireEvent.click(screen.getByRole('button',{name:'Enviar pregunta a Soflia'}));
    const signal=vi.mocked(askParticipantTutor).mock.calls[0][3];view.unmount();expect(signal.aborted).toBe(true);await act(async()=>{complete('Tarde');});
  });
});
