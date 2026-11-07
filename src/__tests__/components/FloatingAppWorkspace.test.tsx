import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppWorkspace } from '../../app/AppWorkspace';
import type { AppChatView } from '../../app/AppChatView';

vi.mock('../../app/AppChatView',()=>({AppChatView:(props:Parameters<typeof AppChatView>[0])=><div data-testid="actual-chat" data-browser={props.browserOpen ? 'true':'false'} data-floating={props.floating ? 'true':'false'}><textarea key={props.scopeKey} aria-label="Mensaje del chat" /></div>}));
vi.mock('../../components/ProductivityDashboard',()=>({ProductivityDashboard:()=> <div>Tareas visibles</div>}));
vi.mock('../../components/project-hub/UnifiedProjectHub',()=>({UnifiedProjectHub:()=> <div>Tablero del proyecto</div>}));
vi.mock('../../components/artifacts/artifact-viewer-context',()=>({useArtifactViewer:()=>null}));
vi.mock('../../contexts/presentation-workspace-context',()=>({usePresentationWorkspaceContext:()=>({visible:false})}));

function props():Parameters<typeof AppWorkspace>[0] {
  return {activeView:'productivity',userId:'usuario',orgId:'org',chat:{currentConversationId:null,currentMessages:[],conversations:[]},currentConversation:null,folder:{folders:[]},externalPrompt:null,externalSelection:null,userSettings:null,onMessagesChange:vi.fn(),shareLinkNotice:null,liaDegraded:false} as unknown as Parameters<typeof AppWorkspace>[0];
}
beforeEach(()=>{localStorage.clear();vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});});
describe('Integración del chat flotante en la aplicación',()=>{
  it('comparte una creación pendiente entre la entrada sin selección y el botón +',async()=>{
    let finish!:()=>void;
    const base=props(),create=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
    const projectWorkspace={key:'p',canShowChat:true,navigation:{name:'Proyecto',section:'tasks',canCreateChat:true,onBrowserNewChat:create,conversations:[]}} as unknown as NonNullable<typeof base.projectWorkspace>;
    const view=render(<AppWorkspace {...base} activeView="project-hub" unifiedProject={{workspaceId:'w',projectId:'p'}} projectWorkspace={projectWorkspace}/>);
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));await screen.findByRole('textbox');
    view.rerender(<AppWorkspace {...base} activeView="project-hub" unifiedProject={{workspaceId:'w',projectId:'p'}} projectWorkspace={{...projectWorkspace,canShowChat:false}}/>);
    fireEvent.click(screen.getByRole('button',{name:'Preparar chat del proyecto para escribir'}));fireEvent.click(screen.getByRole('button',{name:'Nuevo chat'}));
    expect(create).toHaveBeenCalledOnce();await act(async()=>finish());
  });
  it('permite abrir el compositor en una sección sin sustituirla ni montar otro chat',async()=>{
    render(<AppWorkspace {...props()}/>);
    expect(screen.getByText('Tareas visibles')).toBeVisible();
    expect(screen.queryByTestId('actual-chat')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));
    expect(await screen.findByTestId('actual-chat')).toHaveAttribute('data-floating','true');
    expect(screen.getByTestId('actual-chat')).toHaveAttribute('data-browser','false');
    expect(screen.getByText('Tareas visibles')).toBeVisible();
    expect(screen.getAllByTestId('actual-chat')).toHaveLength(1);
  });
  it('la vista principal conserva su chat y no duplica el flotante',()=>{
    render(<AppWorkspace {...props()} activeView="chat"/>);
    expect(screen.getByTestId('actual-chat')).toHaveAttribute('data-floating','false');
    expect(screen.queryByRole('button',{name:'Abrir chat flotante con Soflia'})).toBeNull();
  });
  it('nuevo chat reinicia el compositor sin usar el manejador que cambia a la vista principal',async()=>{
    const base=props(),create=vi.fn(async()=>null),clearFolder=vi.fn(),navigate=vi.fn();
    render(<AppWorkspace {...base} onNewChat={navigate} chat={{...base.chat,handleNewChat:create}} folder={{...base.folder,setCurrentFolderId:clearFolder}} />);
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));
    fireEvent.change(await screen.findByRole('textbox'),{target:{value:'Borrador anterior'}});
    fireEvent.click(screen.getByRole('button',{name:'Nuevo chat'}));
    await waitFor(()=>expect(create).toHaveBeenCalledOnce());
    await waitFor(()=>expect(screen.getByRole('textbox')).toHaveValue(''));
    expect(clearFolder).toHaveBeenCalledWith(null);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText('Tareas visibles')).toBeVisible();
  });
  it('nuevo chat conserva el ámbito del proyecto',async()=>{
    const base=props(),create=vi.fn(async()=>{}),globalCreate=vi.fn();
    const projectWorkspace={key:'p',canShowChat:true,navigation:{name:'Proyecto',section:'tasks',canCreateChat:true,onBrowserNewChat:create,conversations:[]}} as unknown as NonNullable<typeof base.projectWorkspace>;
    render(<AppWorkspace {...base} activeView="project-hub" unifiedProject={{workspaceId:'w',projectId:'p'}} projectWorkspace={projectWorkspace} chat={{...base.chat,handleNewChat:globalCreate}} />);
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));
    await screen.findByRole('textbox');
    fireEvent.click(screen.getByRole('button',{name:'Nuevo chat'}));
    await waitFor(()=>expect(create).toHaveBeenCalledOnce());
    expect(globalCreate).not.toHaveBeenCalled();
    expect(screen.getByText('Tablero del proyecto')).toBeVisible();
  });
  it('prepara el chat del proyecto antes de habilitar el compositor y conserva el tablero',async()=>{
    const prepare=vi.fn(async()=>{});
    const base=props();
    const projectWorkspace={key:'proyecto-a',canShowChat:false,navigation:{name:'Proyecto A',section:'tasks',canCreateChat:true,onBrowserNewChat:prepare,conversations:[]}} as unknown as NonNullable<typeof base.projectWorkspace>;
    const view=render(<AppWorkspace {...base} activeView="project-hub" unifiedProject={{workspaceId:'w',projectId:'p'}} projectWorkspace={projectWorkspace}/>);
    fireEvent.click(screen.getByRole('button',{name:'Abrir chat flotante con Soflia'}));
    await waitFor(()=>expect(prepare).toHaveBeenCalledOnce());
    expect(screen.queryByTestId('actual-chat')).toBeNull();
    expect(screen.queryByText('Selecciona o crea un chat de este proyecto.')).toBeNull();
    expect(screen.getByRole('button',{name:'Preparar chat del proyecto para escribir'})).toBeVisible();
    view.rerender(<AppWorkspace {...base} activeView="project-hub" unifiedProject={{workspaceId:'w',projectId:'p'}} projectWorkspace={{...projectWorkspace,canShowChat:true}}/>);
    expect(await screen.findByTestId('actual-chat')).toBeVisible();
    expect(screen.getByText('Tablero del proyecto')).toBeVisible();
  });
});
