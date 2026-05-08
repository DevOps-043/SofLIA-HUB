import type { WorkflowConfigSectionProps } from './types';

export function CorreoWorkflowConfig({ draftConfig, inputClass, gchatSpaces, updateConfig }: WorkflowConfigSectionProps) {
  const preset = String(draftConfig.preset || 'unread');
  return (
    <div className="space-y-3">
      <select className={inputClass} value={preset} onChange={(event) => updateConfig('preset', event.target.value)}>
        <option value="unread">Correos pendientes</option>
        <option value="today">Correos de hoy</option>
        <option value="priority">Correos importantes</option>
        <option value="custom">Filtro personalizado</option>
      </select>
      {preset === 'custom' && (
        <input className={inputClass} value={String(draftConfig.query || '')} onChange={(event) => updateConfig('query', event.target.value)} placeholder="from:cliente@empresa.com newer_than:7d" />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className={inputClass} type="number" min={1} max={10} value={Number(draftConfig.maxResults || 5)} onChange={(event) => updateConfig('maxResults', Math.max(1, Math.min(10, Number(event.target.value) || 1)))} />
        <select className={inputClass} value={String(draftConfig.gchatSpace || '')} onChange={(event) => updateConfig('gchatSpace', event.target.value)}>
          <option value="">Sin Google Chat</option>
          {gchatSpaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
        </select>
      </div>
    </div>
  );
}

export function AgendaWorkflowConfig({ draftConfig, inputClass, gchatSpaces, updateConfig }: WorkflowConfigSectionProps) {
  return (
    <div className="space-y-3">
      <input className={inputClass} type="date" value={String(draftConfig.targetDate || '')} onChange={(event) => updateConfig('targetDate', event.target.value)} />
      <select className={inputClass} value={String(draftConfig.gchatSpace || '')} onChange={(event) => updateConfig('gchatSpace', event.target.value)}>
        <option value="">Sin Google Chat</option>
        {gchatSpaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
      </select>
    </div>
  );
}

export function SeguimientoWorkflowConfig({ draftConfig, inputClass, textareaClass, updateConfig }: WorkflowConfigSectionProps) {
  return (
    <div className="space-y-3">
      <input className={inputClass} value={String(draftConfig.to || '')} onChange={(event) => updateConfig('to', event.target.value)} placeholder="correo@empresa.com" />
      <input className={inputClass} value={String(draftConfig.topic || '')} onChange={(event) => updateConfig('topic', event.target.value)} placeholder="Tema del seguimiento" />
      <textarea className={textareaClass} value={String(draftConfig.context || '')} onChange={(event) => updateConfig('context', event.target.value)} placeholder="Contexto base..." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className={inputClass} value={String(draftConfig.tone || '')} onChange={(event) => updateConfig('tone', event.target.value)} placeholder="Tono" />
        <input className={inputClass} value={String(draftConfig.signature || '')} onChange={(event) => updateConfig('signature', event.target.value)} placeholder="Firma" />
      </div>
    </div>
  );
}
