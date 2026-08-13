import { useEffect, useState } from 'react';
import {
  desktopContextService,
  levelLabel,
  type DesktopContextLevel,
  type DesktopWindowCandidate,
} from '../../../../services/desktop-context-service';

export interface AppAttachmentSelection {
  appId: string;
  title: string;
  appName: string;
  expectedLevel: DesktopContextLevel;
}

interface AppAttachmentPickerProps {
  attachedApps: AppAttachmentSelection[];
  onToggleApp: (app: AppAttachmentSelection) => void;
}

export function AppAttachmentPicker(props: AppAttachmentPickerProps) {
  const [candidates, setCandidates] = useState<DesktopWindowCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        if (!desktopContextService.isAvailable()) {
          setError('El contexto de aplicaciones no está disponible');
          return;
        }
        const res = await desktopContextService.listApps();
        if (!active) return;
        if (res.success && res.inventory) {
          setCandidates(res.inventory.candidates);
        } else {
          setError(res.error || 'No se pudieron listar las aplicaciones');
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Error al listar aplicaciones');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadToken]);

  const isSelected = (appId: string) => props.attachedApps.some((app) => app.appId === appId);

  return (
    <div
      role="dialog"
      aria-label="Añadir aplicaciones al chat"
      className="w-80 overflow-hidden rounded-2xl border border-gray-200/60 bg-white/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.14)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#161B22]/95 dark:shadow-[0_12px_48px_rgba(0,0,0,0.6)]"
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
        <span>Añadir aplicaciones</span>
        <span className="text-[10px] font-medium text-accent">De tu equipo</span>
      </div>

      <div className="my-1 border-t border-gray-100 dark:border-white/[0.06]" />

      {loading ? (
        <div className="flex items-center justify-center py-6 text-[12px] text-gray-400">
          <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-r-transparent" />
          Buscando ventanas abiertas...
        </div>
      ) : error ? (
        <div className="px-3 py-4 text-center text-[12px] text-gray-400">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="mt-2 rounded-lg px-2 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent/10"
          >
            Reintentar
          </button>
        </div>
      ) : candidates.length === 0 ? (
        <div className="px-3 py-4 text-center text-[12px] text-gray-400">
          No hay aplicaciones abiertas para adjuntar.
        </div>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto pr-0.5">
          {candidates.map((candidate) => {
            const selected = isSelected(candidate.id);

            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() =>
                  props.onToggleApp({
                    appId: candidate.id,
                    title: candidate.title,
                    appName: candidate.appName,
                    expectedLevel: candidate.expectedLevel,
                  })
                }
                className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                  selected
                    ? 'bg-accent/10 font-medium text-accent'
                    : 'text-gray-800 hover:bg-gray-100/80 dark:text-white/90 dark:hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {candidate.thumbnail ? (
                    <img
                      src={candidate.thumbnail}
                      alt=""
                      className="h-7 w-11 shrink-0 rounded-md border border-black/5 object-cover dark:border-white/10"
                    />
                  ) : (
                    <span className="grid h-7 w-11 shrink-0 place-items-center rounded-md border border-black/5 bg-gray-100 text-gray-400 dark:border-white/10 dark:bg-white/[0.04]">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="4" width="18" height="14" rx="2" />
                        <path d="M8 20h8" />
                      </svg>
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium leading-tight">
                      {candidate.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] font-normal text-gray-400">
                      {candidate.appName ? `${candidate.appName} · ` : ''}
                      {levelLabel(candidate.expectedLevel)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center">
                  {selected ? (
                    <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-accent text-white">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-gray-300 dark:border-white/20" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
