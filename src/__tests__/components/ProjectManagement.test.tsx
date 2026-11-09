import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectTasks } from '../../components/project-workspace/ProjectTasks';
import { ProjectMilestones } from '../../components/project-workspace/ProjectMilestones';
import { ProjectDocuments } from '../../components/project-workspace/ProjectDocuments';
import { ProjectTeam } from '../../components/project-workspace/ProjectTeam';
import { ProjectEvidenceActions } from '../../components/project-workspace/ProjectEvidenceActions';
import type { ProjectHubResult } from '../../services/project-hub-api';

const w='12345678-1234-4123-8123-123456789001',p='12345678-1234-4123-8123-123456789002',id='12345678-1234-4123-8123-123456789003',user='12345678-1234-4123-8123-123456789004',date='2026-10-23T10:00:00Z';
const props={workspaceId:w,projectId:p,canWrite:true,canManage:true,onRefresh:vi.fn(),state:{loading:false,data:[]}};
const bridge:Record<string,ReturnType<typeof vi.fn>>={};
const ok=(data:unknown)=>({success:true,data});
beforeEach(()=>{
 for(const method of ['listTasks','getTaskOptions','getTaskDetail','addTaskComment','listTaskDocuments','createTaskDocument','createTaskLabel','createTask','updateTask','archiveTask','listMilestones','createMilestone','updateMilestone','cancelMilestone','listDocuments','createDocument','updateDocument','removeDocument','updateEvidence','archiveEvidence','getProjectTeam','assignProjectTeam','createProjectTeam','updateProjectTeam','addTeamMember','updateTeamMember','removeTeamMember','addMember','updateMember','removeMember'])bridge[method]=vi.fn(async()=>ok([]));
 bridge.getTaskDetail.mockResolvedValue(ok({comments:[],history:[]}));
 bridge.getTaskOptions.mockResolvedValue(ok({statuses:[{status_id:id,name:'En curso'}],priorities:[{priority_id:id,name:'Alta'}],assignees:[{user:{user_id:user,display_name:'Ana'}}],cycles:[]}));
 vi.stubGlobal('projectHubApi',undefined);Object.assign(window,{projectHubApi:bridge});props.onRefresh.mockClear();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();delete (window as Window & {projectHubApi?:unknown}).projectHubApi;});
