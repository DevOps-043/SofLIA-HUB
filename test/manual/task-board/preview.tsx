/** Fixture manual aislada: sin credenciales, servidor de negocio ni datos reales. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../../src/index.css";
import { Sidebar } from "../../../src/components/Sidebar";
import type { SidebarProps } from "../../../src/components/sidebar/types";
import { UnifiedProjectHub } from "../../../src/components/project-hub/UnifiedProjectHub";
import type {
  ProjectNavigation,
  ProjectSection,
} from "../../../src/components/project-workspace/types";

const noop = () => undefined;
const project = {
  project_id: "p",
  workspace_id: "w",
  project_key: "QA",
  project_name: "Lanzamiento Soflia",
  project_description:
    "Diseñar, construir y lanzar la nueva experiencia de Soflia.",
  project_status: "active",
  priority_level: "high",
  health_status: "on_track",
  completion_percentage: 67,
  updated_at: "2026-10-23",
  target_date: "2026-11-12",
  start_date: "2026-10-19",
  role: "owner",
  team_id: "t",
};
const ok = (data: unknown) => Promise.resolve({ success: true, data });
Object.assign(window, {
  projectHubApi: {
    getProject: () => ok(project),
    getAnalytics: () =>
      ok({
        tasks: { total: 36, completed: 24, overdue: 4 },
        recent_activity: [],
      }),
    listTasks: () =>
      ok([
        {
          issue_id: "a",
          title: "Validar flujo de importación",
          task_statuses: { name: "En curso" },
          task_priorities: { priority_level: "high" },
          assignee: { display_name: "Ana" },
        },
        {
          issue_id: "b",
          title: "Preparar pruebas de lanzamiento",
          task_statuses: { name: "Pendiente" },
        },
      ]),
    listEvidence: () =>
      ok([
        {
          evidence_id: "f",
          title: "Brief del lanzamiento.pdf",
          evidence_type: "upload",
          metadata: { upload_state: "ready" },
          created_at: "2026-10-23",
        },
        {
          evidence_id: "e",
          title: "Investigación de usuarios",
          evidence_type: "link",
          created_at: "2026-10-23",
        },
      ]),
    listMembers: () =>
      ok([
        {
          member_id: "u",
          project_role: "owner",
          user: { display_name: "Ana López" },
        },
      ]),
  },
});

// Doble de dominio mutable para comprobar las interacciones sin acceder a datos reales.
const fixtureTasks: Record<string, unknown>[]=[];
const fixtureMilestones: Record<string, unknown>[]=[{milestone_id:'h1',milestone_name:'Validación del producto',milestone_status:'in_progress',target_date:'2026-11-05',updated_at:'2026-10-23T10:00:00Z',sort_order:0},{milestone_id:'h2',milestone_name:'Lanzamiento público',milestone_status:'pending',target_date:'2026-11-12',updated_at:'2026-10-23T10:00:00Z',sort_order:1}];
const fixtureDocs: Record<string, unknown>[]=[];
const fixtureComments: Record<string, unknown>[]=[];
const fixtureMembers: Record<string, unknown>[]=[{member_id:'owner',user_id:'owner',role:'owner',user:{display_name:'Ana López'}}];
const fixtureOptions={statuses:[{status_id:'todo',name:'Por hacer'},{status_id:'progress',name:'En curso'}],priorities:[{priority_id:'high',name:'Alta',level:2}],assignees:[{user:{user_id:'ana',display_name:'Ana López'}}],cycles:[{cycle_id:'cycle',name:'Ciclo de lanzamiento',status:'active',start_date:'2026-10-19',end_date:'2026-11-02'}],labels:[{label_id:'design',name:'Diseño'}]};
const api=(window as unknown as {projectHubApi:Record<string,(input:Record<string,unknown>)=>Promise<unknown>>}).projectHubApi;
const initialTasks=api.listTasks;
const milestoneValues=(input:Record<string,unknown>)=>({milestone_name:input.name,milestone_description:input.description,milestone_status:input.status || 'pending',target_date:input.target_date,sort_order:input.sort_order || 0,updated_at:new Date().toISOString()});
Object.assign(api,{
 getTaskOptions:()=>ok(fixtureOptions),
 listTasks:async(input:Record<string,unknown>)=>{const initial=await initialTasks(input) as {data:Record<string,unknown>[]};return {success:true,data:[...initial.data,...fixtureTasks].filter(row=>!input.search || String(row.title).toLowerCase().includes(String(input.search).toLowerCase()))};},
 createTask:(input:{task:Record<string,unknown>})=>{const row={issue_id:crypto.randomUUID(),...input.task,updated_at:new Date().toISOString()};fixtureTasks.push(row);return ok(row);},
 updateTask:(input:{taskId:string;updates:Record<string,unknown>})=>{const row=fixtureTasks.find(row=>row.issue_id===input.taskId);Object.assign(row || {},input.updates);return ok(row);},
 archiveTask:(input:{taskId:string})=>{const index=fixtureTasks.findIndex(row=>row.issue_id===input.taskId);if(index>=0)fixtureTasks.splice(index,1);return ok({archived:true});},
 getTaskDetail:()=>ok({comments:fixtureComments,history:[{history_id:'history',field_name:'created',actor:{display_name:'Ana López'},created_at:'2026-10-23'}]}),
 addTaskComment:(input:{content:string})=>{fixtureComments.push({comment_id:crypto.randomUUID(),body:input.content,author:{display_name:'Ana López'},created_at:'2026-10-23'});return ok({saved:true});},
 listMilestones:()=>ok([...fixtureMilestones]),
 createMilestone:(input:{milestone:Record<string,unknown>})=>{const row={milestone_id:crypto.randomUUID(),...milestoneValues(input.milestone)};fixtureMilestones.push(row);return ok(row);},
 updateMilestone:(input:{milestoneId:string;updates:Record<string,unknown>})=>{const row=fixtureMilestones.find(row=>row.milestone_id===input.milestoneId);Object.assign(row || {},milestoneValues(input.updates));return ok(row);},
 cancelMilestone:(input:{milestoneId:string})=>{const row=fixtureMilestones.find(row=>row.milestone_id===input.milestoneId);if(row)row.milestone_status='cancelled';return ok(row);},
 listDocuments:()=>ok([...fixtureDocs]),listTaskDocuments:()=>ok([]),
 createDocument:(input:{document:Record<string,unknown>})=>{const row={id:crypto.randomUUID(),...input.document,updated_at:new Date().toISOString()};fixtureDocs.push(row);return ok(row);},
 removeDocument:(input:{documentId:string})=>{const index=fixtureDocs.findIndex(row=>row.id===input.documentId);if(index>=0)fixtureDocs.splice(index,1);return ok({unlinked:true});},
 getProjectTeam:()=>ok({team:{team_id:'t',name:'Equipo de producto',description:'Diseño, desarrollo y lanzamiento de Soflia',owner_id:'owner'},members:fixtureMembers,available:[{team_id:'t',name:'Equipo de producto'}],directory:[{user:{user_id:'diego',display_name:'Diego Martínez',email:'diego@example.test'}}],can_manage:true,can_assign:true,can_create:true}),
 addTeamMember:(input:{userId:string;role:string})=>{fixtureMembers.push({member_id:'new-member',user_id:input.userId,role:input.role,user:{display_name:'Diego Martínez'}});return ok({saved:true});},
 removeTeamMember:(input:{memberId:string})=>{const index=fixtureMembers.findIndex(row=>row.member_id===input.memberId);if(index>=0)fixtureMembers.splice(index,1);return ok({removed:true});},
});
// Datos exclusivos de esta prueba; no consulta cuentas o proyectos reales.
const statuses = [
  {status_id:'backlog',name:'Backlog',status_type:'backlog'},
  {status_id:'pending',name:'Pendientes',status_type:'todo'},
  {status_id:'todo',name:'Por hacer',status_type:'todo'},
  {status_id:'doing',name:'En curso',status_type:'in_progress'},
  {status_id:'review',name:'En revisión',status_type:'in_review'},
  {status_id:'done',name:'Completadas',status_type:'done'},
  {status_id:'cancelled',name:'Canceladas',status_type:'cancelled'},
];
const people = [{user_id:'ana',display_name:'Ana Torres'},{user_id:'diego',display_name:'Diego Martínez'},{user_id:'lucia',display_name:'Lucía Ramírez'}];
let tasks = [
 ['a','Diseñar la nueva página de inicio','todo','ana',5,'2026-11-03'],
 ['b','Documentar los componentes del sistema','todo','diego',2,'2026-11-05'],
 ['c','Preparar las pruebas de accesibilidad','todo',null,null,null],
 ['d','Implementar el flujo de creación de proyectos','doing','ana',8,'2026-11-02'],
 ['e','Conectar las carpetas de Google Drive','doing','diego',5,'2026-11-04'],
 ['f','Validar el alcance con el equipo','review','lucia',2,'2026-11-01'],
 ['g','Revisar la experiencia en pantallas pequeñas','review','ana',5,'2026-11-06'],
 ['h','Definir los objetivos del lanzamiento','done','lucia',2,'2026-10-23'],
 ['i','Organizar los materiales de referencia','done','diego',2,'2026-10-24'],
 ['j','Explorar una nueva integración','backlog',null,null,null],
 ['k','Confirmar los recursos del lanzamiento','pending','lucia',2,'2026-11-03'],
 ['l','Migrar el diseño anterior','cancelled','diego',2,null],
].map(([issue_id,title,status_id,assignee_id,estimate_points,due_date],i)=>({issue_id,title,status_id,assignee_id,estimate_points,due_date,issue_number:i+1,updated_at:'2026-10-24T10:00:00Z',task_statuses:statuses.find(row=>row.status_id===status_id),assignee:people.find(row=>row.user_id===assignee_id),task_issue_labels:i===0?[{task_labels:{label_id:'design',name:'Diseño'}}]:[]}));
let emptyBoard = false;
window.addEventListener('qa-empty',()=>{emptyBoard=true;});
Object.assign(api, {
 getTaskOptions:()=>ok({statuses,assignees:people.map(user=>({user})),cycles:[{cycle_id:'launch',name:'Lanzamiento'}],labels:[]}),
 listTasks:(input: Record<string,string>)=>ok(emptyBoard?[]:tasks.filter(row=>(!input.search||String(row.title).toLowerCase().includes(input.search.toLowerCase()))&&(!input.statusId||row.status_id===input.statusId)&&(!input.assigneeId||row.assignee_id===input.assigneeId)&&(!input.difficulty||(input.difficulty==='unestimated'?row.estimate_points==null:input.difficulty==='low'?typeof row.estimate_points==='number'&&row.estimate_points<=2:input.difficulty==='medium'?typeof row.estimate_points==='number'&&row.estimate_points>2&&row.estimate_points<=5:typeof row.estimate_points==='number'&&row.estimate_points>5)))),
 updateTask:({taskId,updates}:{taskId:string,updates:Record<string,unknown>})=>{tasks=tasks.map(task=>task.issue_id===taskId?{...task,...updates,task_statuses:statuses.find(row=>row.status_id===(updates.status_id||task.status_id))}:task);return ok({});},
 getTaskDetail:()=>ok({comments:[],history:[]}),listTaskDocuments:()=>ok([]),getLocation:()=>ok(null),
});
const defaults: SidebarProps = {
  isOpen: true,
  onToggle: noop,
  activeView: "project-hub",
  conversations: [],
  currentConversationId: null,
  loadingConversations: false,
  onNewChat: noop,
  onSelectConversation: noop,
  onDeleteConversation: noop,
  onTogglePinConversation: noop,
  renamingChatId: null,
  onSetRenamingChatId: noop,
  editingChatTitle: "",
  onSetEditingChatTitle: noop,
  onRenameChat: noop,
  activeMenuChatId: null,
  onSetActiveMenuChatId: noop,
  onSetMovingChatId: noop,
  folders: [],
  expandedFolders: new Set(),
  currentFolderId: null,
  onCreateFolderClick: noop,
  onToggleFolder: noop,
  onOpenProject: noop,
  onDeleteFolder: noop,
  renamingFolderId: null,
  editingFolderName: "",
  onSetEditingFolderName: noop,
  onStartRenameFolder: noop,
  onFinishRenameFolder: noop,
  onCancelRenameFolder: noop,
  irisTeams: [],
  irisProjects: [],
  irisIssues: {},
  expandedTeams: new Set(),
  expandedProjects: new Set(),
  onToggleTeam: noop,
  onToggleProject: noop,
  onIrisProjectClick: noop,
  onIrisIssueClick: noop,
  onRefreshIris: noop,
  displayName: "Ana López",
  initials: "AL",
  userEmail: undefined,
  avatarUrl: undefined,
  orgName: "Organización de prueba",
  orgLogoUrl: undefined,
  theme: "light",
  onSetTheme: noop,
  onOpenSettings: noop,
  onSignOut: noop,
};
export function Preview() {
  const [section, setSection] = useState<ProjectSection>("tasks");
  const [expanded, setExpanded] = useState(true);
  const navigation: ProjectNavigation = {
    name: project.project_name,
    section,
    conversations: [
      "Decisiones de producto",
      "Plan de lanzamiento",
      "Revisión de entregables",
    ].map((title, i) => ({
      id: String(i),
      user_id: "u",
      title,
      created_at: "",
      updated_at: "",
    })),
    currentConversationId: null,
    canCreateChat: true,
    browserOpen: false,
    onNavigate: setSection,
    onBack: noop,
    onNewChat: () => setSection("chats"),
    onOpenChat: () => setSection("chats"),
    onOpenBrowser: noop,
  };
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex h-8 shrink-0 items-center justify-end px-5 text-[10px] text-secondary">
        Prueba visual · Datos de prueba
      </div>
      <div className="flex min-h-0 flex-1">
        <Sidebar
          {...defaults}
          isOpen={expanded}
          onToggle={() => setExpanded(!expanded)}
          projectNavigation={navigation}
        />
        <UnifiedProjectHub
          workspaceId="w"
          projectId="p"
          section={section}
          onNavigate={setSection}
          navigation={navigation}
        />
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
