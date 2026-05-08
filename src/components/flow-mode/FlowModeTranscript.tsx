type FlowModeTranscriptProps = {
  transcriptFinal: string;
  transcriptInterim: string;
};

export function FlowModeTranscript({
  transcriptFinal,
  transcriptInterim,
}: FlowModeTranscriptProps) {
  return (
    <div className="mt-4 rounded-[24px] border border-white/8 bg-black/22 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[#76918d]">Transcripcion</div>
      <p className="mt-3 text-[20px] leading-[1.35] text-white sm:text-[24px]">
        {transcriptFinal}
        {transcriptInterim && <span className="text-[#6c8380]"> {transcriptInterim}</span>}
      </p>
    </div>
  );
}
