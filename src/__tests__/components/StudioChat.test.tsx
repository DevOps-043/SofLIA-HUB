import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioChat } from '../../components/learning-live/instructor/StudioChat';
import { StudioRuntimeContext, type StudioRuntime } from '../../components/learning-live/instructor/StudioRuntimeContext';
import { emptyStudioState } from '../../shared/live-studio-domain';

const send=vi.fn(),refresh=vi.fn(),reconnect=vi.fn();
let runtime:StudioRuntime;
beforeEach(()=>{
  vi.clearAllMocks();send.mockResolvedValue(true);
  runtime={snapshot:{participation_version:1,session_id:'session',user_id:'student',can_manage:false,title:'Clase',server_time:new Date().toISOString(),state:emptyStudioState(),asset_urls:{}},busy:false,realtime:'Realtime conectado',error:'',send,refresh,reconnect,upload:vi.fn()};
});
afterEach(()=>vi.useRealTimers());
function view(compact=true){return <StudioRuntimeContext.Provider value={runtime}><StudioChat compact={compact}/></StudioRuntimeContext.Provider>;}
function write(text:string){fireEvent.change(screen.getByRole('textbox'),{target:{value:text}});}
function submit(){fireEvent.submit(screen.getByRole('textbox').closest('form')!);}

describe('chat académico en tiempo real',()=>{
  it('mantiene chat disponible y oculta ajustes nuevos si Learning no confirma participación',()=>{
    delete runtime.snapshot.participation_version;runtime.snapshot.can_manage=true;render(view(false));
    fireEvent.click(screen.getByRole('button',{name:'Moderar chat'}));
    expect(screen.queryByRole('spinbutton',{name:'Intervalo de chat en segundos'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Añadir reacción'})).not.toBeInTheDocument();expect(screen.getByRole('textbox',{name:'Tu mensaje como instructor'})).toBeEnabled();
  });
  it('muestra cuenta regresiva basada en servidor, conserva borrador y bloquea submit anticipado',async()=>{
    vi.useFakeTimers();runtime.snapshot.state.moderation.message_interval_seconds=3;runtime.snapshot.state.participation.student={last_message_at:runtime.snapshot.server_time};
    render(view());write('Borrador conservado');submit();expect(send).not.toHaveBeenCalled();expect(screen.getByRole('timer')).toHaveTextContent('3 s');
    act(()=>vi.advanceTimersByTime(3000));expect(screen.queryByRole('timer')).not.toBeInTheDocument();expect(screen.getByRole('textbox')).toHaveValue('Borrador conservado');
    await act(async()=>submit());expect(send).toHaveBeenCalledWith(expect.objectContaining({type:'post',content:'Borrador conservado'}));
  });
  it('el instructor configura segundos y puede escribir sin esperar',async()=>{
    runtime.snapshot.can_manage=true;runtime.snapshot.state.moderation.message_interval_seconds=30;runtime.snapshot.state.participation.student={last_message_at:runtime.snapshot.server_time};
    render(view(false));fireEvent.click(screen.getByRole('button',{name:'Moderar chat'}));fireEvent.change(screen.getByRole('spinbutton',{name:'Intervalo de chat en segundos'}),{target:{value:'15'}});fireEvent.click(screen.getByRole('button',{name:'Aplicar'}));
    await waitFor(()=>expect(send).toHaveBeenCalledWith({type:'chat_interval',seconds:15}));expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
  it('el emoji del compositor reacciona en video sin insertarlo en el mensaje',async()=>{
    render(view());write('Texto sin emoji');fireEvent.click(screen.getByRole('button',{name:'Añadir reacción'}));fireEvent.click(screen.getByRole('button',{name:'Enviar reacción 👏'}));
    await waitFor(()=>expect(send).toHaveBeenCalledWith({type:'reaction',emoji:'👏',room_id:null}));expect(screen.getByRole('textbox')).toHaveValue('Texto sin emoji');
  });
  it('conserva cambios escritos durante un envío y serializa Enter repetido',async()=>{
    let complete!:(value:boolean)=>void;send.mockReturnValue(new Promise<boolean>(resolve=>{complete=resolve;}));
    render(view());write('Primero');submit();submit();write('Siguiente mensaje');
    expect(send).toHaveBeenCalledOnce();await act(async()=>complete(true));expect(screen.getByRole('textbox')).toHaveValue('Siguiente mensaje');
  });
  it.each([false,'throw'])('retiene borrador y muestra reintento ante fallo: %s',async(result)=>{
    if(result===false)send.mockResolvedValue(false);else send.mockRejectedValue(new Error('offline'));
    render(view());write('Mi pregunta');submit();await screen.findByText(/No se envió el mensaje/);expect(screen.getByRole('textbox')).toHaveValue('Mi pregunta');
    send.mockResolvedValue(true);submit();await waitFor(()=>expect(screen.getByRole('textbox')).toHaveValue(''));
  });
  it('no permite eludir moderación mediante submit programático ni comandos de alumno',()=>{
    render(view());write('/silenciar');submit();expect(send).not.toHaveBeenCalled();expect(screen.getByText(/reservados al instructor/)).toBeInTheDocument();
  });
  it.each(['locked','chat','blocked'])('rechaza envío y reacciones con restricción %s',restriction=>{
    if(restriction==='locked')runtime.snapshot.state.moderation.locked=true;else runtime.snapshot.state.moderation.restrictions.student=restriction as 'chat'|'blocked';
    render(view());write('Conserva esto');submit();expect(send).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Añadir reacción'})).toHaveProperty('disabled',restriction==='blocked');expect(screen.getByRole('textbox')).toHaveValue('Conserva esto');
  });
  it('no envía durante composición de texto ni al introducir un salto de línea',()=>{
    render(view());write('Hola');fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter',isComposing:true});fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter',shiftKey:true});expect(send).not.toHaveBeenCalled();
  });
  it('muestra desconexión y vuelve a suscribir al pulsar reconectar',()=>{
    runtime.realtime='Realtime desconectado';render(view());expect(screen.getByText('Sin conexión en vivo')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Reconectar chat'}));expect(reconnect).toHaveBeenCalledOnce();
  });
  it('no cambia la lectura al escribir ni recibir mensajes si se desplazó hacia arriba',()=>{
    const panel=render(view());const list=screen.getByRole('log');Object.defineProperties(list,{scrollHeight:{value:1000},clientHeight:{value:200}});list.scrollTop=100;fireEvent.scroll(list);write('Borrador');expect(list.scrollTop).toBe(100);
    runtime.snapshot.state.messages.push({id:'m',user_id:'teacher',author:'Docente',instructor:true,content:'Nuevo',question:false,room_id:null,created_at:new Date().toISOString()});
    // La nueva invalidación de contexto preserva la posición de lectura.
    runtime={...runtime};panel.rerender(view());expect(list.scrollTop).toBe(100);
  });
});
