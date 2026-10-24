import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

type Position={x:number;y:number};
type Drag={pointer:number;startX:number;startY:number;origin:Position;moved:boolean};
export function useMovableToolbar() {
  const root=useRef<HTMLDivElement>(null);
  const drag=useRef<Drag|null>(null);
  const suppressClick=useRef(false);
  const [position,setPosition]=useState<Position|null>(null);
  const [collapsed,setCollapsed]=useState(false);
  function geometry(){const box=root.current?.getBoundingClientRect(),area=root.current?.parentElement?.getBoundingClientRect();return box&&area&&area.width>0&&area.height>0?{box,area}:null;}
  function limit(next:Position){const bounds=geometry();if(!bounds)return next;return {x:Math.max(0,Math.min(next.x,bounds.area.width-bounds.box.width)),y:Math.max(0,Math.min(next.y,bounds.area.height-bounds.box.height))};}
  useEffect(()=>{
    const element=root.current,area=element?.parentElement;
    function resize(){if(!area||area.getBoundingClientRect().width===0)return;setPosition(previous=>{if(!previous)return previous;const box=element!.getBoundingClientRect(),bounds=area.getBoundingClientRect();const x=Math.max(0,Math.min(previous.x,bounds.width-box.width)),y=Math.max(0,Math.min(previous.y,bounds.height-box.height));return x===previous.x&&y===previous.y?previous:{x,y};});}
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);
    if(element)observer?.observe(element);if(area)observer?.observe(area);window.addEventListener('resize',resize);
    return()=>{observer?.disconnect();window.removeEventListener('resize',resize);};
  },[]);
  function down(event:PointerEvent<HTMLButtonElement>){
    if(event.button!==0||drag.current)return;
    const bounds=geometry();if(!bounds)return;
    suppressClick.current=false;
    drag.current={pointer:event.pointerId,startX:event.clientX,startY:event.clientY,origin:{x:bounds.box.left-bounds.area.left,y:bounds.box.top-bounds.area.top},moved:false};
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function move(event:PointerEvent<HTMLButtonElement>){
    const current=drag.current;if(!current||current.pointer!==event.pointerId)return;
    const dx=event.clientX-current.startX,dy=event.clientY-current.startY;
    if(!current.moved&&Math.hypot(dx,dy)<5)return;
    current.moved=true;suppressClick.current=true;
    setPosition(limit({x:current.origin.x+dx,y:current.origin.y+dy}));
  }
  function up(event:PointerEvent<HTMLButtonElement>){if(drag.current?.pointer!==event.pointerId)return;drag.current=null;if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
  function cancel(){drag.current=null;suppressClick.current=false;}
  function click(){if(suppressClick.current){suppressClick.current=false;return;}setCollapsed(value=>!value);}
  function key(event:KeyboardEvent<HTMLButtonElement>){
    if(event.key==='Enter'||event.key===' '){suppressClick.current=false;return;}
    if(event.key==='Escape'){setCollapsed(true);return;}
    const direction:Record<string,Position>={ArrowLeft:{x:-16,y:0},ArrowRight:{x:16,y:0},ArrowUp:{x:0,y:-16},ArrowDown:{x:0,y:16}};
    const delta=direction[event.key],bounds=geometry();if(!delta||!bounds)return;event.preventDefault();
    setPosition(limit({x:bounds.box.left-bounds.area.left+delta.x,y:bounds.box.top-bounds.area.top+delta.y}));
  }
  return {root,collapsed,style:position?{left:position.x,top:position.y,bottom:'auto',transform:'none'}:undefined,handle:{onPointerDown:down,onPointerMove:move,onPointerUp:up,onPointerCancel:cancel,onLostPointerCapture:()=>{drag.current=null;},onClick:click,onKeyDown:key}};
}
