"""Política de dependencias verificable sin instalar bibliotecas ni ejecutar PDFs."""
import io
import tempfile
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
from importlib.metadata import PackageNotFoundError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import documents
import reader_dependencies as policy


class ReaderDependencyTests(unittest.TestCase):
    def lock(self):
        return "\n".join(f"{name}=={version} {chr(92)}\n    --hash=sha256:{'a' * 64}" for name, version in {
            "pdfminer.six": "20260107", "pdfplumber": "0.11.10", "openpyxl": "3.1.5", "python-docx": "1.2.0", "python-pptx": "1.0.2"}.items())

    def test_politica_admite_parche_y_postrelease(self):
        for version in ["20251230", "20260107", "20260107.post1"]:
            with patch("importlib.metadata.version", return_value=version):
                policy.assert_pdf_dependency()

    def test_politica_rechaza_metadata_malformada(self):
        for version in [None, 20260107, "20251229", "20269999", "20260107.dev1", "20260107+desconocido"]:
            with patch("importlib.metadata.version", return_value=version), self.assertRaises(documents.DocumentError):
                policy.assert_pdf_dependency()

    def test_lock_rechaza_gramatica_incompleta_duplicados_y_hashes(self):
        cases = ["", "pdfminer.six==20260107", self.lock().replace("sha256:", "md5:"),
                 self.lock() + "\n" + self.lock(), self.lock() + "\n--index-url https://ajeno.test", self.lock() + "\n-r externo.txt"]
        with tempfile.TemporaryDirectory(prefix="soflia-lock-test-") as folder:
            file = Path(folder) / "requirements.lock"
            for content in cases:
                with self.subTest(content=content[:30]):
                    file.write_text(content, encoding="utf-8")
                    with self.assertRaises(documents.DocumentError):
                        policy.locked_versions(file)

    def test_version_instalada_debe_coincidir_con_lock(self):
        versions = {"pdfminer-six": "20260107", "pdfminer.six": "20260107", "pdfplumber": "0.11.10", "openpyxl": "3.1.5", "python-docx": "1.2.0", "python-pptx": "1.0.2"}
        with tempfile.TemporaryDirectory(prefix="soflia-lock-test-") as folder:
            file = Path(folder) / "requirements.lock"
            file.write_text(self.lock(), encoding="utf-8")
            with patch("importlib.metadata.version", side_effect=versions.__getitem__):
                policy.assert_locked_reader_versions(file)
                versions["python-docx"] = "1.1.2"
                with self.assertRaises(documents.DocumentError):
                    policy.assert_locked_reader_versions(file)

    def test_lock_real_contiene_lectores_y_cierre_fijados(self):
        versions = policy.locked_versions()
        self.assertEqual(versions["pdfminer-six"], "20260107")
        self.assertEqual(len(versions), 15)

    def test_bootstrap_instalado_debe_coincidir_con_lock(self):
        file = Path(__file__).resolve().parents[2] / "bootstrap.lock"
        versions = {"setuptools": "84.2.1", "wheel": "0.48.0", "packaging": "26.3"}
        with patch("importlib.metadata.version", side_effect=versions.__getitem__):
            policy.assert_bootstrap_versions(file)
            versions["wheel"] = "0.45.1"
            with self.assertRaises(documents.DocumentError):
                policy.assert_bootstrap_versions(file)
    def test_version_vulnerable_falla_antes_del_parser(self):
        for version in ["20231228", "20251107", "inverificable"]:
            with self.subTest(version=version):
                parser = Mock(side_effect=AssertionError("El parser no debe ejecutarse."))
                with patch("importlib.metadata.version", return_value=version), patch.dict(sys.modules, {"pdfplumber": SimpleNamespace(open=parser)}):
                    with self.assertRaises(documents.DocumentError) as failure:
                        documents._parse_pdf(io.BytesIO(b"%PDF-ficticio"), 1)
                    self.assertEqual(failure.exception.code, "DEPENDENCY_INCOMPATIBLE")
                parser.assert_not_called()

    def test_metadata_ausente_falla_antes_del_parser(self):
        parser = Mock(side_effect=AssertionError("El parser no debe ejecutarse."))
        with patch("importlib.metadata.version", side_effect=PackageNotFoundError("pdfminer.six")), patch.dict(sys.modules, {"pdfplumber": SimpleNamespace(open=parser)}):
            with self.assertRaises(documents.DocumentError) as failure:
                documents._parse_pdf(io.BytesIO(b"%PDF-ficticio"), 1)
            self.assertEqual(failure.exception.code, "DEPENDENCY_INCOMPATIBLE")
        parser.assert_not_called()


if __name__ == "__main__":
    unittest.main()
