"""Regresiones unitarias del protocolo de voz local.

Estas pruebas no abren el microfono ni cargan Vosk. Validan las reglas puras
que protegen dos rutas criticas: deteccion de la palabra de activacion y
correlacion de eventos de dictado entre turnos consecutivos.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest
from unittest.mock import Mock, patch


SIDECAR_PATH = Path(__file__).resolve().parents[1] / "main.py"
SIDECAR_SPEC = importlib.util.spec_from_file_location("soflia_voice_sidecar", SIDECAR_PATH)
if SIDECAR_SPEC is None or SIDECAR_SPEC.loader is None:
    raise RuntimeError(f"No se pudo cargar el sidecar desde {SIDECAR_PATH}")
sidecar = importlib.util.module_from_spec(SIDECAR_SPEC)
SIDECAR_SPEC.loader.exec_module(sidecar)

DictationListener = sidecar.DictationListener
WakeListener = sidecar.WakeListener
emit_dictation_event = sidecar.emit_dictation_event
expand_wake_words = sidecar.expand_wake_words
normalize_spoken_phrase = sidecar.normalize_spoken_phrase
handle_command = sidecar.handle_command


class WakeWordExpansionTests(unittest.TestCase):
    def test_normalizes_case_accents_punctuation_and_spacing(self) -> None:
        self.assertEqual(
            normalize_spoken_phrase("  \u00a1Hola, SOFL\u00cdA!  "),
            "hola soflia",
        )

    def test_brand_name_expands_to_vosk_vocabulary_with_all_optional_prefixes(self) -> None:
        grammar, match_set = expand_wake_words(["soflia"])

        self.assertIn("sof\u00eda", grammar)
        self.assertIn("sofia", grammar)
        self.assertIn("supl\u00eda", grammar)
        self.assertIn("oye sof\u00eda", grammar)
        self.assertIn("hola sofia", grammar)
        self.assertIn("hey sofia", grammar)
        self.assertIn("ey sofia", grammar)
        self.assertNotIn("soflia", grammar)
        self.assertNotIn("sof lia", grammar)
        self.assertEqual(
            match_set,
            {
                "sofia", "oye sofia", "hola sofia", "hey sofia", "ey sofia",
                "suplia", "oye suplia", "hola suplia", "hey suplia", "ey suplia",
            },
        )

    def test_configured_prefix_does_not_make_other_prefixes_mandatory(self) -> None:
        grammar, match_set = expand_wake_words(["Oye, Pulse"])

        self.assertIn("sof\u00eda", grammar)
        self.assertIn("hola sofia", grammar)
        self.assertIn("sofia", match_set)
        self.assertIn("hey sofia", match_set)

    def test_legacy_split_brand_name_is_repaired(self) -> None:
        grammar, match_set = expand_wake_words(["sof lia"])

        self.assertIn("sof\u00eda", grammar)
        self.assertIn("sofia", match_set)
        self.assertNotIn("sof lia", grammar)


class WakeWordMatchingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.listener = WakeListener("unused-model", ["soflia"])

    def test_accepts_prefixed_wake_at_the_beginning_and_ignores_prefix_confidence(self) -> None:
        matched, reason = self.listener._evaluate_match(
            {
                "text": "oye sofia abre el navegador",
                "result": [
                    {"word": "oye", "conf": 0.05, "start": 0.10, "end": 0.22},
                    {"word": "sof\u00eda", "conf": 0.82, "start": 0.23, "end": 0.66},
                    {"word": "abre", "conf": 0.91, "start": 0.68, "end": 0.92},
                ],
            },
            speech_onset=0.0,
        )

        self.assertTrue(matched)
        self.assertEqual(reason, "matched")

    def test_rejects_brand_name_below_the_core_confidence_threshold(self) -> None:
        matched, reason = self.listener._evaluate_match(
            {
                "text": "sofia",
                "result": [
                    {"word": "sofia", "conf": 0.20, "start": 0.10, "end": 0.55},
                ],
            },
            speech_onset=0.0,
        )

        self.assertFalse(matched)
        self.assertEqual(reason, "low_confidence")

    def test_rejects_wake_phrase_in_the_middle_of_unrelated_speech(self) -> None:
        matched, reason = self.listener._evaluate_match(
            {
                "text": "dile a sofia que venga",
                "result": [
                    {"word": "dile", "conf": 0.93, "start": 0.10, "end": 0.36},
                    {"word": "a", "conf": 0.90, "start": 0.37, "end": 0.49},
                    {"word": "sofia", "conf": 0.88, "start": 0.50, "end": 0.90},
                ],
            },
            speech_onset=0.0,
        )

        self.assertFalse(matched)
        self.assertEqual(reason, "wake_phrase_not_at_start")

    def test_text_fallback_still_requires_wake_phrase_at_the_beginning(self) -> None:
        self.assertEqual(
            self.listener._evaluate_match(
                {"text": "hola sofia abre configuracion", "result": []},
                speech_onset=None,
            ),
            (True, "text_fallback"),
        )
        self.assertEqual(
            self.listener._evaluate_match(
                {"text": "preguntale a sofia", "result": []},
                speech_onset=None,
            ),
            (False, "no_entries_or_text_match"),
        )

    def test_accepts_observed_suplia_alias_from_partial_recognition(self) -> None:
        self.assertEqual(
            self.listener._evaluate_match(
                {"partial": "hola supl\u00eda", "partial_result": []},
                speech_onset=None,
            ),
            (True, "text_fallback"),
        )


class DictationProtocolTests(unittest.TestCase):
    def test_every_dictation_event_keeps_its_session_id(self) -> None:
        with patch.object(sidecar, "emit") as emit_mock:
            emit_dictation_event(
                "dictation_final",
                "turn-002",
                text="abre el navegador",
                reason="silence",
            )

        emit_mock.assert_called_once_with(
            {
                "event": "dictation_final",
                "session_id": "turn-002",
                "text": "abre el navegador",
                "reason": "silence",
            }
        )

    def test_consecutive_listeners_keep_independent_session_ids(self) -> None:
        first = DictationListener("unused-model", session_id="turn-001")
        second = DictationListener("unused-model", session_id="turn-002")

        self.assertEqual(first.session_id, "turn-001")
        self.assertEqual(second.session_id, "turn-002")
        self.assertNotEqual(first.session_id, second.session_id)

    def test_stale_stop_command_cannot_terminate_the_new_listener(self) -> None:
        active_listener = Mock(session_id="turn-002")
        with (
            patch.object(sidecar, "_dictation_listener", active_listener),
            patch.object(sidecar, "emit") as emit_mock,
        ):
            handle_command({
                "id": 7,
                "cmd": "stop_dictation",
                "params": {"session_id": "turn-001"},
            })

        active_listener.stop.assert_not_called()
        emit_mock.assert_called_once_with({
            "id": 7,
            "ok": True,
            "ignored": True,
            "active_session_id": "turn-002",
        })

    def test_owned_stop_command_terminates_its_listener(self) -> None:
        active_listener = Mock(session_id="turn-002")
        with (
            patch.object(sidecar, "_dictation_listener", active_listener),
            patch.object(sidecar, "emit") as emit_mock,
        ):
            handle_command({
                "id": 8,
                "cmd": "stop_dictation",
                "params": {"session_id": "turn-002"},
            })

        active_listener.stop.assert_called_once_with()
        emit_mock.assert_called_once_with({"id": 8, "ok": True})


class SpeechProtocolTests(unittest.TestCase):
    def test_stale_tts_stop_cannot_interrupt_the_new_utterance(self) -> None:
        active_speaker = Mock(utterance_id="speech-002")
        active_speaker.stop.return_value = False
        with (
            patch.object(sidecar, "_tts_speaker", active_speaker),
            patch.object(sidecar, "emit") as emit_mock,
        ):
            handle_command({
                "id": 9,
                "cmd": "tts_stop",
                "params": {"utterance_id": "speech-001"},
            })

        active_speaker.stop.assert_called_once_with("speech-001")
        emit_mock.assert_called_once_with({
            "id": 9,
            "ok": True,
            "ignored": True,
            "active_utterance_id": "speech-002",
        })


if __name__ == "__main__":
    unittest.main()
