"""Regresiones unitarias de la transcripcion de reuniones en vivo.

No cargan faster-whisper ni modelos: inyectan un transcriptor falso y validan
las reglas puras de segmentacion (ventanas, silencio, flush al detener) y el
formato de los eventos meeting_segment.
"""

from __future__ import annotations

import importlib.util
import math
import struct
import time
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "meeting_transcription.py"
MODULE_SPEC = importlib.util.spec_from_file_location("soflia_meeting_transcription", MODULE_PATH)
if MODULE_SPEC is None or MODULE_SPEC.loader is None:
    raise RuntimeError(f"No se pudo cargar el modulo desde {MODULE_PATH}")
meeting_transcription = importlib.util.module_from_spec(MODULE_SPEC)
MODULE_SPEC.loader.exec_module(meeting_transcription)

MeetingTranscriber = meeting_transcription.MeetingTranscriber
SpeakerLabeler = meeting_transcription.SpeakerLabeler
SAMPLE_RATE = meeting_transcription.SAMPLE_RATE


def tone_pcm(seconds: float, amplitude: int = 8000, freq: float = 440.0) -> bytes:
    """PCM int16 mono con señal audible (por encima del umbral de silencio)."""
    count = int(SAMPLE_RATE * seconds)
    return struct.pack(
        f"<{count}h",
        *(int(amplitude * math.sin(2 * math.pi * freq * i / SAMPLE_RATE)) for i in range(count)),
    )


def silence_pcm(seconds: float) -> bytes:
    return b"\x00\x00" * int(SAMPLE_RATE * seconds)


def b64(pcm: bytes) -> str:
    import base64

    return base64.b64encode(pcm).decode("ascii")


def wait_until(predicate, timeout_seconds: float = 5.0) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.02)
    return False


class MeetingTranscriberTests(unittest.TestCase):
    def make_transcriber(self, transcribe_result: str = "hola equipo"):
        events: list[dict] = []
        transcriber = MeetingTranscriber(
            session_id="s1",
            emit_fn=events.append,
            transcribe_fn=lambda pcm: transcribe_result,
        )
        return transcriber, events

    def test_emits_segment_after_voice_window_followed_by_silence(self) -> None:
        transcriber, events = self.make_transcriber()
        try:
            transcriber.push_audio("system", b64(tone_pcm(4.5)))
            transcriber.push_audio("system", b64(silence_pcm(1.0)))
            self.assertTrue(wait_until(lambda: len(events) == 1))
            event = events[0]
            self.assertEqual(event["event"], "meeting_segment")
            self.assertEqual(event["session_id"], "s1")
            self.assertEqual(event["source"], "system")
            self.assertEqual(event["text"], "hola equipo")
            self.assertEqual(event["t0_ms"], 0)
            self.assertGreaterEqual(event["t1_ms"], 5000)
        finally:
            transcriber.stop(drain_timeout_seconds=2)

    def test_pure_silence_never_reaches_inference(self) -> None:
        calls: list[bytes] = []
        events: list[dict] = []
        transcriber = MeetingTranscriber(
            session_id="s1",
            emit_fn=events.append,
            transcribe_fn=lambda pcm: calls.append(pcm) or "no deberia emitirse",
        )
        try:
            for _ in range(4):
                transcriber.push_audio("mic", b64(silence_pcm(4.0)))
        finally:
            transcriber.stop(drain_timeout_seconds=2)
        self.assertEqual(calls, [])
        self.assertEqual(events, [])

    def test_stop_flushes_partial_buffer_and_returns_segment_count(self) -> None:
        transcriber, events = self.make_transcriber("cierre de reunion")
        transcriber.push_audio("mic", b64(tone_pcm(2.0)))  # < MIN_WINDOW: aun sin flush
        self.assertEqual(events, [])
        count = transcriber.stop()
        self.assertEqual(count, 1)
        self.assertEqual(events[0]["source"], "mic")
        self.assertEqual(events[0]["text"], "cierre de reunion")

    def test_sources_keep_independent_timelines(self) -> None:
        transcriber, events = self.make_transcriber()
        try:
            transcriber.push_audio("mic", b64(tone_pcm(4.5)))
            transcriber.push_audio("mic", b64(silence_pcm(1.0)))
            transcriber.push_audio("system", b64(tone_pcm(4.5)))
            transcriber.push_audio("system", b64(silence_pcm(1.0)))
            self.assertTrue(wait_until(lambda: len(events) == 2))
        finally:
            transcriber.stop(drain_timeout_seconds=2)
        by_source = {event["source"]: event for event in events}
        self.assertEqual(set(by_source), {"mic", "system"})
        # Cada fuente arranca su linea de tiempo en 0 de forma independiente.
        self.assertEqual(by_source["mic"]["t0_ms"], 0)
        self.assertEqual(by_source["system"]["t0_ms"], 0)

    def test_transcription_error_emits_meeting_error_and_session_survives(self) -> None:
        events: list[dict] = []
        boom = {"raised": False}

        def flaky(pcm: bytes) -> str:
            if not boom["raised"]:
                boom["raised"] = True
                raise RuntimeError("modelo roto")
            return "recuperado"

        transcriber = MeetingTranscriber(session_id="s1", emit_fn=events.append, transcribe_fn=flaky)
        try:
            transcriber.push_audio("mic", b64(tone_pcm(4.5)))
            transcriber.push_audio("mic", b64(silence_pcm(1.0)))
            self.assertTrue(wait_until(lambda: any(e["event"] == "meeting_error" for e in events)))
            transcriber.push_audio("mic", b64(tone_pcm(4.5)))
            transcriber.push_audio("mic", b64(silence_pcm(1.0)))
            self.assertTrue(wait_until(
                lambda: any(e.get("text") == "recuperado" for e in events)
            ))
        finally:
            transcriber.stop(drain_timeout_seconds=2)


