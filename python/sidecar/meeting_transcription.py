# =============================================================================
# Pulse Hub - Transcripcion de reuniones en vivo (sidecar Python)
# =============================================================================
# El sidecar NO captura audio de reunion: Electron (Chromium) es quien tiene la
# API multiplataforma de loopback (Windows/macOS/Linux) y envia aqui chunks PCM
# int16 mono 16kHz en base64 por dos fuentes:
#   - "mic":     el microfono del usuario (habla el usuario)
#   - "system":  loopback del sistema (hablan los demas participantes)
#
# Este modulo solo segmenta, filtra silencio y transcribe con faster-whisper
# (import perezoso: su ausencia no debe romper la voz Vosk/Piper existente).
#
# Eventos emitidos (stdout NDJSON):
#   {"event": "meeting_segment", "session_id", "source", "text", "t0_ms", "t1_ms"}
#   {"event": "meeting_error",   "session_id", "message"}
# =============================================================================
import base64
import threading
import time

SAMPLE_RATE = 16000
BYTES_PER_SECOND = SAMPLE_RATE * 2  # PCM int16 mono

# Ventanas de transcripcion: lo bastante largas para dar contexto a Whisper,
# lo bastante cortas para que la transcripcion se sienta "en vivo".
MIN_WINDOW_SECONDS = 4.0
MAX_WINDOW_SECONDS = 12.0
TRAILING_SILENCE_SECONDS = 0.7
# RMS int16 por debajo del cual un bloque se considera silencio (~-42 dBFS).
SILENCE_RMS_THRESHOLD = 250

_whisper_models: dict = {}
_whisper_models_lock = threading.Lock()


def whisper_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except Exception:
        return False


def speaker_diarization_available() -> bool:
    try:
        import sherpa_onnx  # noqa: F401
        return True
    except Exception:
        return False


def _get_whisper_model(model_size: str, download_root: str):
    """Carga (una sola vez por tamaño) el modelo faster-whisper en int8/CPU."""
    from faster_whisper import WhisperModel

    key = f"{model_size}|{download_root}"
    with _whisper_models_lock:
        if key not in _whisper_models:
            _whisper_models[key] = WhisperModel(
                model_size,
                device="cpu",
                compute_type="int8",
                download_root=download_root or None,
            )
        return _whisper_models[key]


def preload_model(model_size: str, download_root: str) -> None:
    """Precalienta el modelo en segundo plano (descarga + carga en memoria).

    Sin esto, la primera ventana de la reunion pagaria la descarga (~480MB en
    "small") y la carga del modelo, retrasando todos los segmentos en cola.
    """
    try:
        _get_whisper_model(model_size, download_root)
    except Exception:  # noqa: BLE001 — el worker reportara el error real al transcribir
        pass


def _rms_int16(pcm: bytes) -> float:
    """RMS de un bloque PCM int16 little-endian sin depender de numpy."""
    import array

    samples = array.array("h")
    samples.frombytes(pcm[: len(pcm) - (len(pcm) % 2)])
    if not samples:
        return 0.0
    total = 0
    for value in samples:
        total += value * value
    return (total / len(samples)) ** 0.5


def _default_transcribe(pcm: bytes, language: str, model_size: str, download_root: str,
                        initial_prompt: str = "") -> str:
    """Transcribe un bloque PCM int16 16kHz mono y devuelve el texto plano."""
    # numpy llega como dependencia transitiva de faster-whisper/ctranslate2.
    import numpy as np

    model = _get_whisper_model(model_size, download_root)
    audio = np.frombuffer(pcm[: len(pcm) - (len(pcm) % 2)], dtype=np.int16).astype(np.float32) / 32768.0
    segments, _info = model.transcribe(
        audio,
        language=language,
        beam_size=1,          # latencia sobre precision marginal en vivo
        vad_filter=True,      # descarta silencios internos de la ventana
        condition_on_previous_text=False,  # evita alucinaciones en ventanas cortas
        # Sesga el vocabulario hacia el dominio (titulo de la reunion, marca,
        # terminos frecuentes) sin condicionar en texto previo.
        initial_prompt=initial_prompt or None,
    )
    return " ".join(segment.text.strip() for segment in segments).strip()


