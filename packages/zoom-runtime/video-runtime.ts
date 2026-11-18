import { ZoomVideo, VideoQuality } from './video-client';
import { videoJoinSchema } from '../../src/shared/live-studio.contract';
import { studioCallViewSchema } from '../../src/shared/studio-call';
import { manageZoomSharing } from './share-lifecycle';
import { callDevices } from './call-devices';
import { academicRooms } from './academic-rooms';
import { receiveProgramAudio } from './program-audio';
import { peopleInVideoRoom, roomVideoContext, roomVideoPage } from './room-video-context';

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
  const paging = document.createElement('nav'); paging.className = 'video-grid-paging'; paging.hidden = true;
  paging.setAttribute('aria-label', 'Páginas de la galería');
  const previous = document.createElement('button'), next = document.createElement('button'), pageLabel = document.createElement('span');
  previous.textContent = 'Anterior'; next.textContent = 'Siguiente'; pageLabel.setAttribute('role', 'status');
  paging.append(previous, pageLabel, next);
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
  let publishedRoom: string | null | undefined;
  let switchingRoom = false;
  const currentSubsession = () => client.getSubsessionClient().getCurrentSubsession();
  const currentRoom = () => switchingRoom ? undefined : roomVideoContext(currentSubsession());
  function reportVisual() { emit('visual', { cameras: videos.size > 0, remoteShare: !!remoteShare, roomId: publishedRoom }); }
  async function stopShare() {
    sharing.stop(); preview.hidden = true;
    if (joined) await checked(stream.stopShareScreen());
    media();
  }
  const videos = new Map<number, HTMLElement>();
  let galleryRoom: string | null | undefined, page = 0;
  previous.onclick = () => { page--; render(); };
  next.onclick = () => { page++; render(); };

  function render() {
    renders = renders.then(async () => {
      if (!joined || disposed) return;
      const subsession = currentSubsession();
      const scope = switchingRoom ? undefined : roomVideoContext(subsession);
      if (scope !== galleryRoom) {
        publishedRoom = undefined; galleryRoom = scope; page = 0;
        grid.replaceChildren(); paging.remove();
        share.hidden = true; root.classList.remove('has-remote-share');
        reportVisual();
        const staleIds = [...videos.keys()]; videos.clear();
        await Promise.allSettled(staleIds.map(id => stream.detachVideo(id)));
        if (remoteShare) { const staleShare = remoteShare; remoteShare = 0; share.replaceChildren(); await stream.detachShareView(staleShare); }
      }
      if (scope === undefined || disposed || scope !== currentRoom()) return;
      root.classList.toggle('room-presentation', !!scope);
      const self = client.getCurrentUserInfo()?.userId;
      const users = [...new Map(client.getAllUser().map(user => [user.userId, user])).values()];
      const residents = scope && client.getSubsessionClient().getSubsessionList().find(room => room.subsessionId === subsession.subsessionId);
      const joinedGuids = new Set(residents ? residents.userList.flatMap(user => user.isInSubsession && user.userGuid ? [user.userGuid] : []) : []);
      const candidates = scope ? peopleInVideoRoom(users, subsession.subsessionId, self, joinedGuids) : users.filter(user => user.bVideoOn && !user.subsessionId);
      candidates.sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.userId - b.userId);
      const selection = roomVideoPage(candidates, scope ? page : 0);
      page = selection.page;
      const visible = selection.people;
      if (scope && selection.pages > 1) {
        paging.hidden = false;
        if (!paging.isConnected) root.append(paging);
      } else paging.remove();
      previous.disabled = page === 0; next.disabled = page + 1 >= selection.pages;
      pageLabel.textContent = `Página ${page + 1} de ${selection.pages}`;
      const cameraIds = new Set(visible.filter(user => user.bVideoOn).map(user => user.userId));
      for (const [id, player] of videos) {
        if (cameraIds.has(id)) continue;
        player.remove(); videos.delete(id);
        await stream.detachVideo(id);
      }
      let position = 0;
      for (const user of visible) {
        if (disposed || scope !== currentRoom()) return;
        if (videos.has(user.userId) || !user.bVideoOn) continue;
        try {
          const player = await stream.attachVideo(user.userId, VideoQuality.Video_360P);
          if (!(player instanceof HTMLElement)) continue;
          if (disposed || scope !== currentRoom()) { await stream.detachVideo(user.userId); return; }
          videos.set(user.userId, player);
        } catch { /* Una cámara que no se puede cargar conserva su ficha. */ }
      }
      if (disposed || scope !== currentRoom()) return;
      const displayed = new Set(visible.map(user => String(user.userId)));
      for (const tile of Array.from(grid.children)) if (!displayed.has((tile as HTMLElement).dataset.userId ?? '')) tile.remove();
      for (const user of visible) {
        const id = String(user.userId);
        const tile = grid.querySelector<HTMLElement>(`[data-user-id="${id}"]`) ?? document.createElement('div');
        tile.dataset.userId = id; tile.className = 'video-tile';
        const player = videos.get(user.userId);
        const person = document.createElement('span'); person.className = 'video-tile-name';
        person.textContent = `${user.displayName}${scope && user.userId === self ? ' (tú)' : ''}${scope && user.muted ? ' · Silenciado' : ''}`;
        if (!player && scope) {
          const initial = document.createElement('div'); initial.className = 'video-tile-initial';
          initial.textContent = user.displayName.slice(0, 1).toLocaleUpperCase(); initial.setAttribute('aria-hidden', 'true');
          tile.replaceChildren(initial, person);
        } else if (player) {
          if (tile.firstChild !== player) tile.replaceChildren(player, person);
          else tile.querySelector('.video-tile-name')?.replaceWith(person);
        }
        if (tile.firstChild) {
          const atPosition = grid.children.item(position++);
          if (atPosition !== tile) grid.insertBefore(tile, atPosition);
        }
      }
      publishedRoom = scope;
      grid.style.visibility = '';
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
      await rooms.visit(room);render();emit('room-joined',{room_id:room,request_id:request});
    });
  }
  window.addEventListener('message', receive);
  window.addEventListener('pagehide', () => { void dispose(); }, { once: true });
  client.on('connection-change', event => {
    if (event.state === 'Closed' || event.state === 'Fail') { void dispose(); return; }
    if (event.state === 'Reconnecting' && ['join breakout room', 'move to breakout room', 'back to main session'].includes(event.reason ?? '')) {
      switchingRoom = true;
      grid.style.visibility = 'hidden';
      share.hidden = true;
      publishedRoom = undefined;
      reportVisual();
    }
    if (event.state === 'Connected') switchingRoom = false;
    if (joined && !disposed) render();
  });
  for (const name of ['user-added', 'user-updated', 'user-removed', 'peer-video-state-change']) client.on(name, render);
  client.on('subsession-user-update', render);
  client.on('subsession-state-change', render);
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
    if (!joined || disposed) return;
    const scope = currentRoom();
    if (scope === undefined) return;
    renders = renders.then(async () => {
      if (!joined || disposed || scope !== currentRoom()) return;
      if (remoteShare) { await stream.detachShareView(remoteShare); remoteShare = 0; share.replaceChildren(); }
      if (event.state === 'Active') {
        const player = await stream.attachShareView(event.userId);
        if (player instanceof HTMLElement) {
          if (disposed || scope !== currentRoom()) { await stream.detachShareView(event.userId); return; }
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
      recordingTimer = setTimeout(async () => {
        if (!joined || disposed) return;
        const recording = client.getRecordingClient();
        const state = recording.getCloudRecordingStatus();
        if (state === 'Recording' || state === 'Paused') {
          emit('recording', state);
          return;
        }
        try {
          if (!args.recording_required || !client.getCurrentUserInfo()?.isHost || !recording.canStartRecording()) {
            emit('recording-error');
            return;
          }
          await checked(recording.startCloudRecording());
          if (disposed) return;
          recordingTimer = setTimeout(() => {
            if (!joined || disposed) return;
            const state = recording.getCloudRecordingStatus();
            if (state === 'Recording') emit('recording', state);
            else emit('recording-error');
          }, 8000);
        } catch { if (!disposed) emit('recording-error'); }
      }, 7000);
    } catch { if (!disposed) { failure(true); void dispose(); } }
  })();
}
