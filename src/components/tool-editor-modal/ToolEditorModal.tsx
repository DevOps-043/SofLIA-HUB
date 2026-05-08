import { useState } from 'react';
import { ToolEditorFields } from './ToolEditorFields';
import type { ToolEditorModalProps } from './types';
import { useToolEditorForm } from './useToolEditorForm';

export function ToolEditorModal(props: ToolEditorModalProps) {
  const { isOpen, tool, initialPromptText, onClose } = props;
  const { form, patch, handleSubmit } = useToolEditorForm(props);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#1a1f2e] rounded-2xl w-[90%] max-w-[500px] max-h-[90vh] overflow-auto p-6 border border-white/10 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-white mb-5">
          {tool ? 'Editar Prompt' : initialPromptText ? 'Guardar Prompt' : 'Nuevo Prompt'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ToolEditorFields
            form={form}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            patch={patch}
          />
          {form.error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5 text-red-400 text-sm">{form.error}</div>
          )}
          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={form.saving}
              className="bg-transparent border border-white/20 rounded-xl px-5 py-2.5 text-gray-400 text-sm cursor-pointer hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={form.saving}
              className="bg-accent border-none rounded-xl px-6 py-2.5 text-white text-sm font-semibold cursor-pointer hover:bg-accent/80 transition-colors disabled:opacity-50"
            >
              {form.saving ? 'Guardando...' : (tool ? 'Guardar Cambios' : 'Guardar Prompt')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
