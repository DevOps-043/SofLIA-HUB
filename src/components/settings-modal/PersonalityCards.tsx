import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { TextArea } from '../ui/TextArea';
import SelectDropdown from '../ui/SelectDropdown';
import { EMOJI_OPTIONS, TONE_OPTIONS } from './options';
import type { SettingsFormState } from './types';

export function PersonalityCards({ form }: { form: SettingsFormState }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="flex flex-col">
        <SectionHeader title="Sintonia Basal" subtitle="Tono y personalidad" icon={<VoiceIcon />} />
        <div className="space-y-4 mt-5 flex-1 flex flex-col justify-center">
          <DropdownField label="Registros de Voz" value={form.toneStyle} onChange={form.setToneStyle} options={TONE_OPTIONS} />
          <DropdownField label="Densidad Expresiva" value={form.charEmojis} onChange={form.setCharEmojis} options={EMOJI_OPTIONS} />
        </div>
      </Card>
      <Card>
        <SectionHeader title="Instrucciones" subtitle="Logica de control maestro" icon={<InstructionsIcon />} />
        <div className="mt-5">
          <TextArea
            value={form.customInstructions}
            onChange={(event) => form.setCustomInstructions(event.target.value)}
            placeholder="Ej: 'Prioriza codigo limpio'..."
            rows={4}
          />
          <p className="text-[11px] text-secondary mt-1.5">Sobrescribe comportamientos estandar</p>
        </div>
      </Card>
    </div>
  );
}

function DropdownField(props: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-secondary">{props.label}</label>
      <SelectDropdown value={props.value} onChange={props.onChange} options={props.options} />
    </div>
  );
}

function VoiceIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function InstructionsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
