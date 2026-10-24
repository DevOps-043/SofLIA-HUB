"""Guardas puras del builder CI; no compilan ni simulan éxito nativo."""
import hashlib
import importlib.util
import io
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("reader_native_builder", ROOT / "scripts/quality/build-reader-wheel.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class NativeBuilderGuardTests(unittest.TestCase):
    def test_fuente_con_hash_incorrecto_no_se_acepta(self):
        with tempfile.TemporaryDirectory(prefix="soflia-native-test-") as folder:
            response = io.BytesIO(b"fuente ficticia")
            response.url = "https://oficial.example.test/source.tar.gz"
            with patch.object(builder.urllib.request, "urlopen", return_value=response):
                with self.assertRaisesRegex(RuntimeError, "SHA256"):
                    builder.download(response.url, Path(folder) / "source.tar.gz", "0" * 64)

    def test_tar_con_enlaces_o_ruta_ajena_no_se_extrae(self):
        for name, kind in [("../escape", tarfile.REGTYPE), ("fuente/link", tarfile.SYMTYPE)]:
            with tempfile.TemporaryDirectory(prefix="soflia-native-test-") as folder:
                archive = Path(folder) / "source.tar.gz"
                with tarfile.open(archive, "w:gz") as output:
                    item = tarfile.TarInfo(name)
                    item.type = kind
                    item.linkname = "../escape"
                    output.addfile(item)
                destination = Path(folder) / "extraction"
                with self.assertRaises(RuntimeError):
                    builder.extract_source(archive, destination, "fuente")
                self.assertFalse(destination.exists())

    def test_candidato_cambia_solo_hashes_de_crypto_en_copia(self):
        original = (ROOT / "python/tools_sidecar/requirements.lock").read_text(encoding="utf-8")
        digest = hashlib.sha256(b"wheel ficticia").hexdigest()
        updated = builder.candidate_lock(original, digest)
        self.assertIn(digest, updated)
        self.assertEqual(updated.replace(" " + chr(92) + "\n    --hash=sha256:" + digest, ""), original)
        self.assertEqual((ROOT / "python/tools_sidecar/requirements.lock").read_text(encoding="utf-8"), original)

    def test_enlace_openssl_externo_se_rechaza(self):
        self.assertEqual(builder.inspect_linkage("extension.so:\n /usr/lib/libSystem.B.dylib (version 1)"), ["/usr/lib/libSystem.B.dylib"])
        with self.assertRaises(RuntimeError):
            builder.inspect_linkage("extension.so:\n /usr/local/opt/openssl/lib/libcrypto.dylib (version 4)")

    def test_host_incorrecto_se_rechaza_antes_de_descargar(self):
        with patch.object(builder.platform, "system", return_value="Windows"), patch.object(sys, "argv", ["builder", "--output", "salida"]), patch.object(builder, "download") as download:
            with self.assertRaisesRegex(RuntimeError, "macOS Intel"):
                builder.main()
            download.assert_not_called()


if __name__ == "__main__":
    unittest.main()