class SpeakerLabelerTests(unittest.TestCase):
    @staticmethod
    def make_labeler(vectors: dict[bytes, list[float]]) -> "SpeakerLabeler":
        """Labeler con embeddings deterministas: pcm exacto → vector fijo."""
        return SpeakerLabeler(embed_fn=lambda pcm: vectors[pcm], similarity_threshold=0.8)

    def test_same_voice_keeps_same_label_and_new_voice_gets_new_one(self) -> None:
        voice_a1, voice_a2, voice_b = b"a1", b"a2", b"b1"
        labeler = self.make_labeler({
            voice_a1: [1.0, 0.0, 0.0],
            voice_a2: [0.95, 0.05, 0.0],   # muy similar a A
            voice_b: [0.0, 1.0, 0.0],      # ortogonal: otra voz
        })
        self.assertEqual(labeler.label(voice_a1), "participante-1")
        self.assertEqual(labeler.label(voice_b), "participante-2")
        self.assertEqual(labeler.label(voice_a2), "participante-1")

    def test_centroid_refines_with_running_mean(self) -> None:
        labeler = SpeakerLabeler(
            embed_fn=lambda pcm: [1.0, 0.0] if pcm == b"x" else [0.9, 0.1],
            similarity_threshold=0.8,
        )
        labeler.label(b"x")
        labeler.label(b"y")
        self.assertEqual(len(labeler._centroids), 1)
        self.assertAlmostEqual(labeler._centroids[0][0], 0.95, places=6)

    def test_segments_carry_speaker_labels(self) -> None:
        events: list[dict] = []
        voices = iter([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]])
        transcriber = MeetingTranscriber(
            session_id="s1",
            emit_fn=events.append,
            transcribe_fn=lambda pcm: "texto",
            speaker_labeler=SpeakerLabeler(
                embed_fn=lambda pcm: next(voices), similarity_threshold=0.8,
            ),
        )
        try:
            transcriber.push_audio("mic", b64(tone_pcm(4.5)))
            transcriber.push_audio("mic", b64(silence_pcm(1.0)))
            transcriber.push_audio("system", b64(tone_pcm(4.5)))
            transcriber.push_audio("system", b64(silence_pcm(1.0)))
            transcriber.push_audio("system", b64(tone_pcm(4.5, freq=880.0)))
            transcriber.push_audio("system", b64(silence_pcm(1.0)))
            self.assertTrue(wait_until(lambda: len(events) == 3))
        finally:
            transcriber.stop(drain_timeout_seconds=2)
        # La voz del mic reclama el indice 1 como "usuario"; las voces del
        # canal del sistema toman los indices siguientes.
        speakers = {event["speaker"] for event in events}
        self.assertEqual(speakers, {"usuario", "participante-2", "participante-3"})

    def test_mic_bleed_separates_remote_voices_without_system_audio(self) -> None:
        """Sin loopback, las voces remotas entran por el mic (bocinas): la
        primera voz local es "usuario" y las demas se separan como
        participante-N, en vez de etiquetar todo como usuario."""
        events: list[dict] = []
        voices = iter([[1.0, 0.0], [0.0, 1.0], [0.95, 0.05]])
        transcriber = MeetingTranscriber(
            session_id="s1",
            emit_fn=events.append,
            transcribe_fn=lambda pcm: "texto",
            speaker_labeler=SpeakerLabeler(
                embed_fn=lambda pcm: next(voices), similarity_threshold=0.8,
            ),
        )
        try:
            for freq in (440.0, 880.0, 440.0):
                transcriber.push_audio("mic", b64(tone_pcm(4.5, freq=freq)))
                transcriber.push_audio("mic", b64(silence_pcm(1.0)))
            self.assertTrue(wait_until(lambda: len(events) == 3))
        finally:
            transcriber.stop(drain_timeout_seconds=2)
        self.assertEqual(
            [event["speaker"] for event in events],
            ["usuario", "participante-2", "usuario"],
        )

    def test_user_slot_released_if_that_voice_appears_on_system_channel(self) -> None:
        """Si la huella que reclamo "usuario" suena luego en el canal remoto,
        era una voz remota colada: se libera el puesto y la siguiente voz
        local distinta pasa a ser el usuario real."""
        events: list[dict] = []
        remote_voice = [1.0, 0.0]
        local_voice = [0.0, 1.0]
        sequence = iter([remote_voice, remote_voice, local_voice])
        transcriber = MeetingTranscriber(
            session_id="s1",
            emit_fn=events.append,
            transcribe_fn=lambda pcm: "texto",
            speaker_labeler=SpeakerLabeler(
                embed_fn=lambda pcm: next(sequence), similarity_threshold=0.8,
            ),
        )
        try:
            transcriber.push_audio("mic", b64(tone_pcm(4.5)))          # remoto por bocinas
            transcriber.push_audio("mic", b64(silence_pcm(1.0)))
            transcriber.push_audio("system", b64(tone_pcm(4.5)))       # la misma voz, ahora en loopback
            transcriber.push_audio("system", b64(silence_pcm(1.0)))
            transcriber.push_audio("mic", b64(tone_pcm(4.5, freq=880.0)))  # el usuario real
            transcriber.push_audio("mic", b64(silence_pcm(1.0)))
            self.assertTrue(wait_until(lambda: len(events) == 3))
        finally:
            transcriber.stop(drain_timeout_seconds=2)
        ordered = sorted(events, key=lambda e: (e["source"], e["t0_ms"]))
        by_key = {(e["source"], e["t0_ms"]): e["speaker"] for e in events}
        self.assertEqual(by_key[("system", 0)], "participante-1")
        # La segunda voz del mic (distinta) reclama "usuario" tras la liberacion.
        mic_speakers = [e["speaker"] for e in events if e["source"] == "mic"]
        self.assertIn("usuario", mic_speakers)
        self.assertEqual(len(ordered), 3)

    def test_without_labeler_system_segments_use_generic_label(self) -> None:
        events: list[dict] = []
        transcriber = MeetingTranscriber(
            session_id="s1", emit_fn=events.append, transcribe_fn=lambda pcm: "texto",
        )
        try:
            transcriber.push_audio("system", b64(tone_pcm(4.5)))
            transcriber.push_audio("system", b64(silence_pcm(1.0)))
            self.assertTrue(wait_until(lambda: len(events) == 1))
        finally:
            transcriber.stop(drain_timeout_seconds=2)
        self.assertEqual(events[0]["speaker"], "participantes")

    def test_labeler_failure_degrades_to_generic_label(self) -> None:
        def broken_embed(pcm: bytes) -> list[float]:
            raise RuntimeError("modelo corrupto")

        events: list[dict] = []
        transcriber = MeetingTranscriber(
            session_id="s1", emit_fn=events.append, transcribe_fn=lambda pcm: "texto",
            speaker_labeler=SpeakerLabeler(embed_fn=broken_embed),
        )
        try:
            transcriber.push_audio("system", b64(tone_pcm(4.5)))
            transcriber.push_audio("system", b64(silence_pcm(1.0)))
            self.assertTrue(wait_until(lambda: len(events) == 1))
        finally:
            transcriber.stop(drain_timeout_seconds=2)
        self.assertEqual(events[0]["speaker"], "participantes")


if __name__ == "__main__":
    unittest.main()
