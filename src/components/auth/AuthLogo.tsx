import { motion } from 'framer-motion';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export function AuthLogo() {
  return (
    <div className="flex flex-col items-center mb-8">
      <motion.div
        initial={{ scale: 0.96, opacity: 1 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.65, ease: EASE_OUT_EXPO }}
        className="w-16 h-16 mb-4 relative flex items-center justify-center"
      >
        <motion.div
          aria-hidden="true"
          className="absolute inset-1 rounded-full bg-accent/12 blur-xl"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08, duration: 0.5, ease: EASE_OUT_EXPO }}
        />
        <motion.img
          src="./assets/Icono.png"
          alt="Pulse Logo"
          className="relative w-full h-full object-contain"
          style={{ filter: 'drop-shadow(0 0 22px rgba(0, 212, 179, 0.28)) drop-shadow(0 14px 26px rgba(0, 0, 0, 0.34))' }}
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.45, ease: EASE_OUT_EXPO }}
        className="text-2xl font-light bg-clip-text text-transparent bg-gradient-to-b from-gray-900 via-gray-900 to-gray-700 dark:from-white dark:via-white dark:to-white/80 tracking-wide text-center"
      >
        Pulse Hub
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.16, duration: 0.38, ease: 'easeOut' }}
        className="text-gray-500/70 dark:text-white/30 text-[12.5px] font-light mt-1.5 tracking-wide text-center"
      >
        Ingresa a tu espacio de operaciones digitales
      </motion.p>
    </div>
  );
}
