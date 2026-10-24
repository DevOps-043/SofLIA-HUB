import { useEffect,useState,type RefObject } from 'react';

/** Mide solo el espacio del panel, sin leer ni almacenar datos de la sesión. */
export function useStudioDimensions(ref:RefObject<HTMLElement|null>) {
  const [size,setSize]=useState({width:0,height:0});
  useEffect(()=>{
    const element=ref.current;
    if(!element)return;
    function measure(){
      const box=element!.getBoundingClientRect();if(!box.width||!box.height)return;
      const style=getComputedStyle(element!);
      const width=Math.max(0,Math.floor(box.width-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0)));
      const height=Math.max(0,Math.floor(box.height-(parseFloat(style.paddingTop)||0)-(parseFloat(style.paddingBottom)||0)));
      setSize(previous=>previous.width===width&&previous.height===height?previous:{width,height});
    }
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);
    observer?.observe(element);const frame=window.requestAnimationFrame(measure);
    window.addEventListener('resize',measure);
    return()=>{observer?.disconnect();window.cancelAnimationFrame(frame);window.removeEventListener('resize',measure);};
  },[ref]);
  return size;
}
