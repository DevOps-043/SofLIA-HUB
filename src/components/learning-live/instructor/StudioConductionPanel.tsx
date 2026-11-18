import { useStudioRuntime } from './StudioRuntimeContext';

/** Las notas se muestran fuera de las escenas que componen la salida audiovisual. */
export function StudioConductionPanel() {
  const runtime = useStudioRuntime();
  const snapshot = runtime?.snapshot;
  const preparation = snapshot?.state.engine_preparation;
  if (!runtime || !snapshot?.can_manage || !preparation) return null;

  const scenes = new Map(snapshot.state.scenes.map(scene => [scene.id, scene]));
  return <section aria-label="Preparación del instructor" className="studio-prepared-activity">
    <h3>Plan de sesión · {preparation.minutes} min</h3>
    <small>Revisión {snapshot.state.engine_revision}</small>
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
    {preparation.speaker_notes.length > 0 && <details>
      <summary>Notas privadas del ponente</summary>
      {preparation.speaker_notes.map(note => <article key={note.scene_id}>
        <h4>{scenes.get(note.scene_id)?.title || 'Lámina de la preparación'}</h4>
        <p style={{ whiteSpace: 'pre-wrap' }}>{note.content}</p>
      </article>)}
    </details>}
    {preparation.documents && <section aria-label="Documentos de la sesión">
      <h4>Documentos</h4>
      {preparation.documents.map(document => <details key={document.id}>
        <summary>{document.title}{document.applicable ? '' : ' · No aplica'}</summary>
        {!document.applicable ? <p>{document.reason}</p> : <>
          {document.participant_sections.length > 0 && <section aria-label="Contenido para compartir">
            <h5>Visible al compartir</h5>
            {document.participant_sections.map((section, index) =>
              <article key={index}><h5>{section.heading}</h5><p style={{ whiteSpace: 'pre-wrap' }}>{section.body}</p></article>)}
          </section>}
          {document.facilitator_sections.length > 0 && <section aria-label="Contenido reservado">
            <h5>Reservado al instructor</h5>
            {document.facilitator_sections.map((section, index) =>
              <article key={index}><h5>{section.heading}</h5><p style={{ whiteSpace: 'pre-wrap' }}>{section.body}</p></article>)}
          </section>}
          {document.participant_sections.length > 0 && <button
            disabled={runtime.busy}
            onClick={() => void runtime.send({
              type: 'publish_document', document_id: document.id,
              published: !snapshot.published_documents?.some(item => item.id === document.id),
            })}
          >{snapshot.published_documents?.some(item => item.id === document.id) ? 'Retirar del grupo' : 'Compartir con el grupo'} · {document.title}</button>}
        </>}
      </details>)}
    </section>}
  </section>;
}
