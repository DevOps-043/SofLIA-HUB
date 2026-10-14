import { useEffect, useRef, useState } from 'react';
import SelectDropdown from '../../ui/SelectDropdown';
import { StudioDialog } from './StudioDialog';
import { useStudioMediaRuntime } from './StudioMediaContext';

export function StudioAudioSettings({ onClose }: { onClose: () => void }) {
  const media = useStudioMediaRuntime()!;
  const [level, setLevel] = useState(0);
  const [output, setOutput] = useState('default');
  const [error, setError] = useState('');
  const tone = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!media.mic) return;
    const context = new AudioContext();
    const source = context.createMediaStreamSource(media.mic);
    const analyser = context.createAnalyser(); analyser.fftSize = 256; source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const timer = window.setInterval(() => { analyser.getByteTimeDomainData(data); const rms = Math.sqrt(data.reduce((total, value) => total + ((value - 128) / 128) ** 2, 0) / data.length); setLevel(Math.min(1, rms * 5)); }, 100);
    return () => { window.clearInterval(timer); source.disconnect(); void context.close(); };
  }, [media.mic]);
  useEffect(() => () => { void tone.current?.close(); }, []);
  const options = (kind: MediaDeviceKind) => [{ value: 'default', label: 'Predeterminado del sistema' }, ...media.devices.filter((device) => device.kind === kind && device.deviceId !== 'default').map((device, index) => ({ value: device.deviceId, label: device.label || `Dispositivo ${index + 1} · autoriza acceso para ver su nombre` }))];
  async function testOutput() {
    try {
      if (tone.current?.state !== 'closed') await tone.current?.close();
      const context = new AudioContext(); tone.current = context;
      const sinkContext = context as AudioContext & { setSinkId?: (id: string) => Promise<void> };
      if (output !== 'default') { if (!sinkContext.setSinkId) throw new Error('Este entorno no permite elegir la salida. Usa la configuración de audio de Zoom.'); await sinkContext.setSinkId(output); }
      const oscillator = context.createOscillator(); const gain = context.createGain(); gain.gain.value = 0.08; oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.3);
      oscillator.onended = () => { void context.close(); };
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo probar la salida.'); }
  }
  return <StudioDialog title="Configuración de audio" onClose={onClose}><p className="studio-muted">Prueba local de dispositivos. Durante la reunión, selecciona entrada y salida en los controles de Zoom.</p><div className="studio-device-options"><label>Micrófono · entrada<SelectDropdown aria-label="Micrófono · entrada" className="studio-select" value={media.input} onChange={(id) => void media.selectInput(id)} options={options('audioinput')} /></label><meter className="studio-microphone-level" min={0} max={1} value={media.mic ? level : 0} aria-label="Nivel real de micrófono" /><button className="studio-primary-button" disabled={!!media.zoomStage || media.pending} onClick={() => void media.toggle('mic')}>{media.mic ? 'Detener prueba de micrófono' : 'Probar micrófono'}</button><label>Cámara<SelectDropdown aria-label="Dispositivo de cámara" className="studio-select" value={media.cameraId} onChange={(id) => void media.selectCamera(id)} options={options('videoinput')} /></label><label>Altavoces · prueba de salida<SelectDropdown aria-label="Altavoces · salida" className="studio-select" value={output} onChange={setOutput} options={options('audiooutput')} /></label><button onClick={() => void testOutput()}>Reproducir sonido de prueba</button>{error && <p role="alert">{error}</p>}<button onClick={() => void media.refreshDevices()}>Actualizar dispositivos</button></div></StudioDialog>;
}
