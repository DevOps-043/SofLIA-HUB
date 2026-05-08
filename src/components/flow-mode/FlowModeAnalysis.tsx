import { MarkdownRenderer } from '../chat/MarkdownRenderer';
import type {
  FlowAction,
  FlowAnalysisResult,
} from '../../services/flow-service';

type FlowModeAnalysisProps = {
  action: FlowAction | null;
  analysis: FlowAnalysisResult;
};

export function FlowModeAnalysis({
  action,
  analysis,
}: FlowModeAnalysisProps) {
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[#76918d]">Respuesta</div>
        <div className="mt-3 text-[15px] leading-7 text-[#eef4f3]">
          <MarkdownRenderer text={analysis.response} />
        </div>
      </div>

      {analysis.missing.length > 0 && (
        <div className="rounded-[24px] border border-[#4d3912] bg-[#24190a] p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#ffcf7a]">Falta informacion</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {analysis.missing.map((item) => (
              <span key={item} className="rounded-full border border-[#5b4317] bg-[#2f220d] px-3 py-1.5 text-[12px] text-[#ffd998]">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {action?.type === 'send_email' && (
        <div className="rounded-[24px] border border-white/8 bg-[#0b1013] p-4 text-[14px] text-[#eef4f3]">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#76918d]">Borrador de correo</div>
          <div className="mt-3 space-y-2">
            <div>Para: {action.to || 'Sin destinatario'}</div>
            <div>Asunto: {action.subject || 'Sin asunto'}</div>
            <div className="whitespace-pre-wrap rounded-[18px] border border-white/8 bg-black/20 px-3 py-3">
              {action.body || 'Sin cuerpo'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
