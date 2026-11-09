import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { FloatingSofliaChat } from '../../components/floating-chat/FloatingSofliaChat';

function Conversation() {
  const [draft,setDraft]=useState('');
  return <><textarea aria-label="Mensaje a Soflia" value={draft} onChange={e=>setDraft(e.target.value)} /><p>Respuesta en el mismo panel</p></>;
}
beforeEach(()=>{
  localStorage.clear();
  vi.stubGlobal('ResizeObserver',class { observe(){} disconnect(){} });
});
describe('Chat flotante de Soflia',()=>{
  it('presenta sólo iconos y no enfoca el campo al abrir con ratón',async()=>{
    render(<FloatingSofliaChat title="Soflia Hub" onNewChat={vi.fn(async()=>{})}><Conversation /></FloatingSofliaChat>);
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}),{detail:1});
    const input=await screen.findByRole('textbox');
    expect(input).not.toHaveFocus();expect(screen.queryByText('Soflia Hub')).toBeNull();expect(screen.queryByText('Nuevo chat')).toBeNull();
    expect(screen.getByRole('button',{name:'Nuevo chat'})).toBeVisible();expect(screen.getByRole('button',{name:'Modelo del chat flotante'})).toBeVisible();
  });
  it('mueve con teclado, conserva la posición al minimizar y respeta los límites',async()=>{
    const original=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'offsetParent');
    Object.defineProperty(HTMLElement.prototype,'offsetParent',{configurable:true,get(){return document.body;}});
    const measure=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
      if(this===document.body)return {left:0,top:0,width:1000,height:800,right:1000,bottom:800,x:0,y:0,toJSON:()=>({})};
      const left=parseFloat(this.style.left)||600,top=parseFloat(this.style.top)||700;
      return {left,top,width:380,height:70,right:left+380,bottom:top+70,x:left,y:top,toJSON:()=>({})};
    });
    try {
      render(<FloatingSofliaChat><Conversation /></FloatingSofliaChat>);fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));await screen.findByRole('textbox');
      const grip=screen.getByRole('button',{name:'Mover chat flotante'});fireEvent.keyDown(grip,{key:'ArrowUp',shiftKey:true});
      const dock=document.querySelector('.soflia-floating-dock');expect(dock).toHaveStyle({left:'600px',top:'668px'});
      fireEvent.click(screen.getByRole('button',{name:'Minimizar chat flotante'}));fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));await screen.findByRole('textbox');expect(dock).toHaveStyle({left:'600px',top:'668px'});
      fireEvent.keyDown(grip,{key:'ArrowRight',shiftKey:true});expect(dock).toHaveStyle({left:'612px'});
    } finally {measure.mockRestore();if(original)Object.defineProperty(HTMLElement.prototype,'offsetParent',original);else delete (HTMLElement.prototype as unknown as {offsetParent?:Element}).offsetParent;}
  });
  it('permite crear un chat desde la cabecera y evita solicitudes duplicadas durante la espera',async()=>{
    let finish!:()=>void;
    const create=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
    render(<FloatingSofliaChat onNewChat={create}><Conversation /></FloatingSofliaChat>);
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));
    await screen.findByRole('textbox');
    const button=screen.getByRole('button',{name:'Nuevo chat'});
    fireEvent.click(button);fireEvent.click(button);
    expect(create).toHaveBeenCalledOnce();expect(button).toBeDisabled();
    await act(async()=>finish());
    expect(button).toBeEnabled();
  });
  it('el menú compacto de modelos se cierra al elegir sin retirar el compositor',async()=>{
    render(<FloatingSofliaChat><Conversation /></FloatingSofliaChat>);
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));
    const input=await screen.findByRole('textbox');
    fireEvent.click(screen.getByRole('button',{name:'Modelo del chat flotante'}));
    expect(screen.getByRole('menu',{name:'Modelos de Soflia'})).toBeVisible();
    expect(screen.getByRole('combobox',{name:'Nivel de razonamiento'})).toBeVisible();
    fireEvent.click(screen.getAllByRole('menuitemradio')[1]);
    expect(screen.queryByRole('menu')).toBeNull();expect(input).toBeVisible();
  });
  it('abre con el icono oficial dentro de la aplicación y conserva borrador al minimizar',async()=>{
    const prepare=vi.fn(async()=>{});
    render(<FloatingSofliaChat title="Proyecto actual" onPrepare={prepare}><Conversation /></FloatingSofliaChat>);
    expect(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}).querySelector('img')).toHaveAttribute('src','./assets/Icono.png');
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));
    const input=await screen.findByRole('textbox');
    fireEvent.change(input,{target:{value:'Mira lo que estoy viendo'}});
    fireEvent.click(screen.getByRole('button',{name:'Minimizar chat flotante'}));
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));
    expect(await screen.findByRole('textbox')).toHaveValue('Mira lo que estoy viendo');
    expect(screen.getByText('Respuesta en el mismo panel')).toBeVisible();
    expect(document.querySelector('img[src*="avatar"]')).toBeNull();
  });
  it('no monta chat editable si preparar el destino falla y permite reintentar',async()=>{
    const prepare=vi.fn().mockRejectedValueOnce(new Error('Interno')).mockResolvedValue(undefined);
    render(<FloatingSofliaChat onPrepare={prepare}><Conversation /></FloatingSofliaChat>);
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));
    expect(await screen.findByRole('alert')).not.toHaveTextContent('Interno');
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    expect(await screen.findByRole('textbox')).toBeVisible();
  });
  it('una preparación tardía de otro ámbito no monta su chat en el nuevo',async()=>{
    let finish!:()=>void;
    const view=render(<FloatingSofliaChat key="a" onPrepare={()=>new Promise<void>(resolve=>{finish=resolve;})}><Conversation /></FloatingSofliaChat>);
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));
    view.rerender(<FloatingSofliaChat key="b"><Conversation /></FloatingSofliaChat>);
    await act(async()=>finish());
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'})).toBeEnabled();
  });
  it('abre una selección contextual y permite volver al icono con Escape',async()=>{
    const view=render(<FloatingSofliaChat openRequest={0}><Conversation /></FloatingSofliaChat>);
    view.rerender(<FloatingSofliaChat openRequest={1}><Conversation /></FloatingSofliaChat>);
    const input=await screen.findByRole('textbox');
    fireEvent.keyDown(input,{key:'Escape'});
    await waitFor(()=>expect(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'})).toBeVisible());
  });
});
