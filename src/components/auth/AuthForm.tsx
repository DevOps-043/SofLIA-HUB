import type { FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

interface AuthFormProps {
  identifier: string;
  password: string;
  error: string;
  loading: boolean;
  onIdentifierChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function AuthForm(props: AuthFormProps) {
  const disabled = props.loading || !props.identifier.trim() || !props.password.trim();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const shadowColor = isDark ? 'rgba(0, 212, 179, 0.25)' : 'rgba(10, 37, 64, 0.15)';

  return (
    <form onSubmit={props.onSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Username/Email Input with User Icon */}
        <AuthInput
          delay={0.2}
          value={props.identifier}
          onChange={props.onIdentifierChange}
          placeholder="Usuario o Correo electrónico"
          disabled={props.loading}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
        />
        {/* Password Input with Lock Icon */}
        <AuthInput
          delay={0.28}
          type="password"
          value={props.password}
          onChange={props.onPasswordChange}
          placeholder="Contraseña"
          disabled={props.loading}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          }
        />
      </div>

      <AnimatePresence>
        {props.error && (
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
              <span>{props.error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36, duration: 0.46, ease: [0.16, 1, 0.3, 1] }}>
        <motion.button
          type="submit"
          disabled={disabled}
          whileHover={!disabled ? { scale: 1.015, boxShadow: `0 12px 30px ${shadowColor}` } : {}}
          whileTap={!disabled ? { scale: 0.985 } : {}}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="relative w-full bg-[#0a2540] hover:bg-[#113a60] dark:bg-gradient-to-r dark:from-accent dark:to-[#00B59C] text-on-accent rounded-xl py-3 text-[13.5px] font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_24px_rgba(10,37,64,0.08)] dark:shadow-[0_8px_24px_rgba(0,212,179,0.15)] disabled:shadow-none"
        >
          {props.loading ? <LoadingLabel /> : 'Iniciar Sesión'}
        </motion.button>
      </motion.div>
    </form>
  );
}

function AuthInput({
  delay,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  icon,
}: {
  delay: number;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  icon: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, ease: [0.16, 1, 0.3, 1], duration: 0.6 }}>
      <div className="relative group">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 group-focus-within:text-accent transition-colors">
          {icon}
        </div>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-100/50 dark:bg-[#161B22]/40 border border-gray-200/80 dark:border-white/[0.06] rounded-xl pl-11 pr-4 py-3 text-[13px] font-light text-gray-900 dark:text-white placeholder-gray-400/80 dark:placeholder-white/20 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40 transition-all duration-200 backdrop-blur-sm group-hover:bg-gray-100/80 dark:group-hover:bg-[#161B22]/70 group-hover:border-gray-300 dark:group-hover:border-white/[0.08]"
          disabled={disabled}
        />
      </div>
    </motion.div>
  );
}

function LoadingLabel() {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      <span>Ingresando...</span>
    </div>
  );
}
