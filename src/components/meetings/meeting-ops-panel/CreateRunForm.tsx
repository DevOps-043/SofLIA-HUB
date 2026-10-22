import type React from 'react';
import type { CreateMode } from './types';

type MeetingCreateForm = {
  driveRef: string;
  manualText: string;
  meetingTitle: string;
  meetingType: string;
};

type CreateRunFormProps = {
  form: MeetingCreateForm;
  handleCreateRun: () => Promise<void>;
  inputClass: string;
  loading: boolean;
  mode: CreateMode;
  setForm: React.Dispatch<React.SetStateAction<MeetingCreateForm>>;
  setMode: React.Dispatch<React.SetStateAction<CreateMode>>;
};

export function CreateRunForm(props: CreateRunFormProps) {
  const { form, inputClass, mode } = props;
  return (
    <section className="px-6 pt-2 pb-5">
      <div className="max-w-xl">
        <div className="flex rounded-lg bg-gray-100 dark:bg-white/[0.03] p-0.5 mb-4">
          {(['manual', 'drive'] as const).map((m) => (
            <button key={m} type="button" className={`flex-1 py-1.5 rounded-md text-[12px] font-medium transition ${mode === m ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} onClick={() => props.setMode(m)}>
              {m === 'manual' ? 'Notas manuales' : 'Google Drive'}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg space-y-3">
          <input className={inputClass} value={form.meetingTitle} onChange={(e) => props.setForm({ ...form, meetingTitle: e.target.value })} placeholder="Titulo de la reunion" />
          <input className={inputClass} value={form.meetingType} onChange={(e) => props.setForm({ ...form, meetingType: e.target.value })} placeholder="Tipo" />
          {mode === 'manual' ? (
            <textarea className={`${inputClass} min-h-[100px] resize-y`} value={form.manualText} onChange={(e) => props.setForm({ ...form, manualText: e.target.value })} placeholder="Pega aqui las notas, compromisos, decisiones y bloqueos..." />
          ) : (
            <input className={inputClass} value={form.driveRef} onChange={(e) => props.setForm({ ...form, driveRef: e.target.value })} placeholder="Link de Drive o ID de archivo" />
          )}
          <button type="button" className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-sm font-semibold transition disabled:opacity-40" onClick={() => void props.handleCreateRun()} disabled={props.loading || (mode === 'manual' ? !form.manualText.trim() : !form.driveRef.trim())}>
            {props.loading ? 'Procesando...' : 'Crear run'}
          </button>
        </div>
      </div>
    </section>
  );
}
