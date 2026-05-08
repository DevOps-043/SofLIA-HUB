interface ErrorAlertProps {
  message: string | null;
}

export function ErrorAlert({ message }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div className="mt-8 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{message}</p>
    </div>
  );
}
