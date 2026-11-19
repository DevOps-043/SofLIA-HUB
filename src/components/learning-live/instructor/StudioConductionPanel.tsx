import { useStudioRuntime } from './StudioRuntimeContext';
import { LiveIcon } from '../LiveIcon';
import { StudioPreparationDocument } from './StudioPreparationDocument';
import './studio-preparation.css';

/** Las notas se muestran fuera de las escenas que componen la salida audiovisual. */
export function StudioConductionPanel() {
  const runtime = useStudioRuntime();
  const snapshot = runtime?.snapshot;
  const preparation = snapshot?.state.engine_preparation;
  if (!runtime || !snapshot?.can_manage || !preparation) return null;

  const scenes = new Map(snapshot.state.scenes.map(scene => [scene.id, scene]));
  return <section aria-label="Preparación del instructor" className="studio-preparation">
    <header className="studio-preparation-heading">
      <span className="studio-tool-icon"><LiveIcon name="book" /></span>
      <div><h3>Preparación de la sesión</h3><p>{preparation.blocks.length} {preparation.blocks.length === 1 ? 'bloque' : 'bloques'} · {preparation.minutes} min</p></div>
    </header>
    <p className="studio-preparation-revision">Revisión {snapshot.state.engine_revision}</p>
    <details className="studio-preparation-outline">
      <summary>Plan de sesión · {preparation.minutes} min<LiveIcon name="chevron" className="studio-preparation-chevron" /></summary>
      <ol>
      {preparation.blocks.map(block => <li key={block.id}>
        <details>
          <summary>{block.purpose} · {block.minutes} min</summary>
          <p>{block.explanation}</p>
          <p>{block.activity}</p>
          <ul>{block.criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul>
        </details>
      </li>)}
      </ol>
    </details>
    {preparation.speaker_notes.length > 0 && <details className="studio-preparation-outline">
      <summary><span><LiveIcon name="lock" />Notas privadas del ponente</span><LiveIcon name="chevron" className="studio-preparation-chevron" /></summary>
      <div className="studio-preparation-notes">
      <p className="studio-preparation-hint">Disponibles solo para instructores autorizados.</p>
      {preparation.speaker_notes.map(note => <article key={note.scene_id}>
        <h4>{scenes.get(note.scene_id)?.title || 'Lámina de la preparación'}</h4>
        <p>{note.content}</p>
      </article>)}
      </div>
    </details>}
    {preparation.documents && <section aria-label="Documentos de la sesión">
      <div className="studio-preparation-caption"><h4>Documentos</h4><span>{preparation.documents.filter(document => document.applicable).length} disponibles</span></div>
      <p className="studio-preparation-hint">Revisa el contenido antes de compartirlo con el grupo.</p>
      {preparation.documents.map(document => <StudioPreparationDocument key={document.id} document={document}
        published={Boolean(snapshot.published_documents?.some(item => item.id === document.id))} busy={runtime.busy}
        onPublish={() => void runtime.send({ type: 'publish_document', document_id: document.id,
          published: !snapshot.published_documents?.some(item => item.id === document.id) })} />)}
    </section>}
  </section>;
}