def _default_embed_factory(model_path: str):
    """Extractor de embeddings de voz (sherpa-onnx CAM++, 192 dims, 16kHz)."""
    import numpy as np
    import sherpa_onnx

    config = sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=model_path, num_threads=1)
    extractor = sherpa_onnx.SpeakerEmbeddingExtractor(config)

    def embed(pcm: bytes) -> list:
        samples = np.frombuffer(pcm[: len(pcm) - (len(pcm) % 2)], dtype=np.int16).astype(np.float32) / 32768.0
        stream = extractor.create_stream()
        stream.accept_waveform(sample_rate=SAMPLE_RATE, waveform=samples)
        stream.input_finished()
        return list(extractor.compute(stream))

    return embed


class SpeakerLabeler:
    """Diarizacion incremental por ventana: embedding + clustering de centroides.

    Cada ventana transcrita del canal del sistema recibe un embedding de voz;
    se compara (coseno) contra los centroides conocidos: si supera el umbral se
    asigna ese hablante (y el centroide se refina como media movil), si no,
    nace "participante-N". Aproximacion valida para reuniones por turnos; una
    ventana con dos voces mezcladas se etiqueta con la voz dominante.
    `embed_fn` es inyectable para pruebas sin modelo real.
    """

    def __init__(self, model_path: str = "", similarity_threshold: float = 0.40,
                 embed_fn=None):
        self._embed = embed_fn or _default_embed_factory(model_path)
        self._threshold = similarity_threshold
        self._centroids: list[list[float]] = []
        self._counts: list[int] = []

    @staticmethod
    def _cosine(a: list, b: list) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(y * y for y in b) ** 0.5
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return dot / (norm_a * norm_b)

    def label_index(self, pcm: bytes) -> int:
        """Indice estable (0-based) de la huella de voz de esta ventana."""
        embedding = self._embed(pcm)
        best_index = -1
        best_score = -1.0
        for index, centroid in enumerate(self._centroids):
            score = self._cosine(embedding, centroid)
            if score > best_score:
                best_score = score
                best_index = index
        if best_index >= 0 and best_score >= self._threshold:
            count = self._counts[best_index]
            self._centroids[best_index] = [
                (c * count + e) / (count + 1)
                for c, e in zip(self._centroids[best_index], embedding)
            ]
            self._counts[best_index] = count + 1
            return best_index
        self._centroids.append(list(embedding))
        self._counts.append(1)
        return len(self._centroids) - 1

    def label(self, pcm: bytes) -> str:
        """Devuelve la etiqueta estable del hablante para esta ventana."""
        return f"participante-{self.label_index(pcm) + 1}"


class _SourceBuffer:
    """Acumula PCM de una fuente y decide cuando hay una ventana transcribible."""

    def __init__(self, source: str):
        self.source = source
        self.chunks: list[bytes] = []
        self.buffered_bytes = 0
        self.window_start_ms = 0
        self.total_ms = 0
        self.trailing_silence_ms = 0.0

    def append(self, pcm: bytes) -> None:
        chunk_ms = len(pcm) / BYTES_PER_SECOND * 1000.0
        self.total_ms += chunk_ms
        if _rms_int16(pcm) < SILENCE_RMS_THRESHOLD:
            self.trailing_silence_ms += chunk_ms
        else:
            self.trailing_silence_ms = 0.0
        self.chunks.append(pcm)
        self.buffered_bytes += len(pcm)

    def should_flush(self) -> bool:
        seconds = self.buffered_bytes / BYTES_PER_SECOND
        if seconds >= MAX_WINDOW_SECONDS:
            return True
        return (
            seconds >= MIN_WINDOW_SECONDS
            and self.trailing_silence_ms >= TRAILING_SILENCE_SECONDS * 1000.0
        )

    def take_window(self) -> tuple[bytes, int, int]:
        """Extrae la ventana acumulada y devuelve (pcm, t0_ms, t1_ms)."""
        pcm = b"".join(self.chunks)
        t0 = self.window_start_ms
        t1 = int(self.total_ms)
        self.chunks = []
        self.buffered_bytes = 0
        self.window_start_ms = t1
        self.trailing_silence_ms = 0.0
        return pcm, t0, t1


