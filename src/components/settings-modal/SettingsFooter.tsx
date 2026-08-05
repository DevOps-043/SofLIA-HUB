import { Button } from '../ui/Button';

interface SettingsFooterProps {
  saving: boolean;
  loading: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function SettingsFooter({ saving, loading, onClose, onSave }: SettingsFooterProps) {
  return (
    <div className="relative z-20 flex items-center justify-between border-t border-border bg-surface px-7 py-4">
      <div className="flex items-center gap-2">
        {saving && (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
            <p className="text-xs text-secondary font-medium">Guardando...</p>
          </>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={onSave} loading={saving} disabled={loading}>
          {saving ? 'Procesando...' : 'Aplicar Cambios'}
        </Button>
      </div>
    </div>
  );
}
