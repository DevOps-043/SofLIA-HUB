import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { WhatsAppAccessPermission } from './types';

const PERMISSION_OPTIONS: Array<{ id: WhatsAppAccessPermission; label: string }> = [
  { id: 'files_read', label: 'Ver archivos' },
  { id: 'files_write', label: 'Modificar archivos' },
  { id: 'screen_view', label: 'Ver pantalla' },
  { id: 'computer_control', label: 'Control PC' },
  { id: 'shell', label: 'Terminal' },
  { id: 'clipboard', label: 'Portapapeles' },
  { id: 'google_workspace', label: 'Google' },
  { id: 'messaging', label: 'Mensajes' },
  { id: 'system_control', label: 'Sistema' },
  { id: 'automation', label: 'Automatizaciones' },
  { id: 'remote_nodes', label: 'Nodos' },
];

interface MasterAccessCardProps {
  allowedNumbers: string[];
  contactPermissions: Record<string, WhatsAppAccessPermission[]>;
  masterNumber: string;
  masterNumberInput: string;
  masterPermissions: WhatsAppAccessPermission[];
  onMasterNumberInputChange: (value: string) => void;
  onSaveMasterNumber: () => void;
  onToggleMasterPermission: (permission: WhatsAppAccessPermission, enabled: boolean) => void;
  onTogglePermission: (number: string, permission: WhatsAppAccessPermission, enabled: boolean) => void;
}

export function MasterAccessCard(props: MasterAccessCardProps) {
  const {
    allowedNumbers,
    contactPermissions,
    masterNumber,
    masterNumberInput,
    masterPermissions,
    onMasterNumberInputChange,
    onSaveMasterNumber,
    onToggleMasterPermission,
    onTogglePermission,
  } = props;
  const identityNumbers = Array.from(new Set([masterNumber, ...allowedNumbers].filter(Boolean)));

  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Acceso Maestro</h3>
          <p className="mt-1 text-xs text-secondary">
            {masterNumber ? `Maestro activo: +${masterNumber}` : 'Sin numero maestro'}
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <input
            type="text"
            value={masterNumberInput}
            onChange={(event) => onMasterNumberInputChange(event.target.value)}
            placeholder="521..."
            className="min-w-0 flex-1 md:w-48 px-3.5 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-sm font-mono placeholder-secondary/70 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
            onKeyDown={(event) => event.key === 'Enter' && onSaveMasterNumber()}
          />
          <Button variant="secondary" size="sm" onClick={onSaveMasterNumber}>
            Guardar
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {identityNumbers.length > 0 ? (
          identityNumbers.map((number) => {
            const isMaster = Boolean(masterNumber && number.endsWith(masterNumber.slice(-10)));
            const granted = new Set(isMaster ? masterPermissions : (contactPermissions[number] || []));
            return (
              <div key={number} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">+{number}</span>
                  <span className={`text-xs font-medium ${isMaster ? 'text-accent' : 'text-secondary'}`}>
                    {isMaster ? `${granted.size} permisos maestro` : `${granted.size} permisos`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {PERMISSION_OPTIONS.map((permission) => {
                    const checked = granted.has(permission.id);
                    return (
                      <button
                        key={permission.id}
                        type="button"
                        onClick={() => {
                          if (isMaster) onToggleMasterPermission(permission.id, !checked);
                          else onTogglePermission(number, permission.id, !checked);
                        }}
                        className={`min-h-9 rounded-xl border px-3 text-xs font-medium transition-colors ${
                          checked
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : 'bg-surface-2 border-border text-secondary hover:text-gray-900 dark:hover:text-white hover:border-accent/20'
                        }`}
                      >
                        {permission.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-6 text-center border border-dashed border-border rounded-xl">
            <p className="text-xs text-secondary">Agrega numeros a la whitelist</p>
          </div>
        )}
      </div>
    </Card>
  );
}
