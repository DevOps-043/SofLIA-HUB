import { Button } from '../ui/Button';

interface UserManagementFooterProps {
  onClose: () => void;
}

export function UserManagementFooter({ onClose }: UserManagementFooterProps) {
  return (
    <div className="px-8 py-5 border-t border-border bg-surface flex items-center justify-between relative z-20">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
        <p className="text-xs text-secondary">Protocolo de Gestion Activo</p>
      </div>

      <Button variant="secondary" size="sm" onClick={onClose}>
        Finalizar Sesion
      </Button>
    </div>
  );
}
