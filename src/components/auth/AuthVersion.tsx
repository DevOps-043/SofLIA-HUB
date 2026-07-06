import { motion } from 'framer-motion';

export function AuthVersion({ version }: { version: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.46, duration: 0.36 }}
      className="mt-8 text-center"
    >
      <p className="text-gray-400/50 dark:text-white/20 text-xs font-medium tracking-wider">
        SOFLIA HUB v{version}
      </p>
    </motion.div>
  );
}
