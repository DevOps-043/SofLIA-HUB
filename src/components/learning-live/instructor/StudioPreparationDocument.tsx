import type { EngineSessionDocument } from '../../../shared/engine-session-documents.contract';
import { LiveIcon } from '../LiveIcon';

export function StudioPreparationDocument({ document, published, busy, onPublish }: {
  document: EngineSessionDocument;
  published: boolean;
  busy: boolean;
  onPublish: () => void;
}) {
  const shareable = document.applicable && document.participant_sections.length > 0;
  return <details className="studio-preparation-document">
    <summary>
      <LiveIcon name="file" />
      <span>{document.title}<small>{!document.applicable ? 'No aplica' : published ? 'Compartido con el grupo' : shareable ? 'Sin compartir' : 'Solo instructor'}</small></span>
      <LiveIcon name="chevron" className="studio-preparation-chevron" />
    </summary>
    <div className="studio-preparation-document-body">
      {!document.applicable ? <p>{document.reason}</p> : <>
        {shareable && <section aria-label="Contenido para compartir" className="studio-preparation-audience">
          <h5><LiveIcon name="users" />Visible al compartir</h5>
          {document.participant_sections.map((section, index) =>
            <article key={index}><h6>{section.heading}</h6><p>{section.body}</p></article>)}
        </section>}
        {document.facilitator_sections.length > 0 && <section aria-label="Contenido reservado" className="studio-preparation-audience is-private">
          <h5><LiveIcon name="lock" />Reservado al instructor</h5>
          {document.facilitator_sections.map((section, index) =>
            <article key={index}><h6>{section.heading}</h6><p>{section.body}</p></article>)}
        </section>}
        {shareable && <button type="button" className="studio-preparation-publish" disabled={busy}
          aria-label={`${published ? 'Retirar del grupo' : 'Compartir con el grupo'} · ${document.title}`}
          onClick={onPublish}>
          <LiveIcon name={published ? 'close' : 'users'} />{published ? 'Retirar del grupo' : 'Compartir con el grupo'}
        </button>}
      </>}
    </div>
  </details>;
}
