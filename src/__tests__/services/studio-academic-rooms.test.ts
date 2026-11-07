import {describe,it,expect,vi} from 'vitest';
import {academicRooms} from '../../../packages/zoom-runtime/academic-rooms';
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
  it('asigna por identidad firmada, informa ausentes y conserva idempotencia',async()=>{
    const {controller,api}=fixture();
    controller.setPlan([{id:id(1),user_ids:[id(2),id(9)]}]);
    expect(await controller.sync()).toEqual({status:'waiting',missing:1});
    expect(api.assignUserToSubsession).toHaveBeenCalledWith(7,'0');
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
    api.assignUserToSubsession.mockResolvedValue({type:'INVALID_OPERATION'} as never);
    controller.setPlan([{id:id(1),user_ids:[id(2)]}]);
    await expect(controller.sync()).rejects.toThrow('rechazó');
    expect(api.openSubsessions).not.toHaveBeenCalled();
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
    controller.setPlan([{id:id(1),user_ids:[]}]);await controller.sync();
    expect(api.moveBackToMainSession).toHaveBeenCalledWith(7);
  });
});
