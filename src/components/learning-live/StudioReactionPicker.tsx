import { useRef, useState } from 'react';
import { studioReactionSchema } from '../../shared/live-studio.contract';
import { useStudioRuntime } from './instructor/StudioRuntimeContext';
import { useStudioTime } from './useStudioTime';

export function StudioReactionPicker({roomId,onComplete}:{roomId:string|null;onComplete:()=>void}) {
  const runtime=useStudioRuntime(),sending=useRef(false);
  const [error,setError]=useState('');
  const snapshot=runtime?.snapshot;
  const last=snapshot?.state.participation?.[snapshot.user_id]?.last_reaction_at;
  const now=useStudioTime(snapshot?.server_time??'',last?Date.parse(last)+1000:undefined);
  const allowed=snapshot?.participation_version===1&&snapshot.state.moderation.reactions&&snapshot.state.moderation.restrictions[snapshot.user_id]!=='blocked';
  async function react(emoji:typeof studioReactionSchema.options[number]) {
    if(!allowed||!runtime||sending.current)return;
    sending.current=true;setError('');
    try{if(await runtime.send({type:'reaction',emoji,room_id:roomId}))onComplete();else setError('No se pudo enviar la reacción. Reintenta en un momento.');}
    catch{setError('No se pudo enviar la reacción. Reintenta en un momento.');}
    finally{sending.current=false;}
  }
  return <div className="studio-reaction-picker" aria-label="Elegir reacción para la transmisión"><div>{studioReactionSchema.options.map(emoji=><button type="button" key={emoji} aria-label={`Enviar reacción ${emoji}`} disabled={!allowed||runtime?.busy||!!last&&now-Date.parse(last)<1000} onClick={()=>void react(emoji)}>{emoji}</button>)}</div>{error&&<small role="alert">{error}</small>}</div>;
}
