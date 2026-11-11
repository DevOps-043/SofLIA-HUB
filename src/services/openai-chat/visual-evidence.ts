import type { MediaEnvelope, MediaRef, MediaRejection } from '../../shared/multimodal-input';

const MAX_IMAGES = 16;
const MAX_IMAGE_CHARS = 12_000_000;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export function projectVisualEvidence(images: string[], media: MediaRef[]) {
  const accepted: string[] = [];
  const rejected: MediaRejection[] = [];
  const sent: MediaEnvelope['sent'] = [];
  let remaining = MAX_IMAGE_CHARS;
  const add = (url: string) => {
    if (accepted.length >= MAX_IMAGES || url.length > remaining || !/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(url)) return false;
    accepted.push(url);
    remaining -= url.length;
    return true;
  };
  const omit = (detail: string) => rejected.push({ reason: 'formato-no-admitido', detail });
  for (const image of images) {
    if (add(image)) sent.push({ kind: 'inline', mimeType: image.slice(5, image.indexOf(';')) });
    else omit('Una imagen adjunta no pudo enviarse por formato o tamaño.');
  }
  for (const ref of media) {
    if (ref.kind === 'frames') {
      let frameCount = 0;
      for (const frame of ref.frames) {
        if (add(`data:${frame.mimeType};base64,${frame.base64}`)) frameCount++;
      }
      if (frameCount) sent.push({ kind: 'frames', frameCount });
      if (!frameCount || frameCount < ref.frames.length) omit('Parte del muestreo de vídeo no pudo enviarse.');
    } else if (ref.kind === 'inline' && IMAGE_TYPES.has(ref.mimeType)) {
      if (add(`data:${ref.mimeType};base64,${ref.base64}`)) sent.push({ kind: 'inline', mimeType: ref.mimeType });
      else omit('Una imagen adjunta no pudo enviarse por formato o tamaño.');
    } else {
      omit('Este medio requiere preparación de audio o vídeo para analizarse en OpenAI.');
    }
  }
  return { images: accepted, rejected, sent };
}
