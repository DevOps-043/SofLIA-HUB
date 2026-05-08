import { motion } from 'framer-motion';

export function AuthLogo() {
  return (
    <div className="flex flex-col items-center mb-10">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-24 h-24 mb-6 relative group"
      >
        <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <img
          src="./assets/Icono.png"
          alt="SofLIA Logo"
          className="w-full h-full object-contain relative z-10 drop-shadow-2xl"
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 tracking-tight text-center"
      >
        Bienvenido
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-white/40 text-sm mt-2 text-center"
      >
        Ingresa a tu espacio de trabajo
      </motion.p>
    </div>
  );
}
