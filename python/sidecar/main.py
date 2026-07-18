# =============================================================================
# SofLIA Hub - Sidecar Python (voz 100% local: Vosk STT + Piper TTS)
# =============================================================================
# Proceso hijo lanzado por PythonRuntimeService (Electron main). Se comunica
# por NDJSON sobre stdin/stdout:
#
#   Peticiones (stdin):  {"id": 1, "cmd": "ping"}
#                        {"id": 2, "cmd": "start_wake", "params": {...}}
#                        {"id": 3, "cmd": "start_dictation", "params": {...}}
#                        {"id": 4, "cmd": "tts_speak", "params": {...}}
#   Respuestas (stdout): {"id": 1, "ok": true, ...}
#   Eventos (stdout):    {"event": "wake_word", "text": "oye soflia"}
#                        {"event": "dictation_partial", "text": "..."}
#                        {"event": "dictation_final", "text": "..."}
#                        {"event": "tts_chunk", "audio_b64": "...", "sample_rate": 22050}
#
# Modos de escucha (Vosk, exclusivos entre si — el que arranca detiene al otro):
#   - wake: gramatica restringida a las wake words (CPU minima, 24/7)
#   - dictation: reconocimiento libre en español con partials + final por silencio
# Habla (Piper): sintesis local por frases; el audio viaja en base64 al renderer,
# que lo reproduce con WebAudio y lo analiza (meyda) para animar la orbe.
# =============================================================================
import base64
import json
import os
import queue
import re
import sys
import threading
import time
import unicodedata

# El runtime Python EMBEBIDO (python3xx._pth) reemplaza sys.path y NO incluye
# el directorio del script: sin esta linea, los modulos hermanos del sidecar
# (meeting_transcription) no se pueden importar.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PROTOCOL_VERSION = 4

DEFAULT_DICTATION_SILENCE_MS = 1800
DEFAULT_DICTATION_INITIAL_SILENCE_MS = 8000
DEFAULT_DICTATION_MAX_MS = 45000

_stdout_lock = threading.Lock()
_wake_listener = None
_dictation_listener = None
_tts_speaker = None
_meeting_transcriber = None

# Los modelos Vosk tardan segundos en cargar: cache global por ruta.
_vosk_models: dict = {}
_vosk_models_lock = threading.Lock()


def emit(payload: dict) -> None:
    """Escribe una linea NDJSON a stdout de forma thread-safe."""
    with _stdout_lock:
        sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def normalize_spoken_phrase(text: str) -> str:
    """Normaliza voz/config para comparar sin depender de acentos o signos."""
    decomposed = unicodedata.normalize("NFKD", str(text)).casefold()
    without_marks = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
    words_only = "".join(c if c.isalnum() else " " for c in without_marks)
    return " ".join(words_only.split())


def clean_grammar_phrase(text: str) -> str:
    """Limpia signos conservando los acentos que forman parte del vocabulario."""
    normalized = unicodedata.normalize("NFKC", str(text)).casefold()
    words_only = "".join(c if c.isalnum() else " " for c in normalized)
    return " ".join(words_only.split())


# "soflia" es una marca, no una palabra del vocabulario español de Vosk.
# La gramatica recibe solo pronunciaciones confirmadas en el modelo local.
WAKE_TOKEN_ALIASES = {
    # El modelo small-es reconoce la pronunciacion de marca del usuario como
    # "suplía". Todas estas formas existen en su vocabulario local.
    "soflia": ("sofía", "sofia", "suplía"),
    "sofia": ("sofía", "sofia", "suplía"),
    "suplia": ("suplía", "sofía", "sofia"),
    "lia": ("lía", "lia"),
}
WAKE_OPTIONAL_PREFIXES = ("oye", "hola", "hey", "ey")