const fill=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label),{target:{value}});
async function choose(label:string,value:string){fireEvent.click(screen.getByRole('combobox',{name:label}));fireEvent.click(await screen.findByRole('option',{name:value}));}
describe('Gestión de tareas en la misma interfaz',()=>{
 it('abre una ventana fuera del tablero y devuelve el foco al cerrar',async()=>{
  render(<ProjectTasks {...props}/>);await screen.findByText(/Aún no hay tareas visibles/);
  const trigger=screen.getByRole('button',{name:'Nueva tarea'});trigger.focus();fireEvent.click(trigger);
  const dialog=screen.getByRole('dialog',{name:'Nueva tarea'});
  expect(dialog.parentElement).toBe(document.body);expect(dialog.contains(screen.getByLabelText('Tablero de tareas'))).toBe(false);
  expect(screen.getByLabelText('Título de la tarea')).toHaveFocus();
  fireEvent.click(within(dialog).getByRole('button',{name:'Cerrar ventana'}));expect(screen.queryByRole('dialog')).toBeNull();expect(trigger).toHaveFocus();
 });
 it('ofrece las siete fases incluso si faltan estados y envía la fase solicitada al guardar',async()=>{
  bridge.getTaskOptions.mockResolvedValue(ok({statuses:[],can_manage_statuses:true}));render(<ProjectTasks {...props}/>);await screen.findByText(/Aún no hay tareas visibles/);fireEvent.click(screen.getByRole('button',{name:'Nueva tarea'}));
  fireEvent.click(screen.getByRole('combobox',{name:'Estado'}));
  expect(screen.getAllByRole('option').map(option=>option.textContent)).toHaveLength(7);
  fireEvent.click(screen.getByRole('option',{name:/En curso/}));fill('Título de la tarea','Coordinar entrega');fireEvent.click(screen.getByRole('button',{name:'Guardar tarea'}));
  await waitFor(()=>expect(bridge.createTask).toHaveBeenCalledWith(expect.objectContaining({task:expect.objectContaining({status_stage:'in_progress'})})));
 });
 it('guarda inicio, foto, documento, página y chat en la misma tarea con URLs saneadas',async()=>{
  render(<ProjectTasks {...props}/>);await screen.findByText(/Aún no hay tareas visibles/);fireEvent.click(screen.getByRole('button',{name:'Nueva tarea'}));
  fill('Título de la tarea','Lanzamiento');fill('Fecha de inicio','2026-11-01');fill('Fecha límite','2026-11-10');
  for (const [i,type] of ['Foto','Documento','Página web','Chat del equipo'].entries()) {
   fireEvent.click(screen.getByRole('button',{name:'Añadir vínculo'}));await choose(`Tipo del recurso ${i+1}`,type);fill(`Nombre del recurso ${i+1}`,type);fill(`Enlace del recurso ${i+1}`,`https://example.test/${i}?token=privado`);
  }
  fireEvent.click(screen.getByRole('button',{name:'Guardar tarea'}));
  await waitFor(()=>expect(bridge.createTask).toHaveBeenCalledWith(expect.objectContaining({task:expect.objectContaining({started_at:'2026-11-01T00:00:00.000Z',external_links:[{type:'photo',name:'Foto',url:'https://example.test/0'},{type:'document',name:'Documento',url:'https://example.test/1'},{type:'web',name:'Página web',url:'https://example.test/2'},{type:'team_chat',name:'Chat del equipo',url:'https://example.test/3'}]})})));
 });
 it('rechaza fechas invertidas y protocolos inseguros sin perder el borrador',async()=>{
  render(<ProjectTasks {...props}/>);await screen.findByText(/Aún no hay tareas visibles/);fireEvent.click(screen.getByRole('button',{name:'Nueva tarea'}));fill('Título de la tarea','Conservar borrador');fill('Fecha de inicio','2026-12-02');fill('Fecha límite','2026-12-01');
  fireEvent.submit(screen.getByRole('button',{name:'Guardar tarea'}).closest('form')!);expect(await screen.findByRole('alert')).toHaveTextContent(/fecha de inicio/);expect(bridge.createTask).not.toHaveBeenCalled();
  fill('Fecha límite','2026-12-03');fireEvent.click(screen.getByRole('button',{name:'Añadir vínculo'}));fill('Nombre del recurso 1','Archivo');fill('Enlace del recurso 1','javascript:alert(1)');fireEvent.submit(screen.getByRole('button',{name:'Guardar tarea'}).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent(/HTTP o HTTPS/);expect(screen.getByLabelText('Título de la tarea')).toHaveValue('Conservar borrador');expect(bridge.createTask).not.toHaveBeenCalled();
  fill('Enlace del recurso 1','sin-url');fireEvent.submit(screen.getByRole('button',{name:'Guardar tarea'}).closest('form')!);expect(await screen.findByRole('alert')).toHaveTextContent(/HTTP o HTTPS/);expect(bridge.createTask).not.toHaveBeenCalled();
 });
 it('conserva la hora original y referencias heredadas al editar otro campo',async()=>{
  bridge.listTasks.mockResolvedValue(ok([{issue_id:id,title:'Tarea anterior',status_id:id,started_at:'2026-10-23T16:45:00Z',external_links:[{legacy:'referencia anterior'}],updated_at:date}]));render(<ProjectTasks {...props}/>);fireEvent.click(await screen.findByRole('button',{name:/Tarea anterior/}));
  expect(screen.getByLabelText('Fecha de inicio')).toHaveValue('2026-10-23');fill('Título de la tarea','Tarea revisada');fireEvent.click(screen.getByRole('button',{name:'Guardar tarea'}));
  await waitFor(()=>expect(bridge.updateTask).toHaveBeenCalled());const updates=bridge.updateTask.mock.calls[0][0].updates;expect(updates.started_at).toBe('2026-10-23T16:45:00Z');expect(updates).not.toHaveProperty('external_links');
 });
 it('reabre recursos y permite retirar la referencia sin borrar el archivo remoto',async()=>{
  bridge.listTasks.mockResolvedValue(ok([{issue_id:id,title:'Con recursos',status_id:id,external_links:[{type:'photo',name:'Foto del equipo',url:'https://example.test/foto.png'}],updated_at:date}]));render(<ProjectTasks {...props}/>);fireEvent.click(await screen.findByRole('button',{name:/Con recursos/}));
  expect(screen.getByLabelText('Nombre del recurso 1')).toHaveValue('Foto del equipo');fireEvent.click(screen.getByRole('button',{name:'Quitar recurso 1'}));fireEvent.click(screen.getByRole('button',{name:'Guardar tarea'}));
  await waitFor(()=>expect(bridge.updateTask).toHaveBeenCalledWith(expect.objectContaining({updates:expect.objectContaining({external_links:[]})})));
 });
 it('permite reintentar opciones dentro de la ventana sin perder el borrador',async()=>{
  bridge.getTaskOptions.mockResolvedValueOnce({success:false,error:'No se pudieron consultar las opciones'}).mockResolvedValue(ok({statuses:[{status_id:id,name:'Por hacer',status_type:'todo'}]}));
  render(<ProjectTasks {...props}/>);await screen.findByText('No se pudieron consultar las opciones');fireEvent.click(screen.getByRole('button',{name:'Nueva tarea'}));fill('Título de la tarea','Mi borrador');fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Reintentar opciones'}));
  await waitFor(()=>expect(screen.getByRole('combobox',{name:'Estado'})).toHaveTextContent('Por hacer'));expect(screen.getByLabelText('Título de la tarea')).toHaveValue('Mi borrador');
 });
 it('crea una tarea con descripción, responsable, dificultad y fecha',async()=>{
  render(<ProjectTasks {...props}/>);await screen.findByText(/Aún no hay tareas visibles con estos filtros/);fireEvent.click(screen.getByRole('button',{name:'Nueva tarea'}));fill('Título de la tarea','Preparar lanzamiento');fill('Descripción','Validar la entrega con el equipo');fill('Fecha límite','2026-12-01');await choose('Responsable','Ana');await choose('Dificultad','Media');fireEvent.click(screen.getByRole('button',{name:'Guardar tarea'}));
  await waitFor(()=>expect(bridge.createTask).toHaveBeenCalledWith(expect.objectContaining({workspaceId:w,projectId:p,task:expect.objectContaining({title:'Preparar lanzamiento',description:'Validar la entrega con el equipo',assignee_id:user,priority_id:null,due_date:'2026-12-01',estimate_points:5})})));expect(props.onRefresh).toHaveBeenCalledOnce();
 });
 it('edita un registro y envía la revisión leída',async()=>{
  bridge.listTasks.mockResolvedValue(ok([{issue_id:id,title:'Tarea existente',status_id:id,updated_at:date}]));render(<ProjectTasks {...props}/>);fireEvent.click(await screen.findByRole('button',{name:/Tarea existente/}));fill('Título de la tarea','Título corregido');fireEvent.click(screen.getByRole('button',{name:'Guardar tarea'}));await waitFor(()=>expect(bridge.updateTask).toHaveBeenCalledWith(expect.objectContaining({taskId:id,updates:expect.objectContaining({title:'Título corregido',expected_updated_at:date})})));
 });
 it('pagina sin duplicar filas y conserva el filtro de búsqueda',async()=>{
  bridge.listTasks.mockResolvedValueOnce({...ok([{issue_id:id,title:'Primera'}]),meta:{next_cursor:'cursor-siguiente',has_more:true}}).mockResolvedValueOnce(ok([{issue_id:id,title:'Primera'},{issue_id:user,title:'Segunda'}]));render(<ProjectTasks {...props}/>);fireEvent.click(await screen.findByRole('button',{name:'Cargar más'}));await screen.findByRole('button',{name:/Segunda/});expect(screen.getAllByRole('button',{name:/Primera/})).toHaveLength(1);expect(bridge.listTasks.mock.calls[1][0]).toMatchObject({cursor:'cursor-siguiente'});fill('Buscar tareas','Lanzamiento');await waitFor(()=>expect(bridge.listTasks).toHaveBeenLastCalledWith(expect.objectContaining({search:'Lanzamiento',cursor:undefined})));
 });
 it('publica un comentario y vincula documentos dentro de su tarea',async()=>{bridge.listTasks.mockResolvedValue(ok([{issue_id:id,title:'Tarea colaborativa',updated_at:date}]));render(<ProjectTasks {...props}/>);fireEvent.click(await screen.findByRole('button',{name:/Tarea colaborativa/}));fill('Nuevo comentario','Revisado con el equipo');fireEvent.click(screen.getByRole('button',{name:'Publicar comentario'}));await waitFor(()=>expect(bridge.addTaskComment).toHaveBeenCalledWith({workspaceId:w,projectId:p,taskId:id,content:'Revisado con el equipo'}));fireEvent.click(screen.getByRole('button',{name:'Vincular documento'}));fill('Nombre del documento','Guía de la tarea');fill('Enlace del documento','https://example.test/tarea');fireEvent.click(screen.getByRole('button',{name:'Guardar documento'}));await waitFor(()=>expect(bridge.createTaskDocument).toHaveBeenCalledWith(expect.objectContaining({taskId:id,document:expect.objectContaining({name:'Guía de la tarea'})})));expect(bridge.createDocument).not.toHaveBeenCalled();});
 it('el lector abre detalle pero no encuentra acciones de escritura',async()=>{
  bridge.listTasks.mockResolvedValue(ok([{issue_id:id,title:'Tarea visible'}]));render(<ProjectTasks {...props} canWrite={false} canManage={false}/>);fireEvent.click(await screen.findByRole('button',{name:/Tarea visible/}));expect(screen.getByLabelText('Título de la tarea')).toBeDisabled();expect(screen.queryByRole('button',{name:'Nueva tarea'})).toBeNull();expect(screen.queryByRole('button',{name:'Guardar tarea'})).toBeNull();expect(screen.queryByRole('button',{name:'Archivar tarea'})).toBeNull();
 });
 it('un resultado incierto bloquea la repetición automática de una creación',async()=>{
  bridge.createTask.mockResolvedValue({success:false,uncertain:true,error:'Tiempo agotado'});render(<ProjectTasks {...props}/>);await screen.findByText(/Aún no hay tareas visibles/);fireEvent.click(screen.getByRole('button',{name:'Nueva tarea'}));fill('Título de la tarea','Tarea con resultado incierto');fireEvent.click(screen.getByRole('button',{name:'Guardar tarea'}));await screen.findByText(/No se pudo verificar el resultado/);expect(screen.getByRole('button',{name:'Guardar tarea'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Guardar tarea'}));expect(bridge.createTask).toHaveBeenCalledOnce();
 });
 it('una respuesta anterior a un cambio de filtro nunca repone datos obsoletos',async()=>{
  let release!:(value:ProjectHubResult)=>void;bridge.listTasks.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;})).mockResolvedValueOnce(ok([{issue_id:user,title:'Resultado actual'}]));render(<ProjectTasks {...props}/>);await waitFor(()=>expect(bridge.listTasks).toHaveBeenCalledOnce());fill('Buscar tareas','actual');await screen.findByRole('button',{name:/Resultado actual/});await act(async()=>release(ok([{issue_id:id,title:'Respuesta obsoleta'}])));expect(screen.queryByRole('button',{name:/Respuesta obsoleta/})).toBeNull();
 });
});
describe('Hitos y documentos',()=>{
 it('crea un hito con fecha y estado real',async()=>{render(<ProjectMilestones {...props}/>);fireEvent.click(screen.getByRole('button',{name:'Nuevo hito'}));fill('Nombre del hito','Entrega final');fill('Fecha objetivo','2026-12-01');await choose('Estado del hito','En curso');fireEvent.click(screen.getByRole('button',{name:'Guardar hito'}));await waitFor(()=>expect(bridge.createMilestone).toHaveBeenCalledWith({workspaceId:w,projectId:p,milestone:{name:'Entrega final',description:null,target_date:'2026-12-01',status:'in_progress',sort_order:0}}));});
 it('cancelar un hito exige una decisión visible y conserva su identificador',async()=>{bridge.listMilestones.mockResolvedValue(ok([{milestone_id:id,milestone_name:'Entrega',target_date:'2026-12-01',milestone_status:'pending',updated_at:date}]));render(<ProjectMilestones {...props}/>);fireEvent.click(await screen.findByRole('button',{name:'Ver hito'}));fireEvent.click(screen.getByRole('button',{name:'Cancelar hito'}));expect(bridge.cancelMilestone).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Confirmar cancelación del hito'}));await waitFor(()=>expect(bridge.cancelMilestone).toHaveBeenCalledWith({workspaceId:w,projectId:p,milestoneId:id,expectedUpdatedAt:date}));});
 it('vincula una carpeta sin simular una descarga ni mover el original',async()=>{render(<ProjectDocuments {...props}/>);fireEvent.click(screen.getByRole('button',{name:'Vincular documento'}));fill('Nombre del documento','Carpeta de diseño');fill('Enlace del documento','https://drive.example.test/carpeta');await choose('Formato del documento','Carpeta');fireEvent.click(screen.getByRole('button',{name:'Guardar documento'}));await waitFor(()=>expect(bridge.createDocument).toHaveBeenCalledWith(expect.objectContaining({document:expect.objectContaining({name:'Carpeta de diseño',doc_type:'folder',external_url:'https://drive.example.test/carpeta'})})));});
 it('desvincular un documento requiere confirmar y no llama a borrar archivos',async()=>{bridge.listDocuments.mockResolvedValue(ok([{id,name:'Guía',external_url:'https://drive.example.test/guia',provider:'google_drive',doc_type:'document',updated_at:date}]));render(<ProjectDocuments {...props}/>);fireEvent.click(await screen.findByRole('button',{name:'Desvincular documento'}));expect(bridge.removeDocument).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Confirmar desvinculación'}));await waitFor(()=>expect(bridge.removeDocument).toHaveBeenCalledWith({workspaceId:w,projectId:p,documentId:id,expectedUpdatedAt:date}));expect(bridge.archiveEvidence).not.toHaveBeenCalled();});
 it('edita etiquetas de evidencia sin permitir modificar el objeto almacenado',async()=>{render(<ProjectEvidenceActions {...props} row={{evidence_id:id,title:'Original',summary:'Resumen'}}/>);fireEvent.click(screen.getByRole('button',{name:'Editar archivo'}));fill('Título del archivo','Título nuevo');fireEvent.click(screen.getByRole('button',{name:'Guardar datos del archivo'}));await waitFor(()=>expect(bridge.updateEvidence).toHaveBeenCalledWith({workspaceId:w,projectId:p,evidenceId:id,updates:{title:'Título nuevo',summary:'Resumen',expected_title:'Original',expected_summary:'Resumen'}}));});
});
describe('Equipos y colaboradores',()=>{
 const project={project_id:p,workspace_id:w,project_key:'QA',project_name:'Proyecto',project_status:'active',priority_level:'medium',health_status:'on_track',completion_percentage:0,updated_at:date,team_id:id};
 const teamProps={...props,project,members:{loading:false,data:[]}};
 it('muestra el equipo real y permite seleccionar personas por nombre',async()=>{bridge.getProjectTeam.mockResolvedValue(ok({team:{team_id:id,name:'Equipo de diseño',owner_id:id},members:[],directory:[{user:{user_id:user,display_name:'Ana'}}],available:[],can_manage:true}));render(<ProjectTeam {...teamProps}/>);await screen.findByText('Equipo de diseño');await choose('Nuevo integrante','Ana');fireEvent.click(screen.getByRole('button',{name:'Añadir al equipo'}));await waitFor(()=>expect(bridge.addTeamMember).toHaveBeenCalledWith({workspaceId:w,projectId:p,teamId:id,userId:user,role:'member'}));});
 it('un equipo privado sin acceso no expone su lista ni formularios',async()=>{bridge.getProjectTeam.mockResolvedValue(ok({team:null,members:[],directory:[],restricted:true,can_manage:false}));render(<ProjectTeam {...teamProps} canManage={false}/>);await screen.findByText(/Necesitas acceso al equipo/);expect(screen.queryByRole('button',{name:'Añadir al equipo'})).toBeNull();expect(screen.queryByRole('button',{name:'Crear equipo'})).toBeNull();expect(screen.queryByRole('button',{name:'Editar equipo'})).toBeNull();});
 it('el propietario no tiene acciones para degradarse o retirarse del equipo',async()=>{bridge.getProjectTeam.mockResolvedValue(ok({team:{team_id:id,name:'Equipo',owner_id:user},members:[{member_id:id,user_id:user,role:'owner',user:{display_name:'Ana'}}],can_manage:true,directory:[]}));render(<ProjectTeam {...teamProps}/>);await screen.findByText('Propietario');expect(screen.queryByRole('button',{name:'Retirar del equipo'})).toBeNull();});
});
