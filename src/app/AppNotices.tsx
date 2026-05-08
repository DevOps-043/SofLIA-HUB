interface ShareLinkNotice {
  tone: "info" | "error";
  message: string;
}

export function ShareLinkNoticeBanner({ notice }: { notice: ShareLinkNotice }) {
  return (
    <div className={`mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm ${
      notice.tone === "error"
        ? "border-red-500/30 bg-red-500/10 text-red-100"
        : "border-accent/30 bg-accent/10 text-white"
    }`}>
      {notice.message}
    </div>
  );
}

export function LiaDegradedNotice({ message }: { message?: string }) {
  return (
    <div className="mx-6 mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <div className="font-semibold text-amber-50">Sincronizacion de chats no disponible</div>
      <div className="mt-1 text-amber-100/90">
        {message || "Esta sesion no pudo abrir la base de datos de conversaciones. Cierra sesion e inicia nuevamente para restaurar la sincronizacion entre dispositivos."}
      </div>
    </div>
  );
}