def expand_wake_words(wake_words: list) -> tuple[list[str], set[str]]:
    """Devuelve gramatica Vosk valida y sus frases canonicas para matching.

    Los prefijos conversacionales se agregan aunque la configuracion solo tenga
    ``soflia``. Las variantes se deduplican sin introducir el token OOV de marca.
    """
    grammar_phrases: list[str] = []
    seen_grammar: set[str] = set()
    match_set: set[str] = set()

    def add_variant(variant: str) -> None:
        if not variant or variant in seen_grammar:
            return
        seen_grammar.add(variant)
        grammar_phrases.append(variant)
        match_set.add(normalize_spoken_phrase(variant))

    for raw_phrase in wake_words:
        phrase = clean_grammar_phrase(raw_phrase)
        if not phrase:
            continue
        tokens = phrase.split()
        canonical_tokens = [normalize_spoken_phrase(token) for token in tokens]

        # Un prefijo configurado no debe impedir usar los demas ni decir solo
        # el nombre. Tambien se corrige la antigua variante OOV "sof lia".
        if canonical_tokens and canonical_tokens[0] in WAKE_OPTIONAL_PREFIXES:
            tokens = tokens[1:]
            canonical_tokens = canonical_tokens[1:]
        if canonical_tokens == ["sof", "lia"]:
            tokens = ["soflia"]
            canonical_tokens = ["soflia"]
        if not tokens:
            continue

        base_variants = [""]
        for token, canonical in zip(tokens, canonical_tokens):
            options = WAKE_TOKEN_ALIASES.get(canonical, (token,))
            base_variants = [
                " ".join(part for part in (prefix, option) if part)
                for prefix in base_variants
                for option in options
            ]

        for base_variant in base_variants:
            add_variant(base_variant)
            for prefix in WAKE_OPTIONAL_PREFIXES:
                add_variant(f"{prefix} {base_variant}")

    return grammar_phrases, match_set


def get_vosk_model(model_path: str):
    """Carga (una sola vez) y devuelve el modelo Vosk para la ruta dada."""
    from vosk import Model, SetLogLevel

    SetLogLevel(-1)  # Silenciar logs internos de Vosk (contaminan stdout/stderr)
    with _vosk_models_lock:
        if model_path not in _vosk_models:
            _vosk_models[model_path] = Model(model_path)
        return _vosk_models[model_path]


class MicStream:
    """Stream de microfono para los listeners; entrega SIEMPRE 16kHz mono int16.

    Los dispositivos WASAPI no adaptan tasa/canales (PaErrorCode -9997/-9998 al
    pedir 16k mono): si la apertura directa falla, se captura a la tasa y canales
    NATIVOS del dispositivo y se convierte (downmix + resample) antes de encolar.
    """

    def __init__(self, sample_rate: int, device=None, blocksize: int = 4000):
        import sounddevice as sd

        self.audio_queue: "queue.Queue[bytes]" = queue.Queue()
        self._target_rate = sample_rate
        self._native_rate = sample_rate
        self._channels = 1
        self._ratecv_state = None

        def audio_callback(indata, _frames, _time, status):
            if status:
                emit({"event": "audio_status", "message": str(status)})
            self.audio_queue.put(self._to_target_format(bytes(indata)))

        try:
            # Intento directo (MME y la mayoria de dispositivos lo aceptan).
            self._stream = sd.RawInputStream(
                samplerate=sample_rate, blocksize=blocksize, device=device,
                dtype="int16", channels=1, callback=audio_callback,
            )
        except Exception:
            # Fallback WASAPI: abrir en formato nativo y convertir en el callback.
            info = sd.query_devices(device if device is not None else sd.default.device[0])
            self._native_rate = int(info.get("default_samplerate") or 48000)
            self._channels = max(1, min(2, int(info.get("max_input_channels") or 1)))
            native_blocksize = max(1, int(blocksize * self._native_rate / sample_rate))
            self._stream = sd.RawInputStream(
                samplerate=self._native_rate, blocksize=native_blocksize, device=device,
                dtype="int16", channels=self._channels, callback=audio_callback,
            )
        self._stream.start()

    def _to_target_format(self, data: bytes) -> bytes:
        if self._native_rate == self._target_rate and self._channels == 1:
            return data
        import audioop  # disponible en el runtime embebido (Python 3.12 fijado)

        if self._channels == 2:
            data = audioop.tomono(data, 2, 0.5, 0.5)
        if self._native_rate != self._target_rate:
            data, self._ratecv_state = audioop.ratecv(
                data, 2, 1, self._native_rate, self._target_rate, self._ratecv_state,
            )
        return data

    def close(self) -> None:
        try:
            self._stream.stop()
            self._stream.close()
        except Exception:
            pass


