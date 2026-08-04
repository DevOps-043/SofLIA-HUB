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