class MeetingTranscriber:
    """Sesion de transcripcion en vivo: 2 fuentes, un worker de inferencia.

    Un solo hilo de inferencia serializa el uso del modelo (CPU-bound); las
    ventanas se encolan y los eventos salen en orden por fuente. `transcribe_fn`
    es inyectable para pruebas sin modelo real.
    """

    def __init__(self, session_id: str, emit_fn, language: str = "es",
                 model_size: str = "small", download_root: str = "",
                 transcribe_fn=None, speaker_labeler=None, initial_prompt: str = ""):
        self.session_id = session_id
        self._emit = emit_fn
        self._language = language
        self._model_size = model_size
        self._download_root = download_root
        self._transcribe = transcribe_fn or (
            lambda pcm: _default_transcribe(pcm, language, model_size, download_root, initial_prompt)
        )
        # Diarizacion por huella de voz en AMBOS canales. En el microfono
        # tambien: si los participantes remotos suenan por bocinas, sus voces
        # entran por el mic y deben separarse igual (no todo el mic es el
        # usuario). La primera huella del mic que no aparezca en el canal del
        # sistema se asume como el usuario; sin labeler se cae al esquema
        # simple (mic="usuario", system="participantes").
        self._speaker_labeler = speaker_labeler
        self._user_speaker_index: int | None = None
        self._system_speaker_indices: set[int] = set()
        self._buffers = {"mic": _SourceBuffer("mic"), "system": _SourceBuffer("system")}
        self._queue: list[tuple[str, bytes, int, int]] = []
        self._queue_lock = threading.Lock()
        self._queue_signal = threading.Event()
        self._stopping = False
        self._worker = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker.start()
        self.segments_count = 0

    def push_audio(self, source: str, audio_b64: str) -> None:
        buffer = self._buffers.get(source)
        if buffer is None or self._stopping:
            return
        buffer.append(base64.b64decode(audio_b64))
        if buffer.should_flush():
            self._enqueue_window(buffer)

    def stop(self, drain_timeout_seconds: float = 30.0) -> int:
        """Vuelca lo pendiente, espera al worker y devuelve el total de segmentos."""
        for buffer in self._buffers.values():
            if buffer.buffered_bytes > 0:
                self._enqueue_window(buffer)
        self._stopping = True
        self._queue_signal.set()
        self._worker.join(timeout=drain_timeout_seconds)
        return self.segments_count

    def _resolve_speaker(self, source: str, pcm: bytes) -> str:
        if self._speaker_labeler is None:
            return "usuario" if source == "mic" else "participantes"
        try:
            index = self._speaker_labeler.label_index(pcm)
        except Exception:  # noqa: BLE001 — sin diarizacion se degrada a etiqueta simple
            return "usuario" if source == "mic" else "participantes"

        if source == "system":
            self._system_speaker_indices.add(index)
            if index == self._user_speaker_index:
                # La huella que creiamos del usuario suena en el canal remoto:
                # era una voz remota colada por bocinas. Liberar el puesto para
                # que la voz local real pueda reclamarlo despues.
                self._user_speaker_index = None
            return f"participante-{index + 1}"

        # Canal del microfono.
        if index in self._system_speaker_indices:
            return f"participante-{index + 1}"  # sangrado de bocinas: voz remota
        if self._user_speaker_index is None:
            self._user_speaker_index = index
            return "usuario"
        if index == self._user_speaker_index:
            return "usuario"
        return f"participante-{index + 1}"

    def _enqueue_window(self, buffer: _SourceBuffer) -> None:
        pcm, t0, t1 = buffer.take_window()
        # Ventanas de puro silencio no merecen inferencia (ahorro de CPU).
        if _rms_int16(pcm) < SILENCE_RMS_THRESHOLD:
            return
        with self._queue_lock:
            self._queue.append((buffer.source, pcm, t0, t1))
        self._queue_signal.set()

    def _worker_loop(self) -> None:
        while True:
            with self._queue_lock:
                item = self._queue.pop(0) if self._queue else None
            if item is None:
                if self._stopping:
                    return
                self._queue_signal.wait(timeout=0.2)
                self._queue_signal.clear()
                continue
            source, pcm, t0, t1 = item
            try:
                started = time.monotonic()
                text = self._transcribe(pcm)
                if text:
                    self.segments_count += 1
                    self._emit({
                        "event": "meeting_segment",
                        "session_id": self.session_id,
                        "source": source,
                        "speaker": self._resolve_speaker(source, pcm),
                        "text": text,
                        "t0_ms": t0,
                        "t1_ms": t1,
                        "inference_ms": int((time.monotonic() - started) * 1000),
                    })
            except Exception as exc:  # noqa: BLE001 — un fallo no debe matar la sesion
                self._emit({
                    "event": "meeting_error",
                    "session_id": self.session_id,
                    "message": f"{type(exc).__name__}: {exc}",
                })
