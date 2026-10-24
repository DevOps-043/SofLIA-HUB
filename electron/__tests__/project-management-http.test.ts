import { getAuthState, resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectHubApiService } from '../project-hub/service';
import { projectHubIpcCases, IPC_ID } from './project-hub/ipc-cases';
import { credentials, tokenPair, workspace } from './project-hub/fixtures';
import { PROJECT_MANAGEMENT_CHANNELS, type ProjectManagementInputs } from '../../src/shared/project-management';

vi.mock('../main/sofia-session', () => ({getSofiaSessionUserId:()=>getAuthState().userId}));
const captured:{method:string;url:string;body:unknown}[]=[];
const server=createServer(async(request,response)=>{
 let body='';for await(const chunk of request)body+=chunk;
 response.setHeader('content-type','application/json');
 if(request.url?.endsWith('/exchange')){response.end(JSON.stringify({data:{...tokenPair(),workspaces:[workspace()]}}));return;}
 if(request.url?.endsWith('/refresh')){response.end(JSON.stringify({data:tokenPair()}));return;}
 captured.push({method:request.method!,url:request.url!,body:body?JSON.parse(body):undefined});
 response.end(JSON.stringify({data:request.method==='GET'?[]:{saved:true},meta:{has_more:false,next_cursor:null}}));
});
let service:ProjectHubApiService,base:string;
beforeAll(async()=>{await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+(server.address() as AddressInfo).port;});
beforeEach(async()=>{resetAuthStateForTests();setAuthState({authenticated:true,userId:'usuario-ficticio'});service=new ProjectHubApiService(base,{load:async()=>credentials(),save:async()=>{},clear:async()=>{}});await service.exchangeSofiaToken('identidad-ficticia');captured.length=0;});
afterAll(async()=>{resetAuthStateForTests();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
const paths:Record<keyof ProjectManagementInputs,[string,string]>={
getTaskDetail:['GET',`/tasks/${IPC_ID}`],addTaskComment:['POST',`/tasks/${IPC_ID}/comments`],listTaskDocuments:['GET',`/tasks/${IPC_ID}/documents`],createTaskDocument:['POST',`/tasks/${IPC_ID}/documents`],updateTaskDocument:['PATCH',`/tasks/${IPC_ID}/documents/${IPC_ID}`],removeTaskDocument:['DELETE',`/tasks/${IPC_ID}/documents/${IPC_ID}`],createTaskLabel:['POST','/task-labels'],
 getTaskOptions:['GET','/task-options'],archiveTask:['POST',`/tasks/${IPC_ID}/archive`],listMilestones:['GET','/milestones'],createMilestone:['POST','/milestones'],updateMilestone:['PATCH',`/milestones/${IPC_ID}`],cancelMilestone:['DELETE',`/milestones/${IPC_ID}`],
 getProjectTeam:['GET','/team'],assignProjectTeam:['PATCH','/team'],createProjectTeam:['POST','/team'],updateProjectTeam:['PATCH',`/team/${IPC_ID}`],addTeamMember:['POST',`/team/${IPC_ID}/members`],updateTeamMember:['PATCH',`/team/${IPC_ID}/members/${IPC_ID}`],removeTeamMember:['DELETE',`/team/${IPC_ID}/members/${IPC_ID}`],
 listDocuments:['GET','/documents'],createDocument:['POST','/documents'],updateDocument:['PATCH',`/documents/${IPC_ID}`],removeDocument:['DELETE',`/documents/${IPC_ID}`],updateEvidence:['PATCH',`/evidence/${IPC_ID}`],archiveEvidence:['DELETE',`/evidence/${IPC_ID}`],
};
describe('Servicio de gestión contra HTTP loopback real',()=>{
 it.each(PROJECT_MANAGEMENT_CHANNELS)('transporta %s por su ruta pública del servidor',async(_channel,method)=>{
  const test=projectHubIpcCases.find(item=>item.method===method)!;
  const operation=service[method] as (input:unknown)=>Promise<unknown>;
  expect(await operation.call(service,test.input)).toMatchObject({success:true});
  const [verb,suffix]=paths[method];expect(captured).toHaveLength(1);expect(captured[0]).toMatchObject({method:verb,url:`/api/v1/workspaces/${IPC_ID}/projects/${IPC_ID}${suffix}`});
  if(captured[0].body)expect(captured[0].body).not.toHaveProperty('workspaceId');
 });
 it('codifica búsqueda y filtros sin concatenar caracteres de control',async()=>{
  await service.listTasks({workspaceId:IPC_ID,projectId:IPC_ID,search:'plan & entrega?',statusId:IPC_ID,cursor:'abc/def='});
  const url=new URL(captured[0].url,base);expect(url.searchParams.get('search')).toBe('plan & entrega?');expect(url.searchParams.get('statusId')).toBe(IPC_ID);expect(url.searchParams.get('cursor')).toBe('abc/def=');
 });
 it('conserva la revisión al cancelar o desvincular con DELETE',async()=>{
  const revision='2026-10-23T10:00:00+00:00';await service.removeDocument({workspaceId:IPC_ID,projectId:IPC_ID,documentId:IPC_ID,expectedUpdatedAt:revision});expect(new URL(captured[0].url,base).searchParams.get('expectedUpdatedAt')).toBe(revision);expect(captured[0].body).toBeUndefined();
 });
});
