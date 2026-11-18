import type ZoomVideo from '@zoom/videosdk';
import { studioRoomPlanSchema,type StudioRoomPlan,type StudioRoomsStatus } from '../../src/shared/studio-call';

type Client=Pick<ReturnType<typeof ZoomVideo.createClient>,'getSubsessionClient'|'getCurrentUserInfo'|'getAllUser'>;
const roomName=(id:string)=>`soflia-room-${id}`;
async function checked(result:unknown){const value=await result;if(value instanceof Error||value&&typeof value==='object'&&'type' in value)throw new Error('La llamada rechazó el cambio de salas.');}

/** Correlación por user_key firmado; nunca por displayName ni un ID del renderer. */
export function academicRooms(client:Client){
  let plan:StudioRoomPlan=[];
  return {
    setPlan(input:unknown){plan=studioRoomPlanSchema.parse(input,{jitless:true});},
    async sync():Promise<StudioRoomsStatus>{
      const api=client.getSubsessionClient();
      if(!client.getCurrentUserInfo()?.isHost||!api.isSubsessionEnabled())return {status:'unavailable',missing:plan.flatMap(room=>room.user_ids).length};
      let existing:Array<{subsessionId:string;subsessionName:string;userList:Array<{userId:number;userKey?:string;isInSubsession?:boolean}>}>=api.getSubsessionList();
      if(existing.some(room=>!room.subsessionName.startsWith('soflia-room-')))throw new Error('La llamada contiene salas administradas fuera del aula.');
      const names=plan.map(room=>roomName(room.id));
      const same=existing.length===names.length&&existing.every(room=>names.includes(room.subsessionName));
      const status=api.getSubsessionStatus();
      if(status===3)return {status:'waiting',missing:0};
      if(!same&&status===2){
        await checked(api.closeAllSubsessions());
        return {status:'waiting',missing:0};
      }
      if(!plan.length)return {status:'ready',missing:0};
      if(!same){
        const created=await api.createSubsessions(names,2);
        if(!Array.isArray(created))throw new Error('No se pudieron crear las salas audiovisuales.');
        existing=created;
      }
      // Las listas de salas y no asignados usan IDs de la sesión principal.
      const roster=[...api.getUnassignedUserList(),...api.getSubsessionList().flatMap(room=>room.userList)];
      if(!api.getCurrentSubsession()?.subsessionId)roster.push(...client.getAllUser());
      const targets=new Map(plan.flatMap(room=>room.user_ids.map(id=>[id,roomName(room.id)] as const)));
      const removed=existing.flatMap(room=>room.userList).filter(user=>user.userKey&&!targets.has(user.userKey));
      if(status===2){
        for(const user of removed)if(user.isInSubsession)await checked(api.moveBackToMainSession(user.userId));
      }else if(removed.length){
        const reset=await api.createSubsessions(names,2);
        if(!Array.isArray(reset))throw new Error('No se pudieron actualizar los permisos de las salas.');
        existing=reset;
      }
      let missing=0;
      const opening=api.getSubsessionList().map(room=>({...room,userList:room.userList.filter(()=>false)}));
      for(const [academicId,name] of targets){
        const users=roster.filter(user=>'userKey' in user&&user.userKey===academicId);
        const unique=[...new Map(users.map(user=>[user.userId,user])).values()];
        if(!unique.length){missing++;continue;}
        const destination=existing.find(room=>room.subsessionName===name);
        if(!destination)throw new Error('Falta una sala audiovisual autorizada.');
        for(const user of unique){
          if(status!==2){
            const prepared=opening.find(room=>room.subsessionId===destination.subsessionId);
            if(!prepared)throw new Error('La sala audiovisual todavía no aparece en la preparación. Reintenta.');
            prepared.userList.push({...user,isInSubsession:false});
            continue;
          }
          const old=existing.find(room=>room.userList.some(item=>item.userId===user.userId));
          if(old?.subsessionId===destination.subsessionId)continue;
          if(old){
            const wasInside=old.userList.some(item=>item.userId===user.userId&&item.isInSubsession);
            await checked(api.moveUserToSubsession(user.userId,destination.subsessionId));
            // Conserva la nueva asignación y devuelve al principal a quien estaba dentro.
            if(status===2&&wasInside)await checked(api.moveBackToMainSession(user.userId));
          }else await checked(api.assignUserToSubsession(user.userId,destination.subsessionId));
        }
      }
      if(status!==2)await checked(api.openSubsessions(opening,{isAutoJoinSubsession:false,isAutoMoveBackToMainSession:true,isBackToMainSessionEnabled:true,isSubsessionSelectionEnabled:false,waitSeconds:0}));
      if(status===2&&removed.length)return {status:'unavailable',missing:removed.length,reason:'assignment_revocation'};
      return {status:missing?'waiting':'ready',missing};
    },
    async visit(id:string|null){
      const api=client.getSubsessionClient();
      if(!id){await checked(api.leaveSubsession());return;}
      const room=api.getSubsessionList().find(item=>item.subsessionName===roomName(id));
      if(!room)throw new Error('Tu sala audiovisual todavía no está preparada.');
      await checked(api.joinSubsession(room.subsessionId));
    },
  };
}
