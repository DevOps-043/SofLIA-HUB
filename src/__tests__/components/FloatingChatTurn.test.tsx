import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatUI } from '../../adapters/desktop_ui/ChatUI';
import type { ChatMessage } from '../../services/chat-service';
import type { FloatingContextReader } from '../../services/floating-chat-context';

const mocks=vi.hoisted(()=>({send:vi.fn(),record:vi.fn()}));
vi.mock('../../services/gemini-chat',()=>({sendMessageStream:mocks.send,getPublicAiErrorMessage:()=> 'No se pudo responder.',optimizePrompt:vi.fn()}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({user:{id:'sofia'},dataUserId:'lia',sofiaContext:{currentOrganization:{id:'org'}}})}));
vi.mock('../../contexts/presentation-workspace-context',()=>({usePresentationWorkspaceContext:()=>({workspaceId:null,skillId:null})}));
vi.mock('../../services/memory-bridge',()=>({syncCurrentOwner:vi.fn(),fetchChatMemoryContext:vi.fn(async()=>''),recordChatTurn:mocks.record}));
vi.mock('../../services/iris-data',()=>({needsIrisData:()=>false,buildIrisContext:vi.fn()}));
vi.mock('../../services/image-generation',()=>({generateImage:vi.fn()}));
vi.mock('../../adapters/desktop_ui/chat-ui/useChatTools',()=>({useChatTools:()=>({})}));
vi.mock('../../adapters/desktop_ui/chat-ui/useSkillWorkspaceResume',()=>({useSkillWorkspaceResume:()=>{}}));
vi.mock('../../adapters/desktop_ui/chat-ui/useSkillWorkspaceLink',()=>({useSkillWorkspaceLink:()=>{}}));
vi.mock('../../adapters/desktop_ui/chat-ui/useDictation',()=>({useDictation:()=>({isRecording:false,isTranscribing:false})}));
vi.mock('../../adapters/desktop_ui/chat-ui/useChatFileHandlers',()=>({useChatFileHandlers:()=>({handlePaste:vi.fn(),handleImageUpload:vi.fn()})}));
vi.mock('../../adapters/desktop_ui/chat-ui/input/ToolMenu',()=>({ToolMenu:()=>null}));

function Chat({read}:{read?:FloatingContextReader}) {
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  return <ChatUI floating compact messages={messages} onMessagesChange={setMessages} readVisibleContext={read} />;
}
beforeEach(()=>{
  localStorage.clear();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  mocks.send.mockReset();mocks.record.mockReset();
  mocks.send.mockResolvedValue({stream:(async function*(){yield 'Veo las tareas de tu proyecto.';})(),sources:Promise.resolve(null)});
});
describe('Turno real del compositor flotante con proveedor simulado',()=>{
  it('lee al enviar y muestra la respuesta en el mismo compositor sin avatar de Soflia',async()=>{
    const read=vi.fn(async()=>({text:'VISTA_NO_CONFIABLE: tareas visibles',images:[]}));
    render(<Chat read={read}/>);
    expect(read).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'¿Qué estoy viendo?'}});
    fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter'});
    expect(await screen.findByText('Veo las tareas de tu proyecto.')).toBeVisible();
    expect(read).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledWith(expect.stringContaining('tareas visibles'),expect.any(Array),expect.objectContaining({signal:expect.any(AbortSignal)}));
    expect(screen.queryByText('VISTA_NO_CONFIABLE: tareas visibles')).toBeNull();
    expect(document.querySelector('img[src*="lia-avatar"]')).toBeNull();
    expect(screen.getByAltText('Soflia')).toHaveAttribute('src','./assets/Icono.png');
  });
  it('no muestra controles de contexto y permite conversar cuando no hay lector contextual',async()=>{
    render(<Chat />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('Sólo al enviar')).toBeNull();
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Hola'}});
    fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter'});
    await screen.findByText('Veo las tareas de tu proyecto.');
    expect(mocks.send.mock.calls[0][0]).toBe('Hola');
  });
  it('un fallo de lectura conserva el borrador y no consulta al modelo fingiendo contexto',async()=>{
    const read=vi.fn(async()=>{throw new Error('No se pudo leer la vista.');});
    render(<Chat read={read}/>);
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Revisa esta página'}});
    fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter'});
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo leer la vista.');
    expect(screen.getByRole('textbox')).toHaveValue('Revisa esta página');expect(mocks.send).not.toHaveBeenCalled();
  });
  it('Detener cancela la preparación antes de llamar al modelo y no pierde el texto',async()=>{
    const read=vi.fn((signal:AbortSignal)=>new Promise<never>((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('Cancelado')),{once:true})));
    render(<Chat read={read}/>);
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Ayúdame con esto'}});
    fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter'});
    await waitFor(()=>expect(read).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button',{name:'Detener'}));
    await waitFor(()=>expect(screen.getByRole('textbox')).toBeEnabled());
    expect(screen.getByRole('textbox')).toHaveValue('Ayúdame con esto');expect(mocks.send).not.toHaveBeenCalled();
  });
  it('cambiar conversación descarta el stream tardío y no escribe su cierre en el nuevo chat',async()=>{
    let finish!:()=>void;
    const wait=new Promise<void>(resolve=>{finish=resolve;});
    mocks.send.mockResolvedValue({stream:(async function*(){await wait;yield 'Respuesta del chat anterior';})(),sources:Promise.resolve(null)});
    const change=vi.fn(),read=vi.fn(async()=>({text:'Vista',images:[]}));
    const view=render(<ChatUI floating compact conversationId="a" messages={[]} onMessagesChange={change} readVisibleContext={read}/>);
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Revisa esto'}});
    fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter'});
    await waitFor(()=>expect(mocks.send).toHaveBeenCalled());
    expect(document.querySelector('img[src*="lia-avatar"]')).toBeNull();
    view.rerender(<ChatUI floating compact conversationId="b" messages={[]} onMessagesChange={change} readVisibleContext={read}/>);
    change.mockClear();
    await act(async()=>{finish();await wait;});
    expect(change).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it('al reabrir una vista no queda bloqueado por un marcador heredado sin generación activa',()=>{
    const change=vi.fn();
    render(<ChatUI floating compact messages={[{id:'pregunta',role:'user',text:'Pregunta anterior',timestamp:1},{id:'interrumpido',role:'model',text:'...',timestamp:2}]} onMessagesChange={change}/>);
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.queryByRole('button',{name:'Detener'})).toBeNull();
    expect(screen.queryByText('...')).toBeNull();
    expect(change).not.toHaveBeenCalled();
  });
});
