import { useState } from 'react';
import { useStudioRuntime } from './instructor/StudioRuntimeContext';
import { useStudioTime } from './useStudioTime';
import './studio-reactions.css';

function Reaction({emoji,author,elapsed,index}:{emoji:string;author:string;elapsed:number;index:number}) {
  const [delay]=useState(()=>-Math.min(4.999,Math.max(0,elapsed/1000)));
  return <span className="studio-reaction-float" style={{left:`${12+index%6*14}%`,animationDelay:`${delay}s`}}><b>{emoji}</b><small>{author}</small></span>;
}
export function StudioReactions({roomId}:{roomId?:string|null}) {
  const runtime=useStudioRuntime();
  const state=runtime?.snapshot.state,serverTime=runtime?.snapshot.server_time??'';
  const events=state?.reaction_events??[];
  const now=useStudioTime(serverTime,events.length?Math.max(...events.map(event=>Date.parse(event.created_at)+5000)):undefined);
  const room=roomId===undefined?state?.members.find(member=>member.user_id===runtime?.snapshot.user_id)?.room_id??null:roomId;
  const visible=events.filter(event=>event.room_id===room&&now-Date.parse(event.created_at)>=0&&now-Date.parse(event.created_at)<5000);
  return <div className="studio-reaction-overlay" role="group" aria-label="Reacciones de la transmisión" aria-live="off">{visible.slice(-24).map((event,index)=><Reaction key={event.id} emoji={event.emoji} author={event.author} elapsed={now-Date.parse(event.created_at)} index={index}/>)}</div>;
}
