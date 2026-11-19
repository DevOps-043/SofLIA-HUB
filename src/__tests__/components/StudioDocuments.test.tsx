import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudioConductionPanel } from '../../components/learning-live/instructor/StudioConductionPanel';
import { ParticipantActivities } from '../../components/learning-live/participant/ParticipantActivities';
import { StudioRuntimeContext, type StudioRuntime } from '../../components/learning-live/instructor/StudioRuntimeContext';
import { emptyStudioState } from '../../shared/live-studio-domain';

function runtime(canManage: boolean): StudioRuntime {
  const state = emptyStudioState();
  state.engine_preparation = {
    minutes: 60, blocks: [{id:'block',purpose:'Aplicar',minutes:60,explanation:'Explicación',activity:'Caso',criteria:['Justifica'],practice_ids:[]}], speaker_notes: [],
    documents: [{id:'document',kind:'assessment',title:'Instrumento',applicable:true,reason:'',block_ids:['block'],source_refs:[],
      participant_sections:[{heading:'Consigna',body:'Contenido público'}],
      facilitator_sections:[{heading:'Respuesta esperada',body:'SOLUCION_RESERVADA'}]}],
  };
  return {
    snapshot:{session_id:'session',user_id:'user',title:'Clase',can_manage:canManage,server_time:'2026-11-17T18:00:00Z',state,asset_urls:{},published_documents:[]},
    busy:false,realtime:'',error:'',send:vi.fn().mockResolvedValue(true),upload:vi.fn(),refresh:vi.fn(),
  };
}
describe('documentos de sesión en Hub',()=>{
  it('el instructor consulta las dos audiencias y publica por identificador',()=>{
    const value=runtime(true);
    render(<StudioRuntimeContext.Provider value={value}><StudioConductionPanel /></StudioRuntimeContext.Provider>);
    expect(screen.getByText('SOLUCION_RESERVADA')).toBeInTheDocument();
    expect(screen.getByRole('region',{name:'Contenido reservado'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Compartir con el grupo · Instrumento'}));
    expect(value.send).toHaveBeenCalledWith({type:'publish_document',document_id:'document',published:true});
  });
  it('el instructor puede retirar un documento publicado',()=>{
    const value=runtime(true);
    value.snapshot.published_documents=[{id:'document',kind:'assessment',title:'Instrumento',sections:[{heading:'Consigna',body:'Contenido público'}]}];
    render(<StudioRuntimeContext.Provider value={value}><StudioConductionPanel /></StudioRuntimeContext.Provider>);
    fireEvent.click(screen.getByRole('button',{name:'Retirar del grupo · Instrumento'}));
    expect(value.send).toHaveBeenCalledWith({type:'publish_document',document_id:'document',published:false});
  });
  it('el participante representa solo el documento publicado',()=>{
    const value=runtime(false);
    value.snapshot.published_documents=[{id:'document',kind:'assessment',title:'Instrumento',sections:[{heading:'Consigna',body:'Contenido público'}]}];
    render(<StudioRuntimeContext.Provider value={value}><ParticipantActivities onPractice={vi.fn()} /></StudioRuntimeContext.Provider>);
    fireEvent.click(screen.getByRole('tab',{name:/Materiales/}));
    expect(screen.getByText('Contenido público')).toBeInTheDocument();
    expect(screen.queryByText('SOLUCION_RESERVADA')).not.toBeInTheDocument();
  });
  it('distingue la publicación efectiva y bloquea acciones mientras se guarda',()=>{
    const value=runtime(true);
    value.busy=true;
    value.snapshot.published_documents=[{id:'document',kind:'assessment',title:'Instrumento',sections:[{heading:'Consigna',body:'Contenido público'}]}];
    render(<StudioRuntimeContext.Provider value={value}><StudioConductionPanel /></StudioRuntimeContext.Provider>);
    expect(screen.getByText('Compartido con el grupo')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Retirar del grupo · Instrumento'})).toBeDisabled();
  });
  it('explica un documento no aplicable sin ofrecer publicarlo',()=>{
    const value=runtime(true);
    value.snapshot.state.engine_preparation!.documents=[{id:'followup',kind:'follow_up',title:'Refuerzo',applicable:false,reason:'Se realiza en Learning',block_ids:[],source_refs:[],participant_sections:[],facilitator_sections:[]}];
    render(<StudioRuntimeContext.Provider value={value}><StudioConductionPanel /></StudioRuntimeContext.Provider>);
    expect(screen.getByText('No aplica')).toBeInTheDocument();
    expect(screen.getByText('Se realiza en Learning')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/Compartir con el grupo/})).not.toBeInTheDocument();
  });
});
