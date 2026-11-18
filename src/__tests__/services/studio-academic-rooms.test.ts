import {describe,it,expect,vi} from 'vitest';
import {academicRooms} from '../../../packages/zoom-runtime/academic-rooms';
import {peopleInVideoRoom,roomVideoContext,roomVideoPage} from '../../../packages/zoom-runtime/room-video-context';
import {start} from '../../../packages/zoom-runtime/video-runtime';
import {ZoomVideo} from '../../../packages/zoom-runtime/video-client';

vi.mock('../../../packages/zoom-runtime/video-client',()=>({
  ZoomVideo:{createClient:vi.fn(),destroyClient:vi.fn()}, VideoQuality:{Video_360P:1},
}));
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(host=true){
  let rooms:Array<{subsessionId:string;subsessionName:string;userList:Array<{userId:number;userKey:string;isInSubsession:boolean}>}>=[];
  let status=1;
  const api={isSubsessionEnabled:()=>true,getSubsessionList:()=>rooms,getSubsessionStatus:()=>status,getCurrentSubsession:()=>({subsessionId:''}),
    getUnassignedUserList:()=>[{userId:7,userKey:id(2),displayName:'Nombre repetido'}],
    createSubsessions:vi.fn(async(names:string[])=>{rooms=names.map((name,index)=>({subsessionId:String(index),subsessionName:name,userList:[]}));return rooms;}),
    assignUserToSubsession:vi.fn(async()=>''),moveUserToSubsession:vi.fn(async()=>''),moveBackToMainSession:vi.fn(async()=>''),
    openSubsessions:vi.fn(async()=>{status=2;return '';}),closeAllSubsessions:vi.fn(async()=>{status=4;return '';}),joinSubsession:vi.fn(async()=>''),leaveSubsession:vi.fn(async()=>''),
  };
  const client={getSubsessionClient:()=>api,getCurrentUserInfo:()=>({isHost:host}),getAllUser:()=>[{userId:8,userKey:id(3),displayName:'Nombre repetido'}]};
  const controller=academicRooms(client as never);
  return {controller,api,client};
}
describe('salas académicas y audiovisuales',()=>{
  it('actualiza la galería al apagar la cámara y retira el video durante un cambio de sala',async()=>{
    const root=document.createElement('div'), status=document.createElement('div');
    root.id='meeting';status.id='status';document.body.append(status,root);
    vi.stubGlobal('navigator',{mediaDevices:{getDisplayMedia:vi.fn()}});
    const post=vi.spyOn(window,'postMessage').mockImplementation(()=>{});
    const listeners=new Map<string,(detail?:unknown)=>void>();
    const player=document.createElement('video-player');
    const stream={attachVideo:vi.fn().mockResolvedValue(player),detachVideo:vi.fn().mockResolvedValue([]),isStartShareScreenWithVideoElement:()=>true};
    const self={userId:1,displayName:'Lucía',bVideoOn:false,subsessionId:'video-a'};
    const peer={userId:2,displayName:'Rosa',bVideoOn:true,subsessionId:'video-a'};
    const outsider={userId:3,displayName:'Otro grupo',bVideoOn:true,subsessionId:'video-b'};
    let current={subsessionId:'video-a',subsessionName:`soflia-room-${id(1)}`,userStatus:'in room'};
    const client={
      init:vi.fn(),join:vi.fn(),leave:vi.fn(),on:(name:string,listener:(detail?:unknown)=>void)=>listeners.set(name,listener),
      getMediaStream:()=>stream,getAllUser:()=>[self,peer,outsider],getCurrentUserInfo:()=>self,
      getSubsessionClient:()=>({getCurrentSubsession:()=>current,getSubsessionList:()=>[]}),
      getRecordingClient:()=>({getCloudRecordingStatus:()=> 'Recording'}),
    };
    vi.mocked(ZoomVideo.createClient).mockReturnValue(client as never);
    try {
      start(new MessageEvent('message',{origin:location.origin,data:{presentation:'participant',detail:{provider:'zoom-video',sessionName:'Prueba',token:'local',userName:'Lucía',password:'prueba',recording_required:true}}}));
      await vi.waitFor(()=>expect(root.querySelector('[data-user-id="2"] video-player')).toBe(player));
      expect(root.querySelector('[data-user-id="1"] .video-tile-initial')).toHaveTextContent('L');
      expect(root.textContent).not.toContain('Otro grupo');
      expect(stream.attachVideo).toHaveBeenCalledTimes(1);
      peer.bVideoOn=false;listeners.get('peer-video-state-change')?.();
      await vi.waitFor(()=>expect(root.querySelector('[data-user-id="2"] .video-tile-initial')).toHaveTextContent('R'));
      expect(stream.detachVideo).toHaveBeenCalledWith(2);
      listeners.get('connection-change')?.({state:'Reconnecting',reason:'move to breakout room'});
      expect(root.querySelector<HTMLElement>('.video-grid')?.style.visibility).toBe('hidden');
      current={subsessionId:'video-b',subsessionName:`soflia-room-${id(2)}`,userStatus:'in room'};
      listeners.get('connection-change')?.({state:'Connected'});
      await vi.waitFor(()=>expect(root.querySelector('[data-user-id="3"] video-player')).toBe(player));
      expect(root.querySelector('[data-user-id="2"]')).toBeNull();
      expect(post).toHaveBeenCalledWith(expect.objectContaining({type:'visual',detail:expect.objectContaining({roomId:id(2)})}),location.origin);
    } finally {
      listeners.get('connection-change')?.({state:'Closed'});
      await vi.waitFor(()=>expect(client.leave).toHaveBeenCalled());
      root.remove();status.remove();post.mockRestore();vi.unstubAllGlobals();
    }
  });
  it('confirma solo la subsesión activa y descarta invitaciones y salas externas',()=>{
    const subsessionName=`soflia-room-${id(1)}`;
    expect(roomVideoContext({subsessionName,userStatus:'in room'})).toBe(id(1));
    expect(roomVideoContext({subsessionName,userStatus:'invited'})).toBeNull();
    expect(roomVideoContext({subsessionName,userStatus:'joining'})).toBeUndefined();
    expect(roomVideoContext({subsessionName:'Sala externa',userStatus:'in room'})).toBeUndefined();
  });
  it('pagina a las personas en su sala, incluidas quienes tienen la cámara apagada',()=>{
    const people=[
      {userId:1,bVideoOn:false},
      {userId:2,subsessionId:'a',bVideoOn:false},
      {userId:3,subsessionId:'b',userGuid:'confirmado',bVideoOn:true},
      {userId:4,userGuid:'confirmado',bVideoOn:true},
      {userId:5,userGuid:'asignado',bVideoOn:true},
    ];
    expect(peopleInVideoRoom(people,'a',1,new Set(['confirmado'])).map(person=>person.userId)).toEqual([1,2,4]);
    expect(roomVideoPage(Array.from({length:20},(_,index)=>index),8)).toEqual({people:[18,19],page:2,pages:3});
    expect(roomVideoPage(people,2).people).toEqual(people);
  });
  it('asigna por identidad firmada, informa ausentes y conserva idempotencia',async()=>{
    const {controller,api}=fixture();
    controller.setPlan([{id:id(1),user_ids:[id(2),id(9)]}]);
    expect(await controller.sync()).toEqual({status:'waiting',missing:1});
    expect(api.openSubsessions).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({subsessionId:'0',userList:expect.arrayContaining([expect.objectContaining({userId:7})])})]),expect.objectContaining({isAutoJoinSubsession:false}));
    expect(api.assignUserToSubsession).not.toHaveBeenCalled();
    expect(api.assignUserToSubsession).not.toHaveBeenCalledWith(8,'0');
    await controller.sync();expect(api.createSubsessions).toHaveBeenCalledOnce();expect(api.openSubsessions).toHaveBeenCalledOnce();
    await controller.visit(id(1));expect(api.joinSubsession).toHaveBeenCalledWith('0');
    await controller.visit(null);expect(api.leaveSubsession).toHaveBeenCalledOnce();
  });
  it('deniega administración al participante e identidades duplicadas en el plan',async()=>{
    const {controller,api}=fixture(false);
    controller.setPlan([{id:id(1),user_ids:[id(2)]}]);
    expect(await controller.sync()).toMatchObject({status:'unavailable'});
    expect(api.createSubsessions).not.toHaveBeenCalled();
    expect(()=>controller.setPlan([{id:id(1),user_ids:[id(2)]},{id:id(3),user_ids:[id(2)]}])).toThrow();
  });
  it('no informa asignación exitosa cuando el SDK devuelve error resuelto',async()=>{
    const {controller,api}=fixture();
    api.openSubsessions.mockResolvedValue({type:'INVALID_OPERATION'} as never);
    controller.setPlan([{id:id(1),user_ids:[id(2)]}]);
    await expect(controller.sync()).rejects.toThrow('rechazó');
    expect(api.assignUserToSubsession).not.toHaveBeenCalled();
  });
  it('cierra y vuelve a preparar solo las salas administradas por Soflia',async()=>{
    const {controller,api}=fixture();
    controller.setPlan([{id:id(1),user_ids:[id(2)]}]);await controller.sync();
    controller.setPlan([{id:id(3),user_ids:[id(2)]}]);
    expect(await controller.sync()).toEqual({status:'waiting',missing:0});
    expect(api.closeAllSubsessions).toHaveBeenCalledOnce();
    await controller.sync();expect(api.createSubsessions).toHaveBeenCalledTimes(2);
  });
  it('retira de una sala audiovisual a quien ya no figura en el plan académico autorizado',async()=>{
    const {controller,api}=fixture();
    controller.setPlan([{id:id(1),user_ids:[id(2)]}]);await controller.sync();
    api.getSubsessionList()[0].userList.push({userId:7,userKey:id(2),isInSubsession:true});
    controller.setPlan([{id:id(1),user_ids:[]}]);
    expect(await controller.sync()).toEqual({status:'unavailable',missing:1,reason:'assignment_revocation'});
    expect(api.moveBackToMainSession).toHaveBeenCalledWith(7);
    api.getSubsessionList()[0].userList[0].isInSubsession=false;
    api.moveBackToMainSession.mockClear();
    expect(await controller.sync()).toEqual({status:'unavailable',missing:1,reason:'assignment_revocation'});
    expect(api.moveBackToMainSession).not.toHaveBeenCalled();
  });
  it.each([true,false])('reasigna usuarios ya asignados sin tratarlos como no asignados; presencia en sala %s',async(inside)=>{
    const {controller,api}=fixture();
    const plan=[{id:id(1),user_ids:[id(2)]},{id:id(3),user_ids:[]}];
    controller.setPlan(plan);await controller.sync();
    const list=api.getSubsessionList();list[0].userList.push({userId:7,userKey:id(2),isInSubsession:inside});
    api.assignUserToSubsession.mockClear();
    api.assignUserToSubsession.mockImplementation(async()=>{throw new Error('Solo se asignan usuarios no asignados');});
    api.moveUserToSubsession.mockImplementation(async()=>{
      const user=list[0].userList.pop()!;list[1].userList.push(user);return '';
    });
    api.moveBackToMainSession.mockImplementation(async()=>{list[1].userList[0].isInSubsession=false;return '';});
    controller.setPlan([{id:id(1),user_ids:[]},{id:id(3),user_ids:[id(2)]}]);
    expect(await controller.sync()).toEqual({status:'ready',missing:0});
    expect(api.assignUserToSubsession).not.toHaveBeenCalled();
    expect(api.moveUserToSubsession).toHaveBeenCalledWith(7,'1');
    expect(api.moveBackToMainSession).toHaveBeenCalledTimes(inside?1:0);
    await controller.sync();expect(api.moveUserToSubsession).toHaveBeenCalledOnce();
  });
});
