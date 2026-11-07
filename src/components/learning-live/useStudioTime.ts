import { useEffect, useState } from 'react';

/** Reloj derivado del snapshot del servidor, independiente de la hora del equipo. */
export function useStudioTime(serverTime:string, until:number|undefined) {
  const [now,setNow]=useState(()=>Date.parse(serverTime)||0);
  useEffect(()=>{
    if(!until||until<=Date.parse(serverTime))return;
    const server=Date.parse(serverTime)||0,local=performance.now();
    const timer=window.setInterval(()=>{const next=server+performance.now()-local;setNow(next);if(next>=until)window.clearInterval(timer);},250);
    return()=>window.clearInterval(timer);
  },[serverTime,until]);
  return Math.max(now,Date.parse(serverTime)||0);
}
