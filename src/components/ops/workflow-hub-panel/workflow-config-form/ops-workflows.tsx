import type { WorkflowConfigSectionProps } from './types';

export function DriveWorkflowConfig({ draftConfig, inputClass, gchatSpaces, updateConfig }: WorkflowConfigSectionProps) {
  return (
    <div className="space-y-3">
      <input className={inputClass} value={String(draftConfig.projectName || '')} onChange={(event) => updateConfig('projectName', event.target.value)} placeholder="Nombre del proyecto o cliente" />
      <input className={inputClass} value={String(draftConfig.parentFolderId || '')} onChange={(event) => updateConfig('parentFolderId', event.target.value)} placeholder="Carpeta padre opcional" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select className={inputClass} value={String(draftConfig.folderPreset || 'cliente_estandar')} onChange={(event) => updateConfig('folderPreset', event.target.value)}>
          <option value="cliente_estandar">Cliente estandar</option>
          <option value="proyecto_simple">Proyecto simple</option>
          <option value="operacion">Operacion</option>
        </select>
        <select className={inputClass} value={String(draftConfig.gchatSpace || '')} onChange={(event) => updateConfig('gchatSpace', event.target.value)}>
          <option value="">Sin Google Chat</option>
          {gchatSpaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
        </select>
      </div>
    </div>
  );
}

export function TeamUpdateWorkflowConfig({ draftConfig, inputClass, textareaClass, gchatSpaces, updateConfig }: WorkflowConfigSectionProps) {
  return (
    <div className="space-y-3">
      <select className={inputClass} value={String(draftConfig.spaceName || '')} onChange={(event) => updateConfig('spaceName', event.target.value)}>
        <option value="">Selecciona un espacio</option>
        {gchatSpaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
      </select>
      <textarea className={textareaClass} value={String(draftConfig.context || '')} onChange={(event) => updateConfig('context', event.target.value)} placeholder="Contexto para la actualizacion..." />
      <input className={inputClass} value={String(draftConfig.tone || '')} onChange={(event) => updateConfig('tone', event.target.value)} placeholder="Tono" />
    </div>
  );
}

export function PcWorkflowConfig({ draftConfig, inputClass, textareaClass, updateConfig }: WorkflowConfigSectionProps) {
  return (
    <div className="space-y-3">
      <textarea className={textareaClass} value={String(draftConfig.objective || '')} onChange={(event) => updateConfig('objective', event.target.value)} placeholder="Describe la accion operativa..." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select className={inputClass} value={String(draftConfig.backend || 'auto')} onChange={(event) => updateConfig('backend', event.target.value)}>
          <option value="auto">Auto</option>
          <option value="browser">Browser</option>
          <option value="desktop">Desktop visual</option>
          <option value="uia">Windows UIA</option>
        </select>
        <input className={inputClass} value={String(draftConfig.startUrl || '')} onChange={(event) => updateConfig('startUrl', event.target.value)} placeholder="URL inicial opcional" />
      </div>
    </div>
  );
}
