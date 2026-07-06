interface ErrorAlertProps {
  message: string | null;
}

export function ErrorAlert({ message }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div className="mt-8 px-4 py-3 bg-danger/10 border border-danger/20 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
      <div className="w-1.5 h-1.5 bg-danger rounded-full animate-pulse" />
      <p className="text-sm font-medium text-danger">{message}</p>
    </div>
  );
}
