import SelectDropdown from '../ui/SelectDropdown';
import { EMOJI_OPTIONS, TONE_OPTIONS } from './options';
import { SectionTitle } from './SectionTitle';
import type { SettingsFormState } from './types';

export function PersonalityCards({ form }: { form: SettingsFormState }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-gray-50/50 dark:bg-white/[0.03] backdrop-blur-md border border-gray-100 dark:border-white/[0.05] rounded-[2rem] p-6 flex flex-col group hover:border-accent/10 transition-all duration-500 shadow-xl shadow-black/5 dark:shadow-black/10 relative overflow-visible z-20">
        <DecorativeIcon icon={<VoiceIcon large />} />
        <SectionTitle title="Sintonia Basal" subtitle="Tono y personalidad" muted icon={<VoiceIcon />} />
        <div className="space-y-4 flex-1 flex flex-col justify-center relative z-10">
          <DropdownField label="Registros de Voz" value={form.toneStyle} onChange={form.setToneStyle} options={TONE_OPTIONS} />
          <DropdownField label="Densidad Expresiva" value={form.charEmojis} onChange={form.setCharEmojis} options={EMOJI_OPTIONS} />
        </div>
      </div>
      <div className="bg-gray-50/50 dark:bg-white/[0.03] backdrop-blur-md border border-gray-100 dark:border-white/[0.05] rounded-[2rem] p-6 relative group overflow-visible hover:border-accent/10 transition-all duration-500 shadow-xl shadow-black/5 dark:shadow-black/10">
        <DecorativeIcon icon={<InstructionsIcon large />} />
        <SectionTitle title="Instrucciones" subtitle="Logica de control maestro" icon={<InstructionsIcon />} />
        <div className="space-y-1.5 relative z-10">
          <textarea
            value={form.customInstructions}
            onChange={(event) => form.setCustomInstructions(event.target.value)}
            placeholder="Ej: 'Prioriza codigo limpio'..."
            className="w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/[0.03] rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:border-accent/20 dark:focus:border-accent/20 focus:bg-white dark:focus:bg-black/40 transition-all placeholder-gray-400 dark:placeholder-gray-700 resize-none h-24 no-scrollbar"
          />
          <p className="text-[7px] text-gray-600 font-medium uppercase tracking-widest mt-1 px-1">Sobrescribe comportamientos estandar</p>
        </div>
      </div>
    </div>
  );
}

function DropdownField(props: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest px-1 ml-1 flex items-center gap-2">{props.label}</label>
      <SelectDropdown value={props.value} onChange={props.onChange} options={props.options} />
    </div>
  );
}

function DecorativeIcon({ icon }: { icon: JSX.Element }) {
  return <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">{icon}</div>;
}

function VoiceIcon({ large = false }: { large?: boolean }) {
  return (
    <svg className={large ? 'w-32 h-32 text-accent' : 'w-4 h-4 text-gray-500 group-hover:text-accent/60 transition-colors'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={large ? 0.5 : 2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function InstructionsIcon({ large = false }: { large?: boolean }) {
  return (
    <svg className={large ? 'w-32 h-32 text-accent' : 'w-4 h-4 text-accent/60'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={large ? 0.5 : 2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