class WakeListener:
    """Escucha pasiva con gramatica restringida y validacion temporal.

    La frase debe comenzar el resultado (con prefijo opcional), pero puede ir
    seguida inmediatamente por la peticion del usuario. La confianza, duracion
    y cercania al onset siguen filtrando decodes forzados por la gramatica.
    """

    MIN_WORD_SECONDS = 0.12
    MAX_WORD_SECONDS = 1.6
    MAX_SECONDS_AFTER_ONSET = 1.8  # tolera prefijo y una diccion mas pausada
    SPEECH_RMS_THRESHOLD = 300     # energia minima para considerar "habla" (int16)
    QUIET_CHUNKS_FOR_RESET = 3     # ~0.75s de silencio reinician el onset

    def __init__(self, model_path: str, wake_words: list, sample_rate: int = 16000,
                 device=None, min_confidence: float = 0.45):
        self.model_path = model_path
        self.grammar_phrases, self.match_set = expand_wake_words(
            [w for w in wake_words if w and w.strip()] or ["soflia"],
        )
        # Mas largas primero para que "oye sofia" se evalúe antes que aliases
        # de un solo token cuando el reconocedor devuelve varias alternativas.
        self.match_phrases = sorted(
            {tuple(phrase.split()) for phrase in self.match_set},
            key=lambda phrase: (-len(phrase), phrase),
        )
        self.sample_rate = sample_rate
        self.device = device
        self.min_confidence = min_confidence
        self._stop_event = threading.Event()
        self._thread = None
        self._mic = None

    def start(self) -> None:
        from vosk import KaldiRecognizer

        model = get_vosk_model(self.model_path)
        grammar = json.dumps(self.grammar_phrases + ["[unk]"], ensure_ascii=False)
        recognizer = KaldiRecognizer(model, self.sample_rate, grammar)
        recognizer.SetWords(True)  # habilita conf/start/end por palabra
        # Permite activar al reconocer el nombre, sin esperar a que termine toda
        # la instruccion ("SofLIA, abre..."). Reduce la perdida del comando al
        # hacer el handoff del listener wake al dictado libre.
        if hasattr(recognizer, "SetPartialWords"):
            recognizer.SetPartialWords(True)
        self._mic = MicStream(self.sample_rate, self.device)
        self._thread = threading.Thread(target=self._run, args=(recognizer,), daemon=True)
        self._thread.start()
        emit({"event": "wake_started", "wake_words": self.grammar_phrases})

    def _evaluate_match(self, result: dict, speech_onset: float | None) -> tuple[bool, str]:
        entries = result.get("result") or result.get("partial_result") or []
        tokens = [normalize_spoken_phrase(e.get("word") or "") for e in entries]
        if not tokens:
            recognized_text = result.get("text") or result.get("partial") or ""
            text_tokens = tuple(normalize_spoken_phrase(recognized_text).split())
            if any(
                len(text_tokens) >= len(phrase) and text_tokens[:len(phrase)] == phrase
                for phrase in self.match_phrases
            ):
                return True, "text_fallback"
            return False, "no_entries_or_text_match"

        failures: list[str] = []
        for phrase in self.match_phrases:
            n = len(phrase)
            if len(tokens) < n or tuple(tokens[:n]) != phrase:
                continue
            wake_entries = entries[:n]
            # El prefijo es conversacional; la confianza/duracion critica es la
            # del nombre de activacion que viene despues.
            core_offset = 1 if phrase[0] in WAKE_OPTIONAL_PREFIXES and n > 1 else 0
            core_entries = wake_entries[core_offset:]
            if any(float(e.get("conf", 1.0)) < self.min_confidence for e in core_entries):
                failures.append("low_confidence")
                continue
            # El wake genuino arranca el burst de habla; un decode forzado desde
            # una frase larga aparece tarde dentro del burst. Sin onset medido
            # (mic muy bajo / AGC) no se rechaza por tiempo: quedan las demas reglas.
            if speech_onset is not None:
                seconds_after_onset = float(wake_entries[0].get("start", 0.0)) - speech_onset
                if seconds_after_onset > self.MAX_SECONDS_AFTER_ONSET:
                    failures.append("onset_too_late")
                    continue
            durations_ok = all(
                self.MIN_WORD_SECONDS <= float(e.get("end", 0)) - float(e.get("start", 0)) <= self.MAX_WORD_SECONDS
                for e in core_entries
            )
            if durations_ok:
                return True, "matched"
            failures.append("word_duration_out_of_range")

        if failures:
            return False, failures[0]
        return False, "wake_phrase_not_at_start"

    def _matches(self, result: dict, speech_onset: float | None) -> bool:
        """Compatibilidad para consumidores que solo necesitan el booleano."""
        return self._evaluate_match(result, speech_onset)[0]

    def _run(self, recognizer) -> None:
        import array

        stream_seconds = 0.0     # tiempo total de audio procesado (eje de Vosk)
        speech_onset = None      # inicio del burst de habla actual
        speaking = False
        quiet_chunks = 0
        wake_latched = False

        while not self._stop_event.is_set():
            try:
                data = self._mic.audio_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            # Deteccion de onset de habla por energia (submuestreo x4 por CPU).
            samples = array.array("h", data)
            subset = samples[::4]
            rms = (sum(s * s for s in subset) / len(subset)) ** 0.5 if len(subset) else 0.0
            if rms >= self.SPEECH_RMS_THRESHOLD:
                if not speaking:
                    speaking = True
                    speech_onset = stream_seconds
                quiet_chunks = 0
            else:
                quiet_chunks += 1
                if quiet_chunks >= self.QUIET_CHUNKS_FOR_RESET:
                    speaking = False
                    speech_onset = None
                    if wake_latched:
                        # Si main no hizo aun el handoff, permitir un nuevo intento
                        # despues de una pausa sin duplicar el mismo wake.
                        recognizer.Reset()
                        wake_latched = False
            stream_seconds += len(data) / 2 / self.sample_rate

            if recognizer.AcceptWaveform(data):
                result = json.loads(recognizer.Result())
                text = (result.get("text") or "").strip().lower()
                if not text:
                    continue
                if wake_latched:
                    recognizer.Reset()
                    continue
                matched, rejection_reason = self._evaluate_match(result, speech_onset)
                if matched:
                    emit({"event": "wake_word", "text": text})
                    wake_latched = True
                else:
                    # Diagnostico: candidato descartado (visible en logs del main).
                    emit({"event": "wake_rejected", "text": text, "reason": rejection_reason})
                recognizer.Reset()
            elif not wake_latched:
                partial_result = json.loads(recognizer.PartialResult())
                partial_text = (partial_result.get("partial") or "").strip().lower()
                if partial_text:
                    matched, _reason = self._evaluate_match(partial_result, speech_onset)
                    if matched:
                        emit({"event": "wake_word", "text": partial_text, "source": "partial"})
                        wake_latched = True
                        recognizer.Reset()

    def stop(self) -> None:
        self._stop_event.set()
        if self._mic is not None:
            self._mic.close()
            self._mic = None
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None
        emit({"event": "wake_stopped"})


