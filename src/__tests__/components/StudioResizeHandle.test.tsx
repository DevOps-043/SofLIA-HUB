import { fireEvent,render,screen } from '@testing-library/react';
import { beforeAll,describe,expect,it,vi } from 'vitest';
import { useState } from 'react';
import { StudioResizeHandle } from '../../components/learning-live/StudioResizeHandle';

beforeAll(()=>{if(!window.PointerEvent)window.PointerEvent=class extends MouseEvent {readonly pointerId:number;constructor(type:string,init:PointerEventInit={}){super(type,init);this.pointerId=init.pointerId??1;}} as typeof PointerEvent;});
function Panel({axis='width',side='after',onReset=vi.fn()}:{axis?:'width'|'height';side?:'before'|'after';onReset?:()=>void}) {
  const [size,setSize]=useState(300);
  const reset=()=>{setSize(300);onReset();};
  return <main><div data-testid="before"/><StudioResizeHandle axis={axis} side={side} label="Ajustar panel" value={size} min={100} max={600} onChange={setSize} onReset={reset}/><div data-testid="after"/></main>;
}
function mockCapture(handle:HTMLElement){Object.assign(handle,{setPointerCapture:vi.fn(),releasePointerCapture:vi.fn(),hasPointerCapture:()=>true});}
describe('separador de paneles del aula',()=>{
  it('arrastra desde el tamaño real del panel derecho y respeta ambos extremos',()=>{
    render(<Panel/>);const handle=screen.getByRole('separator');mockCapture(handle);
    screen.getByTestId('after').getBoundingClientRect=()=>({width:340,height:200} as DOMRect);
    fireEvent.pointerDown(handle,{pointerId:8,button:0,clientX:500});fireEvent.pointerMove(handle,{pointerId:8,clientX:420});expect(handle).toHaveAttribute('aria-valuenow','420');
    fireEvent.pointerMove(handle,{pointerId:8,clientX:-1000});expect(handle).toHaveAttribute('aria-valuenow','600');fireEvent.pointerMove(handle,{pointerId:8,clientX:2000});expect(handle).toHaveAttribute('aria-valuenow','100');
    fireEvent.pointerUp(handle,{pointerId:8});expect(handle.releasePointerCapture).toHaveBeenCalledWith(8);expect(handle).not.toHaveAttribute('data-resizing');
  });
  it('aumenta panel izquierdo al arrastrar a la derecha y termina al perder captura',()=>{
    render(<Panel side="before"/>);const handle=screen.getByRole('separator');mockCapture(handle);
    fireEvent.pointerDown(handle,{pointerId:3,button:0,clientX:200});fireEvent.pointerMove(handle,{pointerId:99,clientX:300});expect(handle).toHaveAttribute('aria-valuenow','300');
    fireEvent.pointerMove(handle,{pointerId:3,clientX:300});expect(handle).toHaveAttribute('aria-valuenow','400');fireEvent.lostPointerCapture(handle,{pointerId:3});fireEvent.pointerMove(handle,{pointerId:3,clientX:500});expect(handle).toHaveAttribute('aria-valuenow','400');
  });
  it('cambia altura arrastrando arriba y restaura al cancelar con Escape',()=>{
    render(<Panel axis="height"/>);const handle=screen.getByRole('separator');mockCapture(handle);
    expect(handle).toHaveAttribute('aria-orientation','horizontal');fireEvent.pointerDown(handle,{pointerId:2,button:0,clientY:500});fireEvent.pointerMove(handle,{pointerId:2,clientY:450});expect(handle).toHaveAttribute('aria-valuenow','350');
    fireEvent.keyDown(handle,{key:'Escape'});expect(handle).toHaveAttribute('aria-valuenow','300');fireEvent.pointerMove(handle,{pointerId:2,clientY:400});expect(handle).toHaveAttribute('aria-valuenow','300');
  });
  it('admite flechas/Home/End y restauración por teclado o doble clic',()=>{
    const reset=vi.fn();render(<Panel onReset={reset}/>);const handle=screen.getByRole('separator');
    fireEvent.keyDown(handle,{key:'ArrowLeft'});expect(handle).toHaveAttribute('aria-valuenow','316');fireEvent.keyDown(handle,{key:'End'});expect(handle).toHaveAttribute('aria-valuenow','600');fireEvent.keyDown(handle,{key:'Home'});expect(handle).toHaveAttribute('aria-valuenow','100');
    fireEvent.keyDown(handle,{key:'Enter'});expect(handle).toHaveAttribute('aria-valuenow','300');fireEvent.doubleClick(handle);expect(reset).toHaveBeenCalledTimes(2);
  });
  it('ignora botón secundario y no continúa tras cancelar el puntero',()=>{
    render(<Panel/>);const handle=screen.getByRole('separator');mockCapture(handle);
    fireEvent.pointerDown(handle,{pointerId:1,button:2,clientX:200});fireEvent.pointerMove(handle,{pointerId:1,clientX:100});expect(handle).toHaveAttribute('aria-valuenow','300');
    fireEvent.pointerDown(handle,{pointerId:1,button:0,clientX:200});fireEvent.pointerCancel(handle,{pointerId:1});fireEvent.pointerMove(handle,{pointerId:1,clientX:100});expect(handle).toHaveAttribute('aria-valuenow','300');
  });
});
