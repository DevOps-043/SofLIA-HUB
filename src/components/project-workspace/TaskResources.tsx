import { taskResourceTypes, type TaskResource } from '../../shared/task-workflow';
import { safeWebUrl } from '../../services/project-web-url';
import { Button } from '../ui/Button';
import SelectDropdown from '../ui/SelectDropdown';
import { ProjectGlyph } from './ProjectGlyph';

export function TaskResources({ value, onChange, disabled, legacy, onOpenWeb }: {
  value: TaskResource[]; onChange(value: TaskResource[]): void; disabled: boolean; legacy: boolean; onOpenWeb?(url: string): void;
}) {
  const update = (index: number, change: Partial<TaskResource>) => onChange(value.map((item, i) => i === index ? { ...item, ...change } : item));
  return <section className="task-editor-resources" aria-label="Recursos vinculados">
    <div className="task-editor-section-heading"><div><h3><ProjectGlyph name="files" size={17} />Recursos vinculados <span>{value.length}</span></h3><p>Fotos, documentos, páginas y chats del equipo, a un clic.</p></div></div>
    {legacy && <p role="status" className="task-editor-hint">Esta tarea contiene vínculos de un formato anterior. Se conservarán al guardar; su edición no está disponible aquí.</p>}
    {!value.length && <div className="task-resources-empty"><ProjectGlyph name="folder" size={28} /><div><strong>Todo el contexto en un lugar</strong><p>Vincula una foto, un documento o la conversación del equipo.</p></div></div>}
    <div className="task-resource-rows">{value.map((item, index) => {
      const url = safeWebUrl(item.url);
      return <div className="task-resource-row" key={index}>
        <div className="task-resource-row-top"><SelectDropdown aria-label={`Tipo del recurso ${index + 1}`} value={item.type} onChange={type => update(index, { type: type as TaskResource['type'] })} options={[...taskResourceTypes]} disabled={disabled || legacy} size="compact" />{!disabled && !legacy && <button type="button" className="task-remove-resource" aria-label={`Quitar recurso ${index + 1}`} onClick={() => onChange(value.filter((_, i) => i !== index))}>×</button>}</div>
        <label>Nombre<input aria-label={`Nombre del recurso ${index + 1}`} required maxLength={255} value={item.name} placeholder="Ej. Referencias de diseño" disabled={disabled || legacy} onChange={event => update(index, { name: event.target.value })} /></label>
        <label>Enlace<input aria-label={`Enlace del recurso ${index + 1}`} type="url" required maxLength={4000} value={item.url} placeholder={item.type === 'team_chat' ? 'https://… enlace a la conversación' : 'https://…'} disabled={disabled || legacy} onChange={event => update(index, { url: event.target.value })} /></label>
        {url && onOpenWeb && <Button type="button" size="sm" variant="ghost" onClick={() => onOpenWeb(url)}>Abrir vínculo</Button>}
      </div>;
    })}</div>
    {!disabled && !legacy && <Button type="button" variant="secondary" size="sm" disabled={value.length >= 50} onClick={() => onChange([...value, { type: 'document', name: '', url: '' }])}><ProjectGlyph name="plus" size={15} />Añadir vínculo</Button>}
    <p className="task-editor-hint">Añade la URL del archivo o del chat. Se conserva el original y sus permisos de acceso.</p>
  </section>;
}