def emit_dictation_event(event: str, session_id: str, **payload) -> None:
    """Emite un evento de dictado siempre correlacionado con su sesion."""
    emit({"event": event, "session_id": session_id, **payload})


class DictationListener:
    """Reconocimiento libre en español: partials en vivo + final por silencio.

    Los fines de frase que detecta Vosk (endpointing interno, ~0.8s de pausa)
    NO finalizan el dictado: se acumulan como SEGMENTOS y se sigue escuchando.
    Asi el usuario puede hacer pausas para pensar sin que se corte su peticion.

    Finaliza cuando:
      - hay texto acumulado y pasan `silence_ms` sin habla nueva (pausa real), o
      - no se detecta habla en `initial_silence_ms`, o
      - se alcanza `max_ms` (finaliza con lo acumulado).
    """

    def __init__(self, model_path: str, sample_rate: int = 16000, device=None,
                 silence_ms: int = DEFAULT_DICTATION_SILENCE_MS,
                 initial_silence_ms: int = DEFAULT_DICTATION_INITIAL_SILENCE_MS,
                 max_ms: int = DEFAULT_DICTATION_MAX_MS, session_id: str = ""):
        self.model_path = model_path
        self.sample_rate = sample_rate
        self.device = device
        self.silence_ms = silence_ms
        self.initial_silence_ms = initial_silence_ms
        self.max_ms = max_ms
        self.session_id = str(session_id or "")
        self._stop_event = threading.Event()
        self._thread = None
        self._mic = None

    def start(self) -> None:
        from vosk import KaldiRecognizer

        model = get_vosk_model(self.model_path)
        recognizer = KaldiRecognizer(model, self.sample_rate)
        self._mic = MicStream(self.sample_rate, self.device)
        self._thread = threading.Thread(target=self._run, args=(recognizer,), daemon=True)
        self._thread.start()
        emit_dictation_event("dictation_started", self.session_id)

    def _run(self, recognizer) -> None:
        started_at = time.monotonic()
        segments: list = []  # frases ya confirmadas por el endpointing de Vosk
        last_partial = ""
        last_activity_at = started_at
        finalized = False

        def full_text(extra: str = "") -> str:
            return " ".join(part for part in [*segments, extra.strip()] if part).strip()

        def finish(text: str, reason: str) -> None:
            nonlocal finalized
            if finalized:
                return
            finalized = True
            text = text.strip()
            if text:
                emit_dictation_event(
                    "dictation_final", self.session_id, text=text, reason=reason,
                )
            else:
                emit_dictation_event("dictation_timeout", self.session_id, reason=reason)

        while not self._stop_event.is_set() and not finalized:
            now = time.monotonic()
            elapsed_ms = (now - started_at) * 1000
            has_speech = bool(segments or last_partial)
            if elapsed_ms > self.max_ms:
                tail = json.loads(recognizer.FinalResult()).get("text") or last_partial
                finish(full_text(tail), "max_duration")
                break
            if not has_speech and elapsed_ms > self.initial_silence_ms:
                finish("", "initial_silence")
                break
            if has_speech and (now - last_activity_at) * 1000 > self.silence_ms:
                # Pausa REAL prolongada: cerrar con todo lo acumulado.
                tail = json.loads(recognizer.FinalResult()).get("text") or last_partial
                finish(full_text(tail), "silence")
                break

            try:
                data = self._mic.audio_queue.get(timeout=0.25)
            except queue.Empty:
                continue

            if recognizer.AcceptWaveform(data):
                # Endpoint de Vosk = fin de UNA frase, no del dictado: acumular
                # el segmento, resetear el reloj de silencio y seguir escuchando.
                text = (json.loads(recognizer.Result()).get("text") or "").strip()
                if text:
                    segments.append(text)
                    last_partial = ""
                    last_activity_at = time.monotonic()
                    emit_dictation_event(
                        "dictation_partial", self.session_id, text=full_text(),
                    )
            else:
                partial = (json.loads(recognizer.PartialResult()).get("partial") or "").strip()
                if partial and partial != last_partial:
                    last_partial = partial
                    last_activity_at = time.monotonic()
                    emit_dictation_event(
                        "dictation_partial", self.session_id, text=full_text(partial),
                    )

        self._cleanup()

    def _cleanup(self) -> None:
        if self._mic is not None:
            self._mic.close()
            self._mic = None
        emit_dictation_event("dictation_stopped", self.session_id)

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None


