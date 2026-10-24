import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioChat } from '../../components/learning-live/instructor/StudioChat';
import { StudioRuntimeContext, type StudioRuntime } from '../../components/learning-live/instructor/StudioRuntimeContext';
import { emptyStudioState } from '../../shared/live-studio-domain';

const send=vi.fn(),refresh=vi.fn(),reconnect=vi.fn();
let runtime:StudioRuntime;
beforeEach(()=>{
  vi.clearAllMocks();send.mockResolvedValue(true);
  runtime={snapshot:{session_id:'session',user_id:'student',can_manage:false,title:'Clase',server_time:new Date().toISOString(),state:emptyStudioState(),asset_urls:{}},busy:false,realtime:'Realtime conectado',error:'',send,refresh,reconnect,upload:vi.fn()};
});
function view(){return <StudioRuntimeContext.Provider value={runtime}><StudioChat compact/></StudioRuntimeContext.Provider>;}
function write(text:string){fireEvent.change(screen.getByRole('textbox'),{target:{value:text}});}
function submit(){fireEvent.submit(screen.getByRole('textbox').closest('form')!);}

describe('chat académico en tiempo real',()=>{
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
    render(view());write('Conserva esto');submit();expect(send).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Añadir reacción'})).toBeDisabled();expect(screen.getByRole('textbox')).toHaveValue('Conserva esto');
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
