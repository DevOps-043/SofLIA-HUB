import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';
import { manageZoomSharing } from './share-lifecycle';

// Runtime aislado: no comparte React, preload, identidad ni almacenamiento de Hub.
const client = ZoomMtgEmbedded.createClient();
const nonce = location.hash.slice(1);
let joined = false;
let joining = false;
let disposed = false;
let subscribed=false;
let recordingState='unknown';
let recordingRecovery:ReturnType<typeof setTimeout>|null=null;
const status = document.getElementById('status')!;
let parentOrigin = '*';
function emit(type: string, detail?: unknown) { parent.postMessage({ source: 'soflia-zoom', nonce, type, detail }, parentOrigin); }
const sharing = manageZoomSharing(navigator.mediaDevices, (active) => emit('sharing', active));
function failed() { status.hidden = false; status.textContent = 'No se pudo completar la acción. Revisa el ingreso, los permisos y la conexión.'; emit(joined ? 'action-error' : 'error', status.textContent); }
function subscribeEvents() {
if(subscribed)return;subscribed=true;
client.on('recording-change', state=>{recordingState=state;emit('recording',state);});
client.on('connection-change', (event: { state?: string }) => {
  if (event.state === 'Closed' || event.state === 'Fail') { if(recordingRecovery)clearTimeout(recordingRecovery);sharing.stop(); joined = false; emit('disconnected'); }
});
client.on('user-updated', () => { const user = client.getCurrentUser(); if (user) emit('media', { mic: !!user.audio && !user.muted, camera: !!user.bVideoOn }); });
}
async function receive(event: MessageEvent) {
  if (event.source !== parent) return;
  const message = event.data;
  if (!message || message.nonce !== nonce || message.source !== 'soflia-studio') return;
  if (parentOrigin !== '*' && event.origin !== parentOrigin) return;
  if (message.type === 'join') parentOrigin = event.origin === 'null' ? '*' : event.origin;
  try {
    if (message.type === 'join' && !joined && !joining) {
      recordingState='unknown';
      joining = true;
      const args = message.detail;
      if(args?.userEmail!==undefined&&(typeof args.userEmail!=='string'||args.userEmail.length>254||!/^\S+@\S+\.\S+$/.test(args.userEmail)))throw new Error('Correo de ingreso inválido');
      if (!args || typeof args.signature !== 'string' || args.signature.length > 4096 || typeof args.meetingNumber !== 'string' || !/^\d{9,11}$/.test(args.meetingNumber) || typeof args.userName !== 'string' || args.userName.length > 160 || typeof args.password !== 'string' || args.password.length > 100 || args.zak !== undefined && (typeof args.zak !== 'string' || args.zak.length > 8192)) throw new Error('Ingreso inválido');
      await client.init({ zoomAppRoot: document.getElementById('meeting')!, language: 'es-ES', patchJsMedia: true, leaveOnPageUnload: true });
      if (disposed) return;
      subscribeEvents();
      await client.join({ signature: args.signature, meetingNumber: args.meetingNumber, userName: args.userName, password: args.password, ...(args.zak ? { zak: args.zak } : {}), ...(args.userEmail?{userEmail:args.userEmail}:{}) });
      if (disposed) { await client.leaveMeeting(); return; }
      joined = true; status.hidden = true; emit('connected');
      emit('call-controls', { camera: false, captions: false, captionsEnabled: false });
      if(args.recording_required&&args.recording_recovery_allowed&&args.zak)recordingRecovery=setTimeout(()=>{if(joined&&!disposed&&recordingState!=='Recording')void client.record('start').catch(()=>emit('recording-error'));},7000);
    } else if (message.type === 'stop-share') sharing.stop();
    else if (message.type === 'mute' && joined) await client.mute(!!message.detail);
    else if (message.type === 'toggle-mic' && joined) { const user = client.getCurrentUser(); if (!user?.audio) throw new Error('Conecta audio desde la llamada.'); await client.mute(!user.muted); }
    else if (message.type === 'visit-room' && joined) {
      if (!message.detail) await client.leaveBreakoutRoom();
      else {
        const rooms = client.getBreakoutRoomList();
        const match = rooms.find((room) => room.name === message.detail);
        if (!match) throw new Error('Sala audiovisual no disponible');
        await client.joinBreakoutRoom(match.roomId);
      }
      emit('room-joined', message.detail);
    } else if (message.type === 'leave' && joined) { if(recordingRecovery)clearTimeout(recordingRecovery);sharing.stop(); await client.leaveMeeting(); joined = false; emit('disconnected'); }
  } catch { failed(); }
  finally { joining = false; }
}
window.addEventListener('message', receive);
window.addEventListener('pagehide', () => { disposed = true; if(recordingRecovery)clearTimeout(recordingRecovery);sharing.dispose(); if (joined) void client.leaveMeeting(); ZoomMtgEmbedded.destroyClient(); });
export function start(event: MessageEvent) { void receive(event); }
