export function AppLoadingScreen({ isFlowWindow }: { isFlowWindow: boolean }) {
  return (
    <div className={`flex h-screen w-screen items-center justify-center ${isFlowWindow ? "bg-transparent" : "bg-background dark:bg-background-dark"}`}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 flex items-center justify-center">
          <img src="./assets/Icono.png" alt="Loading" className="w-full h-full object-contain dark:filter-none filter-accent-themed" />
        </div>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
