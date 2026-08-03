import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { TextArea } from '../ui/TextArea';
import SelectDropdown from '../ui/SelectDropdown';
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

const toneOptions: Array<{ value: string; label: string }> = [
  { value: 'professional', label: 'Profesional' },
  { value: 'warm', label: 'Cercano' },
  { value: 'emotional_support', label: 'Apoyo emocional' },
  { value: 'direct', label: 'Directo' },
  { value: 'custom', label: 'Personalizado' },
];

export function AgentPersonalizationCard(props: AgentPersonalizationCardProps) {
  const profileValue = props.selectedTarget || 'global';

  const profileOptions = [
    { value: 'global', label: 'Global' },
    ...(props.whitelistEnabled ? props.allowedNumbers.map((number) => ({ value: `contact:${number}`, label: `Contacto +${number}` })) : []),
    ...props.groupProfileJids.map((groupJid) => ({ value: `group:${groupJid}`, label: `Grupo ${groupJid}` })),
  ];

  return (
    <Card padded={false}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          props.onSave();
        }}
        className="p-6"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Personalizacion del Agente</h3>
            <p className="text-xs text-secondary mt-0.5">{formatProfileLabel(profileValue)}</p>
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-[160px]">
              <SelectDropdown value={profileValue} onChange={props.onSelectTarget} options={profileOptions} size="compact" />
            </div>
            <Button type="submit" variant="primary" size="sm">
              Guardar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TextField
            label="Nombre"
            value={props.draft.displayName}
            onChange={(event) => props.onDraftChange({ displayName: event.target.value })}
            placeholder="Pulse"
          />
          <TextField
            label="Trato"
            value={props.draft.userAlias}
            onChange={(event) => props.onDraftChange({ userAlias: event.target.value })}
            placeholder="Ej. Fer, Lic., amor"
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-secondary">Tono</label>
            <SelectDropdown
              value={props.draft.tone}
              onChange={(tone) => props.onDraftChange({ tone: tone as WhatsAppAgentPersonalization['tone'] })}
              options={toneOptions}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <TextArea label="Estilo" value={props.draft.responseStyle} onChange={(e) => props.onDraftChange({ responseStyle: e.target.value })} placeholder="Responde breve, calido y con pasos concretos." />
          <TextArea label="Contexto" value={props.draft.context} onChange={(e) => props.onDraftChange({ context: e.target.value })} placeholder="Informacion estable de esta persona o grupo." />
          <TextArea label="Instrucciones" value={props.draft.customInstructions} onChange={(e) => props.onDraftChange({ customInstructions: e.target.value })} placeholder="Reglas de comportamiento para este perfil." />
          <TextArea label="Flujos y acciones" value={props.draft.flowInstructions} onChange={(e) => props.onDraftChange({ flowInstructions: e.target.value })} placeholder="Preferencias para automatizaciones activas o pasivas." />
        </div>
      </form>
    </Card>
  );
}

function formatProfileLabel(target: string): string {
  if (target.startsWith('contact:')) return `Contacto +${target.slice('contact:'.length)}`;
  if (target.startsWith('group:')) return `Grupo ${target.slice('group:'.length)}`;
  return 'Perfil global';
}
