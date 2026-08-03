export function EmptyChatState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="mb-6">
        <div className="w-16 h-16 flex items-center justify-center mx-auto mb-5 rounded-full overflow-hidden shadow-lg border border-white/[0.04] dark:bg-white/[0.02]">
          <img src="./assets/lia-avatar.png" alt="Pulse" className="w-full h-full object-cover" />
        </div>
        <h2 className="text-2xl font-light tracking-wide text-primary dark:text-white/90 text-center">
          Como puedo ayudarte hoy?
        </h2>
        <p className="text-secondary/70 dark:text-white/40 text-[13px] font-light text-center mt-2.5">
          Preguntale a Pulse lo que necesites.
        </p>
      </div>
    </div>
  );
}
