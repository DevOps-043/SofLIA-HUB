import type { ToolCategory } from '../../services/tools-service';
import { TOOL_CATEGORIES } from '../../services/tools-service';
import { EmojiPicker } from './EmojiPicker';
import { PromptTextarea } from './PromptTextarea';
import type { ToolEditorFormState } from './types';

export function ToolEditorFields({
  form,
  showEmojiPicker,
  setShowEmojiPicker,
  patch,
}: {
  form: ToolEditorFormState;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (open: boolean) => void;
  patch: (next: Partial<ToolEditorFormState>) => void;
}) {
  return (
    <>
      <div className="flex gap-3 items-center">
        <EmojiPicker
          icon={form.icon}
          show={showEmojiPicker}
          onToggle={() => setShowEmojiPicker(!showEmojiPicker)}
          onSelect={(icon) => {
            patch({ icon });
            setShowEmojiPicker(false);
          }}
        />
        <input
          type="text"
          placeholder="Nombre de la herramienta"
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none focus:border-accent/50 transition-colors"
          maxLength={50}
        />
      </div>
      <input
        type="text"
        placeholder="Descripcion breve (opcional)"
        value={form.description}
        onChange={(event) => patch({ description: event.target.value })}
        className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none focus:border-accent/50 transition-colors"
        maxLength={200}
      />
      <select
        value={form.category}
        onChange={(event) => patch({ category: event.target.value as ToolCategory })}
        className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none cursor-pointer focus:border-accent/50 transition-colors"
      >
        <option value="">Sin categoria</option>
        {TOOL_CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>{category.icon} {category.label}</option>
        ))}
      </select>
      <PromptTextarea
        label="Instrucciones del Sistema *"
        hint="Define como debe comportarse la IA cuando uses esta herramienta."
        value={form.systemPrompt}
        onChange={(systemPrompt) => patch({ systemPrompt })}
        rows={6}
      />
      <PromptTextarea
        label="Prompts de Inicio (opcional)"
        hint="Sugerencias que apareceran al usar la herramienta. Una por linea."
        value={form.starterPrompts}
        onChange={(starterPrompts) => patch({ starterPrompts })}
        rows={3}
        placeholder={'Como puedo mejorar mi copy?\nEscribe un titular para...\nAnaliza esta campana'}
      />
    </>
  );
}
