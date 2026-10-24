import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { ZoomJoin } from '../../../shared/live-studio.contract';
import { studioCallControlsSchema, studioCaptionSchema, type StudioCallCommand, type StudioCallControls, type StudioCaption } from '../../../shared/studio-call';

export type StudioZoomHandle = { command: (type: StudioCallCommand, detail?: unknown) => void };
export const StudioZoomFrame = forwardRef<StudioZoomHandle, { join: ZoomJoin; onStatus: (connected: boolean, error?: string) => void; onMedia: (media: { mic: boolean; camera: boolean }) => void; onShare: (sharing: boolean) => void; onControls?: (controls: StudioCallControls) => void; onCaption?: (caption: StudioCaption) => void; participant?: boolean }>(function StudioZoomFrame({ join, onStatus, onMedia, onShare, onControls, onCaption, participant = false }, handle) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [nonce] = useState(() => crypto.randomUUID());
  const callbacks = useRef({ onStatus, onMedia, onShare, onControls, onCaption }); callbacks.current = { onStatus, onMedia, onShare, onControls, onCaption };
  const credentials = useRef(join);
  const targetOrigin = window.learningLive?.sdkFrameUrl ? 'soflia-zoom://meeting' : location.protocol === 'file:' ? '*' : location.origin;
  const url = window.learningLive?.sdkFrameUrl ? `${window.learningLive.sdkFrameUrl}#${nonce}` : import.meta.env.DEV ? `/packages/zoom-runtime/index.html#${nonce}` : `./zoom-runtime/index.html#${nonce}`;
  useImperativeHandle(handle, () => ({ command: (type, detail) => frame.current?.contentWindow?.postMessage({ source: 'soflia-studio', nonce, type, detail }, targetOrigin) }), [nonce, targetOrigin]);
  useEffect(() => {
    const frameWindow = frame.current?.contentWindow;
    let ready = false;
    const timeout = window.setTimeout(() => { if (!ready) callbacks.current.onStatus(false, 'No se pudo cargar la conexión audiovisual. Reintenta entrar a la sesión.'); }, 20000);
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== (targetOrigin === '*' ? 'null' : targetOrigin)) return;
      const message = event.data;
      if (!message || message.source !== 'soflia-zoom' || message.nonce !== nonce) return;
      if (message.type === 'ready') { ready = true; window.clearTimeout(timeout); frame.current?.contentWindow?.postMessage({ source: 'soflia-studio', nonce, type: 'join', detail: credentials.current, presentation: participant ? 'participant' : 'instructor' }, targetOrigin); }
      else if (message.type === 'connected') callbacks.current.onStatus(true);
      else if (message.type === 'disconnected') callbacks.current.onStatus(false);
      else if (message.type === 'error') callbacks.current.onStatus(false, 'No se pudo completar la acción. Revisa los permisos de anfitrión y el ingreso a la sesión.');
      else if (message.type === 'action-error') callbacks.current.onStatus(true, 'No se pudo completar la acción. Usa los controles de la llamada para revisar el estado de la sesión.');
      else if (message.type === 'call-controls') { const parsed = studioCallControlsSchema.safeParse(message.detail); if (parsed.success) callbacks.current.onControls?.(parsed.data); }
      else if (message.type === 'caption') { const parsed = studioCaptionSchema.safeParse(message.detail); if (parsed.success) callbacks.current.onCaption?.(parsed.data); }
      else if (message.type === 'media' && typeof message.detail?.mic === 'boolean' && typeof message.detail?.camera === 'boolean') callbacks.current.onMedia(message.detail);
      else if (message.type === 'recording-error') callbacks.current.onStatus(true,'No se confirmó el inicio de la grabación. Revisa la configuración de la cuenta de Soflia.');
      else if (message.type === 'sharing' && typeof message.detail === 'boolean') callbacks.current.onShare(message.detail);
    }
    window.addEventListener('message', receive);
    return () => { window.clearTimeout(timeout); window.removeEventListener('message', receive); frameWindow?.postMessage({ source: 'soflia-studio', nonce, type: 'leave' }, targetOrigin); };
  }, [nonce, targetOrigin, participant]);
  return <iframe ref={frame} className="studio-zoom-frame" title="Sesión audiovisual integrada" src={url} sandbox="allow-scripts allow-same-origin allow-forms" allow="camera; microphone; display-capture; autoplay; fullscreen" />;
});
