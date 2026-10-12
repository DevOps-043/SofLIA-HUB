import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { PresentationSlide } from '../../shared/presentations/deck-schema';
type Props = { slide: Extract<PresentationSlide,{tipo:'proceso'}>; reduced: boolean; header: ReactNode; visual?: ReactNode };
/** Una secuencia editorial, con recorrido y jerarquía propios; no una fila de tarjetas. */
export function ProcessSlide({ slide, reduced, header, visual }: Props) {
  const estimated = slide.pasos.reduce((sum,step) => sum+56+Math.ceil(step.titulo.length*20/730)*38+Math.ceil((step.texto?.length??0)*14/730)*32,0);
  const editorial = (slide.variante === 'editorial' || slide.variante === 'secuencial') && estimated <= 690;
  const item = (i: number) => ({ initial: reduced ? false as const : { opacity:0,y:24 }, animate:{opacity:1,y:0}, transition:{duration:.6,delay:reduced?0:.18+i*.1,ease:[.22,1,.36,1] as const} });
  return <section className={`runtime-pad runtime-process ${editorial ? 'runtime-process--editorial' : 'runtime-process--horizontal'}`}>
    <div className="runtime-process-heading"><div>{header}{slide.introduccion || slide.texto ? <p className="runtime-lead">{slide.introduccion ?? slide.texto}</p> : null}</div>{visual && <div className="runtime-media runtime-process-visual">{visual}</div>}</div>
    <div className="runtime-process-route">
      <div className="runtime-process-track" aria-hidden><motion.i initial={reduced ? false : { scaleY:editorial?0:1,scaleX:editorial?1:0 }} animate={{scaleX:1,scaleY:1}} transition={{duration:1.1,ease:[.22,1,.36,1]}} /></div>
      {slide.pasos.map((step,i)=><motion.article {...item(i)} key={step.titulo} className="runtime-process-step"><span className="runtime-process-index">{step.numero ?? String(i+1).padStart(2,'0')}</span><div><h2>{step.titulo}</h2>{step.texto && <p>{step.texto}</p>}</div><span className="runtime-process-arrow" aria-hidden>↗</span></motion.article>)}
    </div>
  </section>;
}
