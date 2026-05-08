import type { SettingsFormState } from './types';
import { SectionTitle } from './SectionTitle';

export function IdentityCard({ form }: { form: SettingsFormState }) {
  return (
    <div className="bg-white/[0.03] backdrop-blur-md border border-white/[0.05] rounded-[2rem] p-6 relative overflow-visible group hover:border-accent/10 transition-all duration-500 shadow-xl shadow-black/10">
      <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
        <svg className="w-32 h-32 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
      <SectionTitle title="Contexto de Identidad" subtitle="Quien eres para tu IA" icon={<UserIcon />} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 relative z-10">
        <TextField label="Seudonimo / Apodo" value={form.nickname} onChange={form.setNickname} placeholder="Fer" />
        <TextField label="Especialidad / Rol" value={form.occupation} onChange={form.setOccupation} placeholder="CEO / CTO" />
      </div>
      <div className="space-y-1.5 relative z-10">
        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest px-1 ml-1 flex items-center gap-2">
          Memorias y Experiencias
        </label>
        <textarea
          value={form.aboutUser}
          onChange={(event) => form.setAboutUser(event.target.value)}
          placeholder="Informacion relevante para tu contexto..."
          className="w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/[0.03] rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:border-accent/20 dark:focus:border-accent/20 focus:bg-white dark:focus:bg-black/40 transition-all placeholder-gray-400 dark:placeholder-gray-700 resize-none h-24 no-scrollbar"
        />
        <p className="text-[7px] text-gray-600 font-medium uppercase tracking-widest mt-1 px-1 text-right">Persistencia de contexto activa</p>
      </div>
    </div>
  );
}

function TextField(props: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest px-1 ml-1 flex items-center gap-2">{props.label}</label>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/[0.03] rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:border-accent/20 dark:focus:border-accent/20 focus:bg-white dark:focus:bg-black/40 transition-all placeholder-gray-400 dark:placeholder-gray-700"
      />
    </div>
  );
}

function UserIcon() {
  return (
    <svg className="w-4 h-4 text-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
