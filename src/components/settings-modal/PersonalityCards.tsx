import { HubGlyph } from '../ui/HubGlyph';
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
    <HubGlyph name="voice" size={21} />
  );
}

function InstructionsIcon() {
  return (
    <HubGlyph name="files" size={21} />
  );
}