class TtsSpeaker:
    """Sintesis local con el binario piper.exe (subproceso por frase).

    piper-phonemize no tiene wheels para Python 3.12, por eso se usa el binario
    standalone en lugar del paquete pip. Emite audio PCM16 base64 por frases.
    """

    def __init__(self):
        self._stop_event = threading.Event()
        self._thread = None
        self._proc = None
        self._sample_rates: dict = {}
        self.utterance_id = ""

    def _get_sample_rate(self, voice_path: str) -> int:
        """Lee el sample_rate del .onnx.json que acompaña a cada voz Piper."""
        if voice_path not in self._sample_rates:
            rate = 22050
            try:
                with open(voice_path + ".json", encoding="utf-8") as fh:
                    config = json.load(fh)
                rate = int(config.get("audio", {}).get("sample_rate", 22050))
            except Exception:
                pass
            self._sample_rates[voice_path] = rate
        return self._sample_rates[voice_path]

    def speak(self, text: str, voice_path: str, piper_exe: str,
              utterance_id: str, speed: float = 1.0) -> None:
        self.stop()  # Una sintesis a la vez; la nueva interrumpe a la anterior.
        self._stop_event = threading.Event()
        self.utterance_id = utterance_id
        self._thread = threading.Thread(
            target=self._run,
            args=(text, voice_path, piper_exe, utterance_id, speed, self._stop_event),
            daemon=True,
        )
        self._thread.start()

    def _run(self, text: str, voice_path: str, piper_exe: str, utterance_id: str,
             speed: float, stop_event: threading.Event) -> None:
        import os
        import subprocess

        try:
            # CreateProcess en Windows no resuelve rutas relativas de forma fiable.
            piper_exe = os.path.abspath(piper_exe)
            voice_path = os.path.abspath(voice_path)
            if not os.path.isfile(piper_exe):
                raise FileNotFoundError(f"piper.exe no encontrado: {piper_exe}")
            if not os.path.isfile(voice_path):
                raise FileNotFoundError(f"Voz Piper no encontrada: {voice_path}")
            sample_rate = self._get_sample_rate(voice_path)
            length_scale = 1.0 / max(0.5, min(2.0, speed))
            sentences = split_sentences(text)
            for index, sentence in enumerate(sentences):
                if stop_event.is_set():
                    break
                proc = subprocess.Popen(
                    [piper_exe, "--model", voice_path, "--output-raw",
                     "--length-scale", f"{length_scale:.2f}"],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
                self._proc = proc
                audio, _ = proc.communicate(input=sentence.encode("utf-8"), timeout=60)
                self._proc = None
                if stop_event.is_set():
                    break
                if audio:
                    emit({
                        "event": "tts_chunk",
                        "utterance_id": utterance_id,
                        "index": index,
                        "total": len(sentences),
                        "sample_rate": sample_rate,
                        "audio_b64": base64.b64encode(audio).decode("ascii"),
                    })
            emit({"event": "tts_end", "utterance_id": utterance_id,
                  "interrupted": stop_event.is_set()})
        except Exception as exc:  # noqa: BLE001 — el TTS nunca debe tumbar el sidecar
            emit({"event": "tts_error", "utterance_id": utterance_id,
                  "message": f"{type(exc).__name__}: {exc}"})
        finally:
            self._proc = None
            if self.utterance_id == utterance_id:
                self.utterance_id = ""

    def stop(self, utterance_id: str = "") -> bool:
        if utterance_id and self.utterance_id != utterance_id:
            return False
        self._stop_event.set()
        proc = self._proc
        if proc is not None:
            try:
                proc.kill()
            except Exception:
                pass
        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=2)
        self._thread = None
        if not self._proc:
            self.utterance_id = ""
        return True


