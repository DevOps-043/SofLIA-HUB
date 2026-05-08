interface ActionRowProps {
  saving: boolean;
  isEditing: boolean;
  onClose: () => void;
}

export function ActionRow({ saving, isEditing, onClose }: ActionRowProps) {
  return (
    <div className="flex gap-3 justify-end mt-2">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="bg-transparent border border-white/20 rounded-xl px-5 py-2.5 text-gray-400 text-sm cursor-pointer hover:bg-white/5 transition-colors disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={saving}
        className="bg-accent border-none rounded-xl px-6 py-2.5 text-white text-sm font-semibold cursor-pointer hover:bg-accent/80 transition-colors disabled:opacity-50"
      >
        {saving ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Guardar Prompt')}
      </button>
    </div>
  );
}
