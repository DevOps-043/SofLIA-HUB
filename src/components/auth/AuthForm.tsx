import type { FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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

  return (
    <form onSubmit={props.onSubmit} className="space-y-5">
      <div className="space-y-4">
        <AuthInput delay={0.5} value={props.identifier} onChange={props.onIdentifierChange} placeholder="Usuario o Correo" disabled={props.loading} />
        <AuthInput delay={0.6} type="password" value={props.password} onChange={props.onPasswordChange} placeholder="Contraseña" disabled={props.loading} />
      </div>

      <AnimatePresence>
        {props.error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs text-center">
              {props.error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <button
          type="submit"
          disabled={disabled}
          className="w-full bg-white text-black font-semibold rounded-xl py-3.5 hover:bg-gray-200 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
        >
        {props.loading ? <LoadingLabel /> : 'Iniciar Sesión'}
        </button>
      </motion.div>
    </form>
  );
}

function AuthInput({ delay, type = 'text', value, onChange, placeholder, disabled }: {
  delay: number;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}>
      <div className="relative group">
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all duration-300 backdrop-blur-sm group-hover:bg-white/[0.07]"
          disabled={disabled}
        />
      </div>
    </motion.div>
  );
}

function LoadingLabel() {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
      <span>Ingresando...</span>
    </div>
  );
}
