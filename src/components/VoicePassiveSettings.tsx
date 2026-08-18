import { ListeningCard } from './voice-settings/ListeningCard';
import { RuntimeStatusCard } from './voice-settings/RuntimeStatusCard';
import { VoiceModelCard } from './voice-settings/VoiceModelCard';
import { useVoicePassivePanel } from './voice-settings/useVoicePassivePanel';
import { cn } from './ui/cn';

// Panel de configuración de la voz pasiva local (wake word con Vosk, sin nube).
// Se monta como sub-tab "Voz & Audio" dentro de AppearanceVoiceSection.
export function VoicePassiveSettings() {
  const panel = useVoicePassivePanel();

  if (!panel.available) {
    return (
      <p className="text-sm text-secondary">
        La voz pasiva no está disponible en este entorno (requiere la app de escritorio).
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <ShieldIcon className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Voz pasiva local</h3>
          <p className="text-xs leading-relaxed text-secondary mt-1">
            SofLIA reconoce la palabra de activación con un modelo 100 % local (Vosk). Ningún audio
            sale de tu equipo hasta que la dices; solo entonces se abre el modo voz.
          </p>
        </div>
      </div>

      <RuntimeStatusCard panel={panel} />
      <VoiceModelCard panel={panel} />
      <ListeningCard panel={panel} />

      {panel.feedback && (
        <p
          role="status"
          className={cn(
            'text-xs px-3.5 py-2.5 rounded-xl border',
            panel.feedback.tone === 'ok'
              ? 'text-success bg-success/[0.07] border-success/20'
              : 'text-danger bg-danger/[0.06] border-danger/20',
          )}
        >
          {panel.feedback.message}
        </p>
      )}
    </div>
  );
}

function ShieldIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6L12 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.2l1.8 1.8 3.4-3.6" />
    </svg>
  );
}
