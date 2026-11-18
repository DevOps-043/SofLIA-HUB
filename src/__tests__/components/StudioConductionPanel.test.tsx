import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudioConductionPanel } from '../../components/learning-live/instructor/StudioConductionPanel';
import { StudioRuntimeContext, type StudioRuntime } from '../../components/learning-live/instructor/StudioRuntimeContext';
import { emptyStudioState } from '../../shared/live-studio-domain';

function runtime(canManage: boolean): StudioRuntime {
  const state = emptyStudioState();
  state.engine_revision = 'engine:curso:sesion:4';
  state.engine_preparation = {
    minutes: 60,
    blocks: [{ id: 'caso', purpose: 'Aplicar', minutes: 60, explanation: 'Explicación reservada', activity: 'Resuelve', criteria: ['Justifica'], practice_ids: [] }],
    speaker_notes: [{ scene_id: 'lamina', content: 'Nota reservada del ponente' }],
  };
  return {
    snapshot: { session_id: 'sesion', user_id: 'usuario', title: 'Clase', can_manage: canManage, server_time: '2026-11-17T18:00:00Z', state, asset_urls: {} },
    busy: false, realtime: '', error: '', send: vi.fn(), upload: vi.fn(), refresh: vi.fn(),
  };
}
describe('preparación privada del instructor', () => {
  it('presenta revisión, bloques y notas fuera del escenario', () => {
    render(<StudioRuntimeContext.Provider value={runtime(true)}><StudioConductionPanel /></StudioRuntimeContext.Provider>);
    expect(screen.getByRole('region', { name: 'Preparación del instructor' })).toHaveTextContent('Aplicar · 60 min');
    expect(screen.getByText('Revisión engine:curso:sesion:4')).toBeInTheDocument();
    expect(screen.getByText('Nota reservada del ponente')).toBeInTheDocument();
  });
  it('oculta el panel al alumno incluso ante una respuesta con notas', () => {
    const { container } = render(<StudioRuntimeContext.Provider value={runtime(false)}><StudioConductionPanel /></StudioRuntimeContext.Provider>);
    expect(container).toBeEmptyDOMElement();
  });
  it('mantiene el aula anterior cuando no hay preparación', () => {
    const value = runtime(true);
    delete value.snapshot.state.engine_preparation;
    const { container } = render(<StudioRuntimeContext.Provider value={value}><StudioConductionPanel /></StudioRuntimeContext.Provider>);
    expect(container).toBeEmptyDOMElement();
  });
});
