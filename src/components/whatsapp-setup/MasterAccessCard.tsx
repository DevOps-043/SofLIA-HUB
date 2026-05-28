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
  onMasterNumberInputChange: (value: string) => void;
  onSaveMasterNumber: () => void;
  onTogglePermission: (number: string, permission: WhatsAppAccessPermission, enabled: boolean) => void;
}

export function MasterAccessCard(props: MasterAccessCardProps) {
  const {
    allowedNumbers,
    contactPermissions,
    masterNumber,
    masterNumberInput,
    onMasterNumberInputChange,
    onSaveMasterNumber,
    onTogglePermission,
  } = props;

  return (
    <div className="bg-white dark:bg-white/3 border border-gray-200 dark:border-white/10 rounded-3xl p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Acceso Maestro</h4>
          <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
            {masterNumber ? `Maestro activo: +${masterNumber}` : 'Sin numero maestro'}
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <input
            type="text"
            value={masterNumberInput}
            onChange={(event) => onMasterNumberInputChange(event.target.value)}
            placeholder="521..."
            className="min-w-0 flex-1 md:w-48 pl-3 pr-4 py-2.5 bg-gray-50 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-accent/30 transition-all"
            onKeyDown={(event) => event.key === 'Enter' && onSaveMasterNumber()}
          />
          <button
            onClick={onSaveMasterNumber}
            className="px-4 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
          >
            Guardar
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {allowedNumbers.length > 0 ? (
          allowedNumbers.map((number) => {
            const granted = new Set(contactPermissions[number] || []);
            const isMaster = Boolean(masterNumber && number.endsWith(masterNumber.slice(-10)));
            return (
              <div key={number} className="border-t border-gray-100 dark:border-white/5 pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-[10px] text-gray-600 dark:text-gray-300 font-mono tracking-widest">+{number}</span>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${isMaster ? 'text-accent' : 'text-gray-400'}`}>
                    {isMaster ? 'Maestro' : `${granted.size} permisos`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {PERMISSION_OPTIONS.map((permission) => {
                    const checked = granted.has(permission.id);
                    return (
                      <button
                        key={permission.id}
                        type="button"
                        disabled={Boolean(isMaster)}
                        onClick={() => onTogglePermission(number, permission.id, !checked)}
                        className={`min-h-9 rounded-xl border px-3 text-[9px] font-black uppercase tracking-widest transition-all ${
                          checked || isMaster
                            ? 'bg-accent/15 border-accent/30 text-accent'
                            : 'bg-white dark:bg-background-dark/60 border-gray-200 dark:border-white/10 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        } ${isMaster ? 'opacity-60 cursor-not-allowed' : ''}`}
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
          <div className="py-6 text-center border border-dashed border-gray-200 dark:border-white/5 rounded-xl">
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Agrega numeros a la whitelist</p>
          </div>
        )}
      </div>
    </div>
  );
}
