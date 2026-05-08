import type { ReactNode } from 'react';

interface ActionDetailProps {
  toolName: string;
  description: string;
}

export function ActionDetail({ toolName, description }: ActionDetailProps) {
  if (toolName === 'execute_command') {
    return (
      <DetailShell label="Comando">
        <code className="text-sm font-mono text-amber-300 break-all leading-relaxed">
          {description.replace('Ejecutar comando: ', '')}
        </code>
      </DetailShell>
    );
  }

  if (toolName === 'delete_item') {
    return (
      <DetailShell label="Archivo / Carpeta">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 flex-shrink-0">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-sm text-gray-200 break-all leading-relaxed font-mono">
            {description.replace('Eliminar: ', '')}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">Se enviara a la papelera de reciclaje.</p>
      </DetailShell>
    );
  }

  if (toolName === 'send_email') {
    return (
      <div className="space-y-2">
        {description.split('\n').map((line, index) => {
          const [label, ...rest] = line.split(': ');
          const value = rest.join(': ');
          return (
            <div key={index}>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                {label.replace('Enviar email a', 'Destinatario')}
              </div>
              <span className="text-sm text-blue-300 break-all leading-relaxed">
                {value || label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return <p className="text-sm text-gray-300 break-all">{description}</p>;
}

function DetailShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