def split_sentences(text: str) -> list:
    """Divide el texto en frases para sintetizar con latencia baja."""
    parts = re.split(r"(?<=[.!?…:;])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()] or [text.strip()]


def preload_model(model_path: str) -> None:
    """Carga un modelo en el cache para que el primer uso sea instantaneo."""
    try:
        started = time.monotonic()
        get_vosk_model(model_path)
        emit({"event": "model_preloaded", "seconds": round(time.monotonic() - started, 1)})
    except Exception as exc:  # noqa: BLE001 — la precarga nunca debe tumbar el sidecar
        emit({"event": "model_preload_failed", "message": f"{type(exc).__name__}: {exc}"})


def list_input_devices() -> list:
    """Dispositivos de entrada (hostapi WASAPI: nombres completos y baja latencia)."""
    import sounddevice as sd

    wasapi_idx = None
    for i in range(len(sd.query_hostapis())):
        if "WASAPI" in sd.query_hostapis(i)["name"]:
            wasapi_idx = i
            break
    default_idx = (
        sd.query_hostapis(wasapi_idx)["default_input_device"]
        if wasapi_idx is not None else sd.default.device[0]
    )
    devices = []
    for i, dev in enumerate(sd.query_devices()):
        if dev["max_input_channels"] <= 0:
            continue
        if wasapi_idx is not None and dev["hostapi"] != wasapi_idx:
            continue
        devices.append({"index": i, "name": dev["name"], "default": i == default_idx})
    return devices


def probe_microphone(device, seconds: float = 3.0) -> dict:
    """Captura unos segundos y mide señal (rms/pico) para diagnosticar el mic.

    Usa MicStream para heredar el fallback WASAPI (tasa/canales nativos).
    """
    import math
    import struct

    mic = MicStream(16000, device)
    rms_values = []
    peak = 0
    deadline = time.monotonic() + seconds
    try:
        while time.monotonic() < deadline:
            try:
                data = mic.audio_queue.get(timeout=0.5)
            except queue.Empty:
                continue
            if len(data) < 2:
                continue
            samples = struct.unpack(f"<{len(data) // 2}h", data)
            rms_values.append(math.sqrt(sum(s * s for s in samples) / len(samples)))
            peak = max(peak, max(abs(s) for s in samples))
    finally:
        mic.close()
    avg_rms = sum(rms_values) / len(rms_values) if rms_values else 0.0
    # Umbral: voz cercana produce picos > 1500; ruido de fondo plano queda < 500.
    return {"rms": round(avg_rms, 1), "peak": peak, "has_signal": peak > 1000}


def stop_listeners() -> None:
    """Detiene cualquier listener de microfono activo (wake o dictado)."""
    global _wake_listener, _dictation_listener
    if _wake_listener is not None:
        _wake_listener.stop()
        _wake_listener = None
    if _dictation_listener is not None:
        _dictation_listener.stop()
        _dictation_listener = None


def handle_command(msg: dict) -> None:
    global _wake_listener, _dictation_listener, _tts_speaker, _meeting_transcriber
    cmd = msg.get("cmd", "")
    msg_id = msg.get("id")
    params = msg.get("params") or {}

    try:
        if cmd == "ping":
            emit({"id": msg_id, "ok": True, "pong": True,
                  "python": sys.version.split()[0], "protocol": PROTOCOL_VERSION})

        elif cmd == "start_wake":
            model_path = params.get("model_path", "")
            if not model_path:
                emit({"id": msg_id, "ok": False, "error": "Falta params.model_path (modelo Vosk)."})
                return
            stop_listeners()  # El microfono es exclusivo entre wake y dictado.
            listener = WakeListener(
                model_path=model_path,
                wake_words=params.get("wake_words") or ["soflia"],
                sample_rate=int(params.get("sample_rate", 16000)),
                device=params.get("device"),
            )
            listener.start()
            _wake_listener = listener
            emit({"id": msg_id, "ok": True})
            # Precarga del modelo de dictado EN SEGUNDO PLANO: el modelo grande
            # tarda segundos en cargar y, sin esto, la primera peticion perdia
            # las palabras iniciales mientras Vosk se inicializaba.
            preload_path = params.get("preload_dictation_model") or ""
            if preload_path and preload_path != model_path:
                threading.Thread(
                    target=preload_model, args=(preload_path,), daemon=True,
                ).start()

        elif cmd == "stop_wake":
            if _wake_listener is not None:
                _wake_listener.stop()
                _wake_listener = None
            emit({"id": msg_id, "ok": True})

        elif cmd == "start_dictation":
            model_path = params.get("model_path", "")
            if not model_path:
                emit({"id": msg_id, "ok": False, "error": "Falta params.model_path (modelo Vosk)."})
                return
            session_id = str(params.get("session_id") or "").strip()
            if not session_id:
                emit({"id": msg_id, "ok": False, "error": "Falta params.session_id para correlacionar el dictado."})
                return
            stop_listeners()
            listener = DictationListener(
                model_path=model_path,
                sample_rate=int(params.get("sample_rate", 16000)),
                device=params.get("device"),
                silence_ms=int(params.get("silence_ms", DEFAULT_DICTATION_SILENCE_MS)),
                initial_silence_ms=int(params.get("initial_silence_ms", DEFAULT_DICTATION_INITIAL_SILENCE_MS)),
                max_ms=int(params.get("max_ms", DEFAULT_DICTATION_MAX_MS)),
                session_id=session_id,
            )
            listener.start()
            _dictation_listener = listener
            emit({"id": msg_id, "ok": True})

        elif cmd == "stop_dictation":
            requested_session_id = str(params.get("session_id") or "").strip()
            active_session_id = (
                _dictation_listener.session_id if _dictation_listener is not None else ""
            )
            if requested_session_id and active_session_id != requested_session_id:
                emit({"id": msg_id, "ok": True, "ignored": True,
                      "active_session_id": active_session_id})
                return
            if _dictation_listener is not None:
                _dictation_listener.stop()
                _dictation_listener = None
            emit({"id": msg_id, "ok": True})

        elif cmd == "tts_speak":
            text = (params.get("text") or "").strip()
            voice_path = params.get("voice_path", "")
            piper_exe = params.get("piper_exe", "")
            utterance_id = str(params.get("utterance_id") or "").strip()
            if not text or not voice_path or not piper_exe or not utterance_id:
                emit({"id": msg_id, "ok": False,
                      "error": "Faltan params.text, params.voice_path, params.piper_exe o params.utterance_id."})
                return
            if _tts_speaker is None:
                _tts_speaker = TtsSpeaker()
            _tts_speaker.speak(
                text, voice_path, piper_exe, utterance_id,
                float(params.get("speed", 1.0)),
            )
            emit({"id": msg_id, "ok": True})

        elif cmd == "tts_stop":
            if _tts_speaker is not None:
                requested_utterance_id = str(params.get("utterance_id") or "").strip()
                stopped = _tts_speaker.stop(requested_utterance_id)
                if not stopped:
                    emit({"id": msg_id, "ok": True, "ignored": True,
                          "active_utterance_id": _tts_speaker.utterance_id})
                    return
            emit({"id": msg_id, "ok": True})

        # ── Transcripcion de reuniones en vivo (Electron envia el audio) ──────
        elif cmd == "meeting_capabilities":
            import meeting_transcription
            emit({"id": msg_id, "ok": True,
                  "whisper_available": meeting_transcription.whisper_available(),
                  "speaker_diarization_available": meeting_transcription.speaker_diarization_available()})

        elif cmd == "meeting_start":
            import meeting_transcription
            session_id = str(params.get("session_id") or "").strip()
            if not session_id:
                emit({"id": msg_id, "ok": False, "error": "Falta params.session_id."})
                return
            if not meeting_transcription.whisper_available():
                emit({"id": msg_id, "ok": False,
                      "error": "faster-whisper no esta instalado en el runtime Python."})
                return
            if _meeting_transcriber is not None:
                _meeting_transcriber.stop(drain_timeout_seconds=5)
            model_size = str(params.get("model_size") or "small")
            download_root = str(params.get("download_root") or "")
            # Diarizacion opcional: si el modelo de hablantes o sherpa-onnx no
            # estan disponibles, la sesion arranca igual (sin separar voces).
            speaker_labeler = None
            speaker_model_path = str(params.get("speaker_model_path") or "")
            if speaker_model_path and meeting_transcription.speaker_diarization_available():
                try:
                    speaker_labeler = meeting_transcription.SpeakerLabeler(
                        model_path=speaker_model_path,
                        similarity_threshold=float(params.get("speaker_threshold", 0.40)),
                    )
                except Exception as exc:  # noqa: BLE001
                    emit({"event": "meeting_error", "session_id": session_id,
                          "message": f"Diarizacion desactivada: {type(exc).__name__}: {exc}"})
            _meeting_transcriber = meeting_transcription.MeetingTranscriber(
                session_id=session_id,
                emit_fn=emit,
                language=str(params.get("language") or "es"),
                model_size=model_size,
                download_root=download_root,
                speaker_labeler=speaker_labeler,
                initial_prompt=str(params.get("initial_prompt") or ""),
            )
            # Precalentar el modelo en segundo plano (descarga/carga) para que
            # la primera ventana de audio no pague ese costo.
            threading.Thread(
                target=meeting_transcription.preload_model,
                args=(model_size, download_root), daemon=True,
            ).start()
            emit({"id": msg_id, "ok": True, "session_id": session_id,
                  "speaker_diarization": speaker_labeler is not None})

        elif cmd == "meeting_audio":
            # Fire-and-forget (sin respuesta): llegan ~2-4 chunks/segundo y una
            # respuesta por chunk duplicaria el trafico stdio sin aportar nada.
            if _meeting_transcriber is not None:
                _meeting_transcriber.push_audio(
                    str(params.get("source") or ""), str(params.get("audio_b64") or ""),
                )

        elif cmd == "meeting_stop":
            segments_count = 0
            if _meeting_transcriber is not None:
                requested = str(params.get("session_id") or "").strip()
                if requested and requested != _meeting_transcriber.session_id:
                    emit({"id": msg_id, "ok": True, "ignored": True,
                          "active_session_id": _meeting_transcriber.session_id})
                    return
                segments_count = _meeting_transcriber.stop()
                _meeting_transcriber = None
            emit({"id": msg_id, "ok": True, "segments_count": segments_count})

        elif cmd == "list_devices":
            emit({"id": msg_id, "ok": True, "devices": list_input_devices()})

        elif cmd == "mic_probe":
            result = probe_microphone(params.get("device"), float(params.get("seconds", 3)))
            emit({"id": msg_id, "ok": True, **result})

        elif cmd == "shutdown":
            stop_listeners()
            if _tts_speaker is not None:
                _tts_speaker.stop()
            if _meeting_transcriber is not None:
                _meeting_transcriber.stop(drain_timeout_seconds=5)
                _meeting_transcriber = None
            emit({"id": msg_id, "ok": True, "bye": True})
            sys.exit(0)

        else:
            emit({"id": msg_id, "ok": False, "error": f"Comando desconocido: '{cmd}'"})

    except Exception as exc:  # noqa: BLE001 — el sidecar nunca debe morir por un comando
        emit({"id": msg_id, "ok": False, "error": f"{type(exc).__name__}: {exc}"})


def main() -> None:
    emit({"event": "ready", "protocol": PROTOCOL_VERSION})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            emit({"event": "error", "message": f"JSON invalido en stdin: {line[:200]}"})
            continue
        handle_command(msg)


if __name__ == "__main__":
    main()
