/**
 * AudioWorklet de captura PCM para la transcripcion de reuniones en vivo.
 *
 * Archivo REAL en public/ (mismo origen) porque el CSP del app usa
 * "script-src 'self'" y bloquea modulos blob:. Reenvia cada bloque de 128
 * muestras al hilo principal, donde se acumulan en chunks de 1 segundo.
 */
class SofliaPcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor('soflia-pcm-capture', SofliaPcmCaptureProcessor);
