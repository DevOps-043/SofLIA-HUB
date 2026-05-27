import type { WhatsAppAgentPersonalization } from './types';

interface AgentPersonalizationCardProps {
  allowedNumbers: string[];
  groupProfileJids: string[];
  whitelistEnabled: boolean;
  selectedTarget: string;
  draft: WhatsAppAgentPersonalization;
  onDraftChange: (patch: Partial<WhatsAppAgentPersonalization>) => void;
  onSave: () => void;
  onSelectTarget: (target: string) => void;
}

const toneOptions: Array<{ value: WhatsAppAgentPersonalization['tone']; label: string }> = [
  { value: 'professional', label: 'Profesional' },
  { value: 'warm', label: 'Cercano' },
  { value: 'emotional_support', label: 'Apoyo emocional' },
  { value: 'direct', label: 'Directo' },
  { value: 'custom', label: 'Personalizado' },
];

export function AgentPersonalizationCard(props: AgentPersonalizationCardProps) {
  const profileValue = props.selectedTarget || 'global';

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave();
      }}
      className="bg-white dark:bg-white/3 border border-gray-200 dark:border-white/10 rounded-3xl p-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Personalizacion del Agente</h4>
          <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1">{formatProfileLabel(profileValue)}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={profileValue}
            onChange={(event) => props.onSelectTarget(event.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-[10px] font-mono focus:outline-none focus:border-accent/30 transition-all disabled:opacity-50"
          >
            <option value="global">Global</option>
            {props.whitelistEnabled && props.allowedNumbers.map((number) => (
              <option key={`contact:${number}`} value={`contact:${number}`}>Contacto +{number}</option>
            ))}
            {props.groupProfileJids.map((groupJid) => (
              <option key={`group:${groupJid}`} value={`group:${groupJid}`}>Grupo {groupJid}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
          >
            Guardar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TextField
          label="Nombre"
          value={props.draft.displayName}
          onChange={(displayName) => props.onDraftChange({ displayName })}
          placeholder="SofLIA"
        />
        <TextField
          label="Trato"
          value={props.draft.userAlias}
          onChange={(userAlias) => props.onDraftChange({ userAlias })}
          placeholder="Ej. Fer, Lic., amor"
        />
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">Tono</label>
          <select
            value={props.draft.tone}
            onChange={(event) => props.onDraftChange({ tone: event.target.value as WhatsAppAgentPersonalization['tone'] })}
            className="w-full px-3 py-2.5 bg-gray-50 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-accent/30 transition-all"
          >
            {toneOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <TextareaField
          label="Estilo"
          value={props.draft.responseStyle}
          onChange={(responseStyle) => props.onDraftChange({ responseStyle })}
          placeholder="Responde breve, calido y con pasos concretos."
        />
        <TextareaField
          label="Contexto"
          value={props.draft.context}
          onChange={(context) => props.onDraftChange({ context })}
          placeholder="Informacion estable de esta persona o grupo."
        />
        <TextareaField
          label="Instrucciones"
          value={props.draft.customInstructions}
          onChange={(customInstructions) => props.onDraftChange({ customInstructions })}
          placeholder="Reglas de comportamiento para este perfil."
        />
        <TextareaField
          label="Flujos y acciones"
          value={props.draft.flowInstructions}
          onChange={(flowInstructions) => props.onDraftChange({ flowInstructions })}
          placeholder="Preferencias para automatizaciones activas o pasivas."
        />
      </div>
    </form>
  );
}

function formatProfileLabel(target: string): string {
  if (target.startsWith('contact:')) return `Contacto +${target.slice('contact:'.length)}`;
  if (target.startsWith('group:')) return `Grupo ${target.slice('group:'.length)}`;
  return 'Perfil global';
}

function TextField(props: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">{props.label}</label>
      <input
        type="text"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-accent/30 transition-all"
      />
    </div>
  );
}

function TextareaField(props: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">{props.label}</label>
      <textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        className="w-full h-24 px-3 py-2.5 bg-gray-50 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-accent/30 transition-all resize-none"
      />
    </div>
  );
}
