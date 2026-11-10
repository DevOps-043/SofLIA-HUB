import { ZoomVideo, VideoQuality } from './video-client';
import { videoJoinSchema } from '../../src/shared/live-studio.contract';
import { studioCallViewSchema } from '../../src/shared/studio-call';
import { manageZoomSharing } from './share-lifecycle';
import { callDevices } from './call-devices';
import { academicRooms } from './academic-rooms';
import { receiveProgramAudio } from './program-audio';

export function videoAssetSource(pageUrl: string): string {
  const url = new URL(pageUrl);
  // El proveedor solo admite HTTP(S) para assets propios; otros esquemas
  // activan su fallback legado, incompatible con la versión instalada.
  return url.protocol === 'http:' || url.protocol === 'https:' ? new URL('./lib', url).href : 'Global';
}

/** Adaptador aislado: los listeners y recursos pertenecen a este iframe. */
export function start(initial: MessageEvent) {
  const args = videoJoinSchema.parse(initial.data.detail);
  const client = ZoomVideo.createClient();
  const rooms=academicRooms(client);
  let roomPlanReceived=false;
  const nonce = location.hash.slice(1), origin = initial.origin;
  const status = document.getElementById('status')!, root = document.getElementById('meeting')!;
  const emit = (type: string, detail?: unknown) => parent.postMessage({ source: 'soflia-zoom', nonce, type, detail }, origin === 'null' ? '*' : origin);
  let joined = false, disposed = false, audio = false, camera = false, shared = false, remoteShare = 0;
  let captionsEnabled = false;
  let recordingTimer: ReturnType<typeof setTimeout> | undefined;
  let operations = Promise.resolve(), renders = Promise.resolve();
  const programAudio=receiveProgramAudio(emit);
  const sharing = manageZoomSharing(navigator.mediaDevices, active => { shared = active; emit('sharing', active); },programAudio.ready);
  let stream: ReturnType<typeof client.getMediaStream>;
  let devices:ReturnType<typeof callDevices>;
  let joinTask: Promise<void> = Promise.resolve();
  if (initial.data.presentation === 'instructor') document.documentElement.classList.add('instructor-video-document');
  root.classList.add('video-session', initial.data.presentation === 'participant' ? 'participant-presentation' : 'instructor-presentation');
  const grid = document.createElement('video-player-container'); grid.className = 'video-grid';
  const share = document.createElement('video-player-container'); share.className = 'video-share'; share.hidden = true;
  let preview = document.createElement('video') as HTMLVideoElement | HTMLCanvasElement;
  preview.className = 'share-preview'; preview.hidden = true;
  root.append(share, preview, grid);
  function failure(connect = false) {
    status.hidden = false; status.textContent = 'No se pudo completar la acción. Revisa los permisos del dispositivo y la conexión.';
    emit(connect ? 'error' : 'action-error');
  }
  async function checked(result: unknown) { const value = await result; if (value && typeof value === 'object' && ('type' in value || value instanceof Error)) throw new Error('Video SDK rechazó la acción.'); }
  function action(task: () => Promise<void>) {
    operations = operations.then(async () => { if (joined && !disposed) { await task(); media(); } }).catch(() => failure());
  }
  async function toggleMicrophone() {
    if (!audio) { await checked(stream.startAudio(devices.audioOptions())); audio = true; }
    else if (client.getCurrentUserInfo()?.muted) await checked(stream.unmuteAudio());
    else await checked(stream.muteAudio());
  }
  async function startShare() {
    if (shared) return;
    preview.hidden = false;
    try { await checked(stream.startShareScreen(preview)); }
    catch (error) { sharing.stop(); preview.hidden = true; throw error; }
  }
  function media() {
    const user = client.getCurrentUserInfo(); camera = !!user?.bVideoOn;
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
  function reportVisual() { emit('visual', { cameras: videos.size > 0, remoteShare: !!remoteShare }); }
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
      reportVisual(); media();
    }).catch(() => { if (!disposed) failure(); });
  }
  async function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(recordingTimer); sharing.dispose(); programAudio.close(); window.removeEventListener('message', receive);
    try { await joinTask; await operations; await renders; if (joined) await checked(client.leave()); }
    catch { /* La destrucción del cliente libera los recursos aunque la red falle. */ }
    finally { joined = false; await ZoomVideo.destroyClient(); root.replaceChildren(); emit('disconnected'); }
  }
  function receive(event: MessageEvent) {
    if (event.source !== parent || event.origin !== origin || event.data?.nonce !== nonce || event.data?.source !== 'soflia-studio') return;
    const { type, detail } = event.data;
    if (type === 'set-view' && initial.data.presentation === 'instructor') {
      const view = studioCallViewSchema.safeParse(detail);
      if (view.success) root.dataset.view = view.data;
      return;
    }
    if(type==='program-audio-stop'){programAudio.close();return;}
    if(type==='program-audio-pending'){if(joined&&!disposed)try{programAudio.expect(detail);}catch{failure();}return;}
    if(type==='program-audio-offer'){if(joined&&!disposed)void programAudio.offer(detail).catch(()=>{if(!disposed)failure();});return;}
    if (type === 'leave') void dispose();
    else if (type === 'start-share') action(startShare);
    else if (type === 'stop-share') { sharing.stop(); action(stopShare); }
    else if (type === 'mute') action(async () => { if (audio) await checked(detail ? stream.muteAudio() : stream.unmuteAudio()); });
    else if (type === 'toggle-mic') action(toggleMicrophone);
    else if (type === 'toggle-camera') action(async () => {
      if (camera) await checked(stream.stopVideo());
      else await checked(stream.startVideo(devices.videoOptions()));
    });
    else if (type === 'get-devices') action(async()=>{reportDevices();});
    else if (type === 'select-device') action(async()=>{await devices.select(detail);});
    else if (type === 'captions' && typeof detail === 'boolean') action(async () => {
      const transcription = client.getLiveTranscriptionClient();
      const state = transcription.getLiveTranscriptionStatus();
      if (detail && (!state.isLiveTranscriptionEnabled || state.isHostDisableCaptions)) throw new Error('Subtítulos no disponibles.');
      if (detail) await checked(transcription.startLiveTranscription());
      captionsEnabled = detail; controls();
    });
    else if(type==='sync-rooms')action(async()=>{rooms.setPlan(detail);roomPlanReceived=true;emit('rooms-status',await rooms.sync());});
    else if(type==='visit-room')action(async()=>{
      const room=detail?.room_id,request=detail?.request_id;
      if(typeof request!=='string'||!/^[-a-f0-9]{36}$/.test(request)||room!==null&&(typeof room!=='string'||!/^[-a-f0-9]{36}$/.test(room)))throw new Error('Sala inválida.');
      await rooms.visit(room);emit('room-joined',{room_id:room,request_id:request});
    });
  }
  window.addEventListener('message', receive);
  window.addEventListener('pagehide', () => { void dispose(); }, { once: true });
  client.on('connection-change', event => { if (event.state === 'Closed' || event.state === 'Fail') void dispose(); });
  for (const name of ['user-added', 'user-updated', 'user-removed', 'peer-video-state-change']) client.on(name, render);
  for(const name of ['user-added','main-session-user-updated','subsession-state-change'] as const)client.on(name,()=>{
    if(roomPlanReceived&&!disposed&&joined)action(async()=>{emit('rooms-status',await rooms.sync());});
  });
  client.on('device-change',()=>{if(joined&&!disposed)reportDevices();});
  for (const name of ['caption-status', 'caption-enable', 'caption-host-disable'] as const) client.on(name, () => { if (joined && !disposed) controls(); });
  client.on('caption-message', event => {
    if (captionsEnabled && !disposed) emit('caption', { text: event.text.slice(0, 2000), speaker: event.displayName.slice(0, 160) });
  });
  client.on('recording-change', value => {
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
      share.hidden = !remoteShare; root.classList.toggle('has-remote-share', !!remoteShare); reportVisual();
    }).catch(() => failure());
  });
  joinTask = (async () => {
    try {
      await checked(client.init('es-ES', videoAssetSource(location.href), { patchJsMedia: false, leaveOnPageUnload: true }));
      if (disposed) return;
      await checked(client.join(args.sessionName, args.token, args.userName, args.password));
      joined = true; stream = client.getMediaStream();
      devices=callDevices(stream,()=>({audio,camera}),checked);
      if (disposed) return;
      const capture = document.createElement(stream.isStartShareScreenWithVideoElement() ? 'video' : 'canvas') as HTMLVideoElement | HTMLCanvasElement;
      capture.className = 'share-preview'; capture.hidden = true; preview.replaceWith(capture); preview = capture;
      status.hidden = true; emit('connected'); render();
      const currentRecording = client.getRecordingClient().getCloudRecordingStatus();
      if (currentRecording === 'Recording' || currentRecording === 'Paused') emit('recording', currentRecording);
      recordingTimer = setTimeout(() => {
        if (joined && !disposed && client.getRecordingClient().getCloudRecordingStatus() !== 'Recording') {
          emit('recording-error');
        }
      }, 15000);
    } catch { if (!disposed) { failure(true); void dispose(); } }
  })();
}
