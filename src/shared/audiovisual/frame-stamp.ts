/** Firma de captura en una franja fuera del video; main la verifica y la recorta. */
export function frameStamp(frame:number,nonce=0):number[] {
  const value=((Math.floor(frame)&4095)<<2)|(nonce&3);
  return [16+(value&31)*7,16+((value>>5)&31)*7,16+((value>>10)&31)*7];
}
