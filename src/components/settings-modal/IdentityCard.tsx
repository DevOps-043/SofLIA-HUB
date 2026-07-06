import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { TextField } from '../ui/TextField';
import { TextArea } from '../ui/TextArea';
import type { SettingsFormState } from './types';

export function IdentityCard({ form }: { form: SettingsFormState }) {
  return (
    <Card>
      <SectionHeader title="Contexto de Identidad" subtitle="Quien eres para tu IA" icon={<UserIcon />} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 mb-4">
        <TextField label="Seudonimo / Apodo" value={form.nickname} onChange={(e) => form.setNickname(e.target.value)} placeholder="Fer" />
        <TextField label="Especialidad / Rol" value={form.occupation} onChange={(e) => form.setOccupation(e.target.value)} placeholder="CEO / CTO" />
      </div>
      <TextArea
        label="Memorias y Experiencias"
        value={form.aboutUser}
        onChange={(event) => form.setAboutUser(event.target.value)}
        placeholder="Informacion relevante para tu contexto..."
        rows={4}
      />
      <p className="text-[11px] text-secondary mt-1.5 text-right">Persistencia de contexto activa</p>
    </Card>
  );
}

function UserIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
