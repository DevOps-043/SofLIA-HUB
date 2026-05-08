import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function AuthChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] overflow-hidden relative selection:bg-accent/30">
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px] animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative w-full max-w-[400px] p-8 mx-4"
      >
        {children}
      </motion.div>
    </div>
  );
}
