export function EmptyChatState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="mb-6">
        <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4 rounded-full overflow-hidden">
          <img src="./assets/lia-avatar.png" alt="SofLIA" className="w-full h-full object-cover drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
        </div>
        <h2 className="text-2xl font-semibold text-primary dark:text-white text-center">
          Como puedo ayudarte hoy?
        </h2>
        <p className="text-secondary text-sm text-center mt-2">
          Preguntale a SofLIA lo que necesites.
        </p>
      </div>
    </div>
  );
}
