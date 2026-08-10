import { AnimatePresence, motion } from 'framer-motion';

interface AuthSsoButtonProps {
  disabled: boolean;
  error: string | null;
  pending: boolean;
  onCancel: () => void;
  onStart: () => void;
}

/**
 * Entrada federada con SofLIA Learning.
 *
 * Convive con el formulario de contrasena: existe para las cuentas creadas por
 * Google o Microsoft, que no tienen contrasena y hasta ahora no podian entrar.
 * El interruptor de configuracion decide si este bloque se monta.
 */
export function AuthSsoButton({ disabled, error, pending, onCancel, onStart }: AuthSsoButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.44, duration: 0.46, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-gray-200/80 dark:bg-white/[0.06]" />
        <span className="text-[11px] font-light text-gray-400 dark:text-white/25">o</span>
        <div className="h-px flex-1 bg-gray-200/80 dark:bg-white/[0.06]" />
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={disabled || pending}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-gray-200/80 dark:border-white/[0.08] bg-white/60 dark:bg-[#161B22]/40 py-3 text-[13px] font-medium text-gray-700 dark:text-white/80 backdrop-blur-sm transition-all duration-200 hover:bg-white dark:hover:bg-[#161B22]/70 hover:border-gray-300 dark:hover:border-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? (
          <>
            <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            <span>Esperando tu navegador...</span>
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            <span>Continuar con SofLIA Learning</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {pending && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-[11.5px] font-light leading-relaxed text-gray-400 dark:text-white/30"
          >
            Completa el inicio de sesión en tu navegador y vuelve aquí.{' '}
            <button
              type="button"
              onClick={onCancel}
              className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
            >
              Cancelar
            </button>
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && !pending && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2.5 text-red-400 text-[12px] leading-relaxed">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
