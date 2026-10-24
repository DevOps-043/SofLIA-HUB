import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach,beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParticipantStudio } from '../../components/learning-live/ParticipantStudio';
import { StudioRuntimeContext, type StudioRuntime } from '../../components/learning-live/instructor/StudioRuntimeContext';
import { StudioMediaContext, type StudioMediaRuntime } from '../../components/learning-live/instructor/StudioMediaContext';
import { emptyStudioState } from '../../shared/live-studio-domain';
import type { StudioSnapshot } from '../../shared/live-studio.contract';
import { askParticipantTutor } from '../../services/participant-tutor';
vi.mock('../../services/participant-tutor',async()=>({...await vi.importActual('../../services/participant-tutor'),askParticipantTutor:vi.fn()}));
const send=vi.fn(),mute=vi.fn(),camera=vi.fn(),captions=vi.fn(),connect=vi.fn();
let snapshot:StudioSnapshot,media:StudioMediaRuntime;
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};if(!window.PointerEvent)window.PointerEvent=class extends MouseEvent{readonly pointerId:number;constructor(type:string,init:PointerEventInit={}){super(type,init);this.pointerId=init.pointerId??1;}} as typeof PointerEvent;});
beforeEach(()=>{
  vi.clearAllMocks(); send.mockResolvedValue(true);vi.mocked(askParticipantTutor).mockResolvedValue('Piensa en una tarea repetitiva.');
  const state=emptyStudioState();
  state.practices=[{id:'practice',title:'Diseña tu primer flujo',instructions:'Define los pasos de una tarea.'}];
  state.quizzes=[{id:'quiz',question:'¿Qué tarea elegirías?',options:['Repetitiva','Aleatoria'],correct:0}];state.active_quiz_id='quiz';
  state.rooms=[{id:'room',name:'Sala 03',user_ids:['student']},{id:'other',name:'Sala ajena',user_ids:['another']}];
  state.members=[{user_id:'student',name:'Alumno',instructor:false,room_id:null,seen_at:new Date().toISOString()}];
  snapshot={participation_version:1,session_id:'session',user_id:'student',can_manage:false,title:'Mi clase',server_time:new Date().toISOString(),state,asset_urls:{}};
  media={zoomConnected:false,zoomPending:false,zoomStage:null,zoomMic:false,zoomCamera:false,connectZoom:connect,muteZoom:mute,toggleZoomCamera:camera,setCaptions:captions,pending:false,mic:null,camera:null,devices:[],callControls:{camera:true,captions:true,captionsEnabled:false}} as unknown as StudioMediaRuntime;
});
function open(){const runtime={snapshot,send,busy:false} as unknown as StudioRuntime;return render(<StudioRuntimeContext.Provider value={runtime}><StudioMediaContext.Provider value={media}><ParticipantStudio onBack={vi.fn()} onClose={vi.fn()}/></StudioMediaContext.Provider></StudioRuntimeContext.Provider>);}
afterEach(()=>vi.useRealTimers());
describe('aula del participante',()=>{
  it('abre el aula anterior sin mostrar reacciones que el servidor aún no soporta',()=>{
    delete snapshot.participation_version;open();
    expect(screen.getByRole('region',{name:'Aula del participante'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Reacciones'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Activar micrófono'})).toBeEnabled();expect(connect).not.toHaveBeenCalled();
  });
  it('muestra reacciones de su sala sobre video y las retira sin publicar en el chat',()=>{
    vi.useFakeTimers();snapshot.state.reaction_events=[{id:'reaction',user_id:'peer',author:'Compañero',emoji:'🎉',room_id:null,created_at:snapshot.server_time},{id:'other',user_id:'peer2',author:'Otro equipo',emoji:'❤️',room_id:'room',created_at:snapshot.server_time}];
    open();const stage=screen.getByRole('region',{name:'Escenario de la clase'});expect(within(stage).getByText('🎉')).toBeInTheDocument();expect(within(stage).queryByText('Otro equipo')).not.toBeInTheDocument();expect(screen.getByRole('log',{name:'Mensajes de la sesión'})).not.toHaveTextContent('🎉');
    act(()=>vi.advanceTimersByTime(5000));expect(within(stage).queryByText('🎉')).not.toBeInTheDocument();expect(send).not.toHaveBeenCalled();
  });
  it('retira el ingreso del encabezado y conserva conexión explícita sobre la transmisión',()=>{
    open();expect(screen.queryByRole('button',{name:'Unirme a la sesión'})).not.toBeInTheDocument();
    const stage=screen.getByRole('region',{name:'Escenario de la clase'});fireEvent.click(within(stage).getByRole('button',{name:'Conectar transmisión'}));
    expect(connect).toHaveBeenCalledOnce();expect(mute).not.toHaveBeenCalled();expect(camera).not.toHaveBeenCalled();expect(stage.querySelector('.participant-stage-bar')).not.toHaveTextContent('Contenido de la sesión');
  });
  it('contrae y expande sin apagar los dispositivos ni salir de la llamada',()=>{
    media.zoomConnected=true;media.zoomMic=true;media.zoomCamera=true;open();
    fireEvent.click(screen.getByRole('button',{name:'Mover o contraer controles'}));expect(screen.queryByRole('button',{name:'Silenciar micrófono'})).not.toBeInTheDocument();
    const handle=screen.getByRole('button',{name:'Mostrar controles de participación'});expect(handle).toHaveAttribute('aria-expanded','false');fireEvent.click(handle);
    expect(screen.getByRole('button',{name:'Silenciar micrófono'})).toHaveAttribute('aria-pressed','true');expect(mute).not.toHaveBeenCalled();expect(camera).not.toHaveBeenCalled();expect(connect).not.toHaveBeenCalled();
  });
  it('arrastra dentro del área, ignora el clic final y ajusta la posición al reducir tamaño',()=>{
    open();const handle=screen.getByRole('button',{name:'Mover o contraer controles'}),floating=handle.closest('.participant-floating-controls') as HTMLDivElement;
    const area=screen.getByRole('main',{name:'Contenido de la sesión'});let width=800,height=600;
    area.getBoundingClientRect=()=>({left:100,top:50,width,height} as DOMRect);
    floating.getBoundingClientRect=()=>({left:100+(parseFloat(floating.style.left)||200),top:50+(parseFloat(floating.style.top)||500),width:Math.min(430,width),height:44} as DOMRect);
    handle.setPointerCapture=vi.fn();handle.hasPointerCapture=()=>true;handle.releasePointerCapture=vi.fn();
    fireEvent.pointerDown(handle,{pointerId:7,button:0,clientX:300,clientY:550});fireEvent.pointerMove(handle,{pointerId:7,clientX:900,clientY:900});fireEvent.pointerUp(handle,{pointerId:7});fireEvent.click(handle);
    expect(floating).toHaveStyle({left:'370px',top:'556px'});expect(handle).toHaveAttribute('aria-expanded','true');expect(handle.releasePointerCapture).toHaveBeenCalledWith(7);
    fireEvent.keyDown(handle,{key:'ArrowLeft'});expect(floating).toHaveStyle({left:'354px'});
    width=300;height=250;fireEvent(window,new Event('resize'));expect(floating).toHaveStyle({left:'0px',top:'206px'});
    fireEvent.keyDown(handle,{key:'Escape'});expect(handle).toHaveAttribute('aria-expanded','false');
  });
  it('cancela un arrastre sin seguir moviendo la barra',()=>{
    open();const handle=screen.getByRole('button',{name:'Mover o contraer controles'}),floating=handle.closest('.participant-floating-controls') as HTMLDivElement;
    floating.getBoundingClientRect=()=>({left:100,top:100,width:300,height:44} as DOMRect);floating.parentElement!.getBoundingClientRect=()=>({left:0,top:0,width:800,height:600} as DOMRect);
    fireEvent.pointerDown(handle,{pointerId:4,button:0,clientX:100,clientY:100});fireEvent.pointerCancel(handle,{pointerId:4});fireEvent.pointerMove(handle,{pointerId:4,clientX:400,clientY:400});expect(floating.style.left).toBe('');
    fireEvent.click(handle);expect(handle).toHaveAttribute('aria-expanded','false');
  });
  it('configura dispositivos del SDK durante la llamada sin cambiar capturas locales',()=>{
    media.zoomConnected=true;media.zoomStage=<div>Video conectado</div>;media.callDevices={microphones:[{id:'usb',label:'Mic USB'}],speakers:[],cameras:[],input:'default',output:'default',camera:'default'};media.selectCallDevice=vi.fn();media.refreshCallDevices=vi.fn();media.selectInput=vi.fn();
    open();fireEvent.click(screen.getByRole('button',{name:'Configurar audio'}));const dialog=screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('combobox',{name:'Micrófono · entrada'}));fireEvent.click(screen.getByRole('option',{name:'Mic USB'}));
    expect(media.selectCallDevice).toHaveBeenCalledWith({kind:'microphone',id:'usb'});expect(media.selectInput).not.toHaveBeenCalled();expect(media.refreshCallDevices).toHaveBeenCalledOnce();
  });
  it('muestra un solo acceso a salas y no activa medios al entrar',()=>{
    open();expect(screen.getAllByRole('button',{name:'Salas'})).toHaveLength(1);
    expect(screen.queryByRole('region',{name:'Estadísticas de participación'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Moderar chat'})).not.toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();expect(mute).not.toHaveBeenCalled();expect(camera).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Activar micrófono'}));expect(mute).not.toHaveBeenCalled();expect(screen.getByRole('status')).toHaveTextContent('Conecta la transmisión');
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
    snapshot.state.moderation.locked=true;open();expect(screen.getByRole('button',{name:'Levantar la mano'})).toBeDisabled();expect(screen.getByRole('button',{name:'Reacciones'})).toBeEnabled();
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
