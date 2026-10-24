import { ZoomVideo, VideoQuality } from './video-client';
import { videoJoinSchema } from '../../src/shared/live-studio.contract';
import { manageZoomSharing } from './share-lifecycle';
import { callDevices } from './call-devices';

/** Adaptador aislado: los listeners y recursos pertenecen a este iframe. */
export function start(initial: MessageEvent) {
  const args = videoJoinSchema.parse(initial.data.detail);
  const client = ZoomVideo.createClient();
  const nonce = location.hash.slice(1), origin = initial.origin;
  const status = document.getElementById('status')!, root = document.getElementById('meeting')!;
  const emit = (type: string, detail?: unknown) => parent.postMessage({ source: 'soflia-zoom', nonce, type, detail }, origin === 'null' ? '*' : origin);
  let joined = false, disposed = false, audio = false, camera = false, shared = false, remoteShare = 0;
  let captionsEnabled = false;
  let recordingTimer: ReturnType<typeof setTimeout> | undefined;
  let operations = Promise.resolve(), renders = Promise.resolve();
  const sharing = manageZoomSharing(navigator.mediaDevices, active => { shared = active; emit('sharing', active); });
  let stream: ReturnType<typeof client.getMediaStream>;
  let devices:ReturnType<typeof callDevices>;
  let joinTask: Promise<void> = Promise.resolve();
  root.classList.add('video-session');
  const toolbar = document.createElement('nav'); toolbar.setAttribute('aria-label', 'Controles de la sesión');
  const grid = document.createElement('video-player-container'); grid.className = 'video-grid';
  const share = document.createElement('video-player-container'); share.className = 'video-share'; share.hidden = true;
  let preview = document.createElement('video') as HTMLVideoElement | HTMLCanvasElement;
  preview.className = 'share-preview'; preview.hidden = true;
  const people = document.createElement('p'); people.className = 'video-participants';
  const recording = document.createElement('p'); recording.setAttribute('role', 'status'); recording.textContent = 'Esperando confirmación de grabación…';
  root.append(toolbar, recording, share, preview, grid, people);
  if (initial.data.presentation === 'participant') { root.classList.add('participant-presentation'); toolbar.hidden = true; recording.hidden = true; people.hidden = true; }
  const buttons: HTMLButtonElement[] = [];
  function failure(connect = false) {
    status.hidden = false; status.textContent = 'No se pudo completar la acción. Revisa los permisos del dispositivo y la conexión.';
    emit(connect ? 'error' : 'action-error');
  }
  async function checked(result: unknown) { const value = await result; if (value && typeof value === 'object' && ('type' in value || value instanceof Error)) throw new Error('Video SDK rechazó la acción.'); }
  function action(task: () => Promise<void>) {
    operations = operations.then(async () => { if (joined && !disposed) { await task(); media(); } }).catch(() => failure());
  }
  function button(label: string, task: () => Promise<void>) {
    const element = document.createElement('button'); element.type = 'button'; element.textContent = label; element.disabled = true;
    element.onclick = () => action(task); buttons.push(element); toolbar.append(element); return element;
  }
  const mic = button('Activar micrófono', async () => {
    if (!audio) { await checked(stream.startAudio(devices.audioOptions())); audio = true; }
    else if (client.getCurrentUserInfo()?.muted) await checked(stream.unmuteAudio());
    else await checked(stream.muteAudio());
  });
  const cam = button('Activar cámara', async () => { if (camera) await checked(stream.stopVideo()); else await checked(stream.startVideo(devices.videoOptions())); });
  const screen = button('Compartir pantalla', async () => {
    if (shared) await stopShare();
    else { preview.hidden = false; try { await checked(stream.startShareScreen(preview)); } catch (error) { sharing.stop(); preview.hidden = true; throw error; } }
  });
  const leave = document.createElement('button'); leave.type = 'button'; leave.textContent = 'Salir de la sesión'; leave.onclick = () => { void dispose(); }; toolbar.append(leave);
  function media() {
    const user = client.getCurrentUserInfo(); camera = !!user?.bVideoOn;
    mic.textContent = !audio ? 'Conectar audio' : user?.muted ? 'Activar micrófono' : 'Silenciar micrófono';
    cam.textContent = camera ? 'Apagar cámara' : 'Activar cámara';
    screen.textContent = shared ? 'Dejar de compartir' : 'Compartir pantalla';
    emit('media', { mic: audio && !user?.muted, camera });
    reportDevices();
    controls();
  }
  function reportDevices(){try{if(devices)emit('call-devices',devices.list());}catch{/* La lista puede no estar disponible antes de autorizar los dispositivos. */}}
  function controls() {
    let available = false;
    try { const state = client.getLiveTranscriptionClient().getLiveTranscriptionStatus(); available = !!state?.isLiveTranscriptionEnabled && !state.isHostDisableCaptions; }
    catch { /* La ausencia de captions no bloquea los medios de la llamada. */ }
    if (!available) captionsEnabled = false;
    emit('call-controls', { camera: true, captions: available, captionsEnabled });
  }
  async function stopShare() {
    sharing.stop(); preview.hidden = true;
    if (joined) await checked(stream.stopShareScreen());
    media();
  }
  const videos = new Map<number, HTMLElement>();
  function render() {
    renders = renders.then(async () => {
      if (!joined || disposed) return;
      const users = client.getAllUser();
      people.textContent = `${users.length} participantes: ${users.map(user => user.displayName).join(', ')}`;
      const visible = users.filter(user => user.bVideoOn).sort((a, b) => Number(b.isHost) - Number(a.isHost)).slice(0, 9);
      for (const [id, tile] of videos) if (!visible.some(user => user.userId === id)) { await stream.detachVideo(id); tile.remove(); videos.delete(id); }
      for (const user of visible) {
        if (videos.has(user.userId) || disposed) continue;
        const tile = document.createElement('div'); tile.className = 'video-tile';
        const player = await stream.attachVideo(user.userId, VideoQuality.Video_360P);
        if (!(player instanceof HTMLElement)) continue;
        if (disposed) { await stream.detachVideo(user.userId); break; }
        const name = document.createElement('span'); name.textContent = user.displayName;
        tile.append(player, name); grid.append(tile); videos.set(user.userId, tile);
      }
      media();
    }).catch(() => { if (!disposed) failure(); });
  }
  async function dispose() {
    if (disposed) return;
    disposed = true; buttons.forEach(b => { b.disabled = true; }); leave.disabled = true;
    clearTimeout(recordingTimer); sharing.dispose(); window.removeEventListener('message', receive);
    try { await joinTask; await operations; await renders; if (joined) await checked(client.leave()); }
    catch { /* La destrucción del cliente libera los recursos aunque la red falle. */ }
    finally { joined = false; await ZoomVideo.destroyClient(); root.replaceChildren(); emit('disconnected'); }
  }
  function receive(event: MessageEvent) {
    if (event.source !== parent || event.origin !== origin || event.data?.nonce !== nonce || event.data?.source !== 'soflia-studio') return;
    const { type, detail } = event.data;
    if (type === 'leave') void dispose();
    else if (type === 'stop-share') { sharing.stop(); action(stopShare); }
    else if (type === 'mute') action(async () => { if (audio) await checked(detail ? stream.muteAudio() : stream.unmuteAudio()); });
    else if (type === 'toggle-mic') mic.click();
    else if (type === 'toggle-camera') cam.click();
    else if (type === 'get-devices') action(async()=>{reportDevices();});
    else if (type === 'select-device') action(async()=>{await devices.select(detail);});
    else if (type === 'captions' && typeof detail === 'boolean') action(async () => {
      const transcription = client.getLiveTranscriptionClient();
      const state = transcription.getLiveTranscriptionStatus();
      if (detail && (!state.isLiveTranscriptionEnabled || state.isHostDisableCaptions)) throw new Error('Subtítulos no disponibles.');
      if (detail) await checked(transcription.startLiveTranscription());
      captionsEnabled = detail; controls();
    });
    else if (type === 'visit-room') action(async () => {
      const rooms = client.getSubsessionClient();
      if (!detail) await checked(rooms.leaveSubsession());
      else {
        const room = rooms.getSubsessionList().find(item => item.subsessionName === detail);
        if (!room) throw new Error('Sala audiovisual no disponible.');
        await checked(rooms.joinSubsession(room.subsessionId));
      }
      emit('room-joined', detail);
    });
  }
  window.addEventListener('message', receive);
  window.addEventListener('pagehide', () => { void dispose(); }, { once: true });
  client.on('connection-change', event => { if (event.state === 'Closed' || event.state === 'Fail') void dispose(); });
  for (const name of ['user-added', 'user-updated', 'user-removed', 'peer-video-state-change']) client.on(name, render);
  client.on('device-change',()=>{if(joined&&!disposed)reportDevices();});
  for (const name of ['caption-status', 'caption-enable', 'caption-host-disable'] as const) client.on(name, () => { if (joined && !disposed) controls(); });
  client.on('caption-message', event => {
    if (captionsEnabled && !disposed) emit('caption', { text: event.text.slice(0, 2000), speaker: event.displayName.slice(0, 160) });
  });
  client.on('recording-change', value => {
    recording.textContent = value === 'Recording' ? 'Grabación en curso' : value === 'Paused' ? 'Grabación pausada' : 'Grabación detenida';
    if (value === 'Recording') clearTimeout(recordingTimer);
    emit('recording', value);
  });
  client.on('active-share-change', event => {
    renders = renders.then(async () => {
      if (disposed) return;
      if (remoteShare) { await stream.detachShareView(remoteShare); remoteShare = 0; share.replaceChildren(); }
      if (event.state === 'Active') {
        const player = await stream.attachShareView(event.userId);
        if (player instanceof HTMLElement) {
          if (disposed) { await stream.detachShareView(event.userId); return; }
          share.append(player); remoteShare = event.userId;
        }
      }
      share.hidden = !remoteShare; root.classList.toggle('has-remote-share', !!remoteShare);
    }).catch(() => failure());
  });
  joinTask = (async () => {
    try {
      await checked(client.init('es-ES', new URL('./lib', location.href).href, { patchJsMedia: false, leaveOnPageUnload: true }));
      if (disposed) return;
      await checked(client.join(args.sessionName, args.token, args.userName, args.password));
      joined = true; stream = client.getMediaStream();
      devices=callDevices(stream,()=>({audio,camera}),checked);
      if (disposed) return;
      const capture = document.createElement(stream.isStartShareScreenWithVideoElement() ? 'video' : 'canvas') as HTMLVideoElement | HTMLCanvasElement;
      capture.className = 'share-preview'; capture.hidden = true; preview.replaceWith(capture); preview = capture; status.hidden = true; buttons.forEach(b => { b.disabled = false; }); emit('connected'); render();
      recordingTimer = setTimeout(() => {
        if (joined && !disposed && client.getRecordingClient().getCloudRecordingStatus() !== 'Recording') {
          recording.textContent = 'No se confirmó la grabación. Revisa la cuenta de Soflia.'; emit('recording-error');
        }
      }, 15000);
    } catch { if (!disposed) { failure(true); void dispose(); } }
  })();
}
