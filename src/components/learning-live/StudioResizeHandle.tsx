import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import './studio-resize.css';

export function StudioResizeHandle({axis,side,label,value,min,max,onChange,onReset,className=''}:{
  axis:'width'|'height';side:'before'|'after';label:string;value:number;min:number;max:number;
  onChange:(size:number)=>void;onReset:()=>void;className?:string;
}) {
  const drag=useRef<{id:number;start:number;size:number}|null>(null);
  const [resizing,setResizing]=useState(false);
  const limit=(size:number)=>Math.round(Math.max(min,Math.min(Math.max(min,max),size)));
  const direction=side==='before'?1:-1;
  function down(event:PointerEvent<HTMLDivElement>){
    if(event.button!==0||drag.current)return;
    const panel=side==='before'?event.currentTarget.previousElementSibling:event.currentTarget.nextElementSibling;
    const box=panel?.getBoundingClientRect();
    event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current={id:event.pointerId,start:axis==='width'?event.clientX:event.clientY,size:(axis==='width'?box?.width:box?.height)||value};setResizing(true);
  }
  function move(event:PointerEvent<HTMLDivElement>){const current=drag.current;if(!current||event.pointerId!==current.id)return;onChange(limit(current.size+direction*((axis==='width'?event.clientX:event.clientY)-current.start)));}
  function finish(event:PointerEvent<HTMLDivElement>){if(drag.current?.id!==event.pointerId)return;drag.current=null;setResizing(false);if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
  function key(event:KeyboardEvent<HTMLDivElement>){
    if(event.key==='Escape'&&drag.current){event.preventDefault();const current=drag.current;drag.current=null;setResizing(false);onChange(limit(current.size));if(event.currentTarget.hasPointerCapture?.(current.id))event.currentTarget.releasePointerCapture(current.id);return;}
    const negative=axis==='width'?'ArrowLeft':'ArrowUp',positive=axis==='width'?'ArrowRight':'ArrowDown';
    if(event.key==='Enter'){event.preventDefault();onReset();return;}
    if(![negative,positive,'Home','End'].includes(event.key))return;event.preventDefault();
    onChange(limit(event.key==='Home'?min:event.key==='End'?max:value+(event.key===negative?-1:1)*direction*(event.shiftKey?64:16)));
  }
  return <div className={`studio-resize-handle is-${axis} ${className}`} role="separator" tabIndex={0} aria-label={label} aria-orientation={axis==='width'?'vertical':'horizontal'} aria-valuemin={min} aria-valuemax={Math.max(min,max)} aria-valuenow={limit(value)} aria-valuetext={`${limit(value)} píxeles`} title="Arrastra para ajustar · Flechas para mover · Doble clic o Enter para restaurar" data-resizing={resizing||undefined} onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={()=>{drag.current=null;setResizing(false);}} onKeyDown={key} onDoubleClick={onReset}><span aria-hidden="true"/></div>;
}
