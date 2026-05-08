import type { WorkflowConfigSectionProps } from './types';

export function MeetingWorkflowConfig({
  draftConfig,
  inputClass,
  textareaClass,
  gchatSpaces,
  teams,
  getProjectsForTeam,
  updateConfig,
}: WorkflowConfigSectionProps) {
  const mode = String(draftConfig.mode || 'manual');
  return (
    <div className="space-y-3">
      <select className={inputClass} value={mode} onChange={(event) => updateConfig('mode', event.target.value)}>
        <option value="manual">Notas o transcripcion</option>
        <option value="drive">Google Drive</option>
        <option value="prep">Preparacion previa</option>
        <option value="auto">Deteccion automatica</option>
      </select>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className={inputClass} value={String(draftConfig.meetingTitle || '')} onChange={(event) => updateConfig('meetingTitle', event.target.value)} placeholder="Titulo de la reunion" />
        <input className={inputClass} value={String(draftConfig.meetingType || '')} onChange={(event) => updateConfig('meetingType', event.target.value)} placeholder="Tipo" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select className={inputClass} value={String(draftConfig.defaultTeamId || '')} onChange={(event) => { updateConfig('defaultTeamId', event.target.value); updateConfig('defaultProjectId', ''); }}>
          <option value="">Sin team</option>
          {teams.map((team) => <option key={team.team_id} value={team.team_id}>{team.name}</option>)}
        </select>
        <select className={inputClass} value={String(draftConfig.defaultProjectId || '')} onChange={(event) => updateConfig('defaultProjectId', event.target.value)}>
          <option value="">Sin proyecto</option>
          {getProjectsForTeam(String(draftConfig.defaultTeamId || '')).map((project) => <option key={project.project_id} value={project.project_id}>{project.project_name}</option>)}
        </select>
      </div>
      {mode === 'prep' && (
        <>
          <input className={inputClass} type="date" value={String(draftConfig.targetDate || '')} onChange={(event) => updateConfig('targetDate', event.target.value)} />
          <select className={inputClass} value={String(draftConfig.gchatSpace || '')} onChange={(event) => updateConfig('gchatSpace', event.target.value)}>
            <option value="">Sin Google Chat</option>
            {gchatSpaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
          </select>
        </>
      )}
      {mode === 'manual' && <textarea className={textareaClass} value={String(draftConfig.manualText || '')} onChange={(event) => updateConfig('manualText', event.target.value)} placeholder="Pega aqui las notas, tareas y decisiones..." />}
      {mode === 'drive' && <input className={inputClass} value={String(draftConfig.driveRef || '')} onChange={(event) => updateConfig('driveRef', event.target.value)} placeholder="Link o ID de Google Drive" />}
      {mode === 'auto' && <div className="rounded-xl border border-dashed border-accent/20 bg-accent/5 px-4 py-3 text-xs text-accent">La deteccion automatica corre en segundo plano. Aqui puedes revisar sus capacidades y casos detectados.</div>}
    </div>
  );
}
