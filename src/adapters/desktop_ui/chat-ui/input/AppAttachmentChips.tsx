import { levelLabel, warningLabel } from '../../../../services/desktop-context-service';
import type { AppContextAttachmentState } from '../app-attachments';

interface AppAttachmentChipsProps {
  attachedApps: AppContextAttachmentState[];
  onRemoveApp: (appId: string) => void;
}

export function AppAttachmentChips({ attachedApps, onRemoveApp }: AppAttachmentChipsProps) {
  if (!attachedApps || attachedApps.length === 0) return null;

  return (
    <div className="mb-1.5 flex min-w-0 flex-wrap gap-1.5">
      {attachedApps.map((app) => (
        <div
          key={app.appId}
          className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-medium shadow-2xs transition-all ${
            app.status === 'error'
              ? 'border-danger/30 bg-danger/8 text-danger'
              : 'border-accent/30 bg-accent/8 text-primary dark:text-white'
          }`}
        >
          <svg
            className={`h-3.5 w-3.5 shrink-0 ${app.status === 'error' ? 'text-danger' : 'text-accent'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="14" rx="2" />
            <path d="M8 20h8" />
          </svg>

          <span className="max-w-[140px] truncate" title={app.title}>
            {app.title}
          </span>

          <span className="shrink-0 text-[9px] font-semibold opacity-70">{describeState(app)}</span>

          <button
            type="button"
            onClick={() => onRemoveApp(app.appId)}
            aria-label={`Quitar aplicación ${app.title}`}
            title="Quitar aplicación"
            className="ml-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-secondary transition hover:bg-black/10 hover:text-danger dark:hover:bg-white/20"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/** El chip declara la fidelidad real: el usuario decide sabiendo que verá el modelo. */
function describeState(app: AppContextAttachmentState): string {
  if (app.status === 'pendiente') return '(leyendo...)';
  if (app.status === 'error') return `(${app.error || 'no se pudo leer'})`;

  const attachment = app.attachment;
  if (!attachment) return '(sin contenido)';

  const avisos = attachment.warnings.map(warningLabel).filter(Boolean);
  const detalle = avisos.length > 0 ? `, ${avisos.join(', ')}` : '';
  return `(${levelLabel(attachment.level).toLowerCase()}${detalle})`;
}
