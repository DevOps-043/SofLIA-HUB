import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function AuthChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center overflow-hidden relative selection:bg-accent/30 bg-background dark:bg-[#080B11]">
      <style dangerouslySetInnerHTML={{__html: `
        .auth-grid {
          background-image: radial-gradient(circle at 1px 1px, rgba(10, 37, 64, 0.04) 1.5px, transparent 0);
        }
        .dark .auth-grid {
          background-image: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.03) 1.5px, transparent 0);
        }
      `}} />
      {/* Decorative premium gradients and grid */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-40 auth-grid"
          style={{
            backgroundSize: '28px 28px',
          }}
        />
        {/* Radial brand glow overlay */}
        <div 
          className="absolute top-[10%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/8 blur-[130px]"
          style={{ animation: 'pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
        />
        <div 
          className="absolute bottom-[-10%] right-[10%] w-[350px] h-[350px] rounded-full bg-blue-500/5 blur-[100px]"
          style={{ animation: 'pulse 10s cubic-bezier(0.4, 0, 0.6, 1) infinite', animationDelay: '2s' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 1, y: 0, scale: 1 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[420px] px-8 py-10 mx-4 bg-white/80 dark:bg-[#11151D]/60 border border-gray-200/50 dark:border-white/[0.06] rounded-3xl shadow-[0_24px_60px_rgba(0,37,64,0.06)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
      >
        {/* Accent glow on top border of card */}
        <div className="absolute top-0 left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
        
        {children}
      </motion.div>
    </div>
  );
}
