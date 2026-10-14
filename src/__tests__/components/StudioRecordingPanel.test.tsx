import { render,screen,waitFor } from '@testing-library/react';
import { describe,it,expect,vi,beforeEach } from 'vitest';
import { StudioRecordingPanel } from '../../components/learning-live/instructor/StudioRecordingPanel';
import { studioOperation } from '../../services/live-studio-service';
import { StudioRuntimeContext, type StudioRuntime } from '../../components/learning-live/instructor/StudioRuntimeContext';
vi.mock('../../services/live-studio-service',()=>({studioOperation:vi.fn(),onStudioInvalidation:()=>()=>{}}));
const reference={organization_slug:'acme',session_id:'00000000-0000-4000-8000-000000000031'};
const data={version:1 as const,session_id:reference.session_id,user_id:'00000000-0000-4000-8000-000000000011',required:true as const,availability:'available' as const,requested:false,revision:0,can_manage:false,runs:[{id:'00000000-0000-4000-8000-000000000041',status:'recording' as const,coverage:'unknown' as const,published:false,publication_revision:0,created_at:'2026-10-13T18:00:00Z',duration_seconds:0,segments:0}]};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(studioOperation).mockResolvedValue({success:true,recording_snapshot:data});});
describe('Estado visible de grabación',()=>{
 it.each([false,true])('no ofrece preferencias ni envía intención de publicación con gestión %s',async(canManage)=>{
  vi.mocked(studioOperation).mockResolvedValue({success:true,recording_snapshot:{...data,can_manage:canManage,requested:true}});
  const runtime={snapshot:{can_manage:canManage}} as StudioRuntime;
  render(<StudioRuntimeContext.Provider value={runtime}><StudioRecordingPanel reference={reference} sdkStatus="Recording"/></StudioRuntimeContext.Provider>);
  await waitFor(()=>expect(studioOperation).toHaveBeenCalled());
  expect(screen.getByRole('status')).toHaveTextContent('Grabando');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByText(/Permitir ver después|Permitir grabar|Zoom/)).not.toBeInTheDocument();
  expect(vi.mocked(studioOperation).mock.calls.every(([,operation])=>operation.type==='recordings'&&operation.operation.type==='snapshot')).toBe(true);
 });
 it('una pausa observada prevalece sobre un callback anterior de inicio',async()=>{
  render(<StudioRecordingPanel reference={reference} sdkStatus="Paused"/>);
  await waitFor(()=>expect(studioOperation).toHaveBeenCalled());
  expect(screen.getByRole('status')).toHaveTextContent('Grabación interrumpida');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 });
 it('no inventa grabación antes de recibir evidencia del proveedor',()=>{
  vi.mocked(studioOperation).mockReturnValue(new Promise(()=>{}));
  render(<StudioRecordingPanel reference={reference} sdkStatus="unknown"/>);
  expect(screen.getByRole('status')).toHaveTextContent('Esperando confirmación de grabación');
 });
 it('un archivo confirmado se muestra guardado tras parar la captura',async()=>{
  vi.mocked(studioOperation).mockResolvedValue({success:true,recording_snapshot:{...data,runs:[{...data.runs[0],status:'ready'}]}});
  render(<StudioRecordingPanel reference={reference} sdkStatus="Stopped"/>);
  expect(await screen.findByText('Guardada en Soflia')).toBeInTheDocument();
 });
});
