import { describe, expect, it } from 'vitest';
import { engineSessionManifestSchema, engineSessionTemplateSchema } from '../../shared/engine-preparation.contract';
import { ENGINE_DOCUMENT_LABELS } from '../../shared/engine-session-documents.contract';

const practiceId = '00000000-0000-4000-8000-000000000001';
const practice = { id: practiceId, title: 'Practicar', instructions: 'Resolver en equipo' };
const content = { scenes: [], materials: [], quizzes: [], practices: [practice] };
const preparation = {
  minutes: 15,
  blocks: [{
    id: 'practice',
    purpose: 'Aplicar',
    minutes: 15,
    explanation: 'Explicar el ejercicio',
    activity: 'Completar el ejercicio',
    criteria: ['Entregar la respuesta'],
    practice_ids: [practiceId],
  }],
  speaker_notes: [],
  documents: Object.entries(ENGINE_DOCUMENT_LABELS).map(([kind, title]) => ({
    id: kind,
    kind,
    title,
    applicable: true,
    reason: '',
    block_ids: ['practice'],
    source_refs: [],
    participant_sections: [],
    facilitator_sections: [{ heading: 'Actividad', body: 'Guiar el ejercicio' }],
  })),
};

describe('contratos de taller híbrido y aula programada', () => {
  it('valida la preparación híbrida con documentos y referencias internas', () => {
    expect(engineSessionTemplateSchema.safeParse({ ...content, preparation }).success).toBe(true);
    expect(engineSessionTemplateSchema.safeParse({
      ...content, preparation: { ...preparation, documents: undefined },
    }).success).toBe(false);
    expect(engineSessionTemplateSchema.safeParse({
      ...content, practices: [], preparation,
    }).success).toBe(false);
  });

  it('conserva las prácticas colaborativas de las sesiones programadas', () => {
    const collaboration = { mode: 'teams', team_size: 4 };
    const practices = [{ ...practice, collaboration }];
    const manifest = engineSessionManifestSchema.parse({
      ...content,
      version: 1,
      course_id: practiceId,
      revision: 'test',
      practices,
    });

    expect(manifest.practices).toEqual(practices);
    expect(engineSessionTemplateSchema.safeParse({ ...content, practices, preparation }).success).toBe(false);
  });
});
