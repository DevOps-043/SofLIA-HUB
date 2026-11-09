"""Ejecutor stdlib: contratos puros y, opcionalmente, formatos con dependencias."""
import argparse
import importlib.metadata
import inspect
from pathlib import Path
import runpy
import sys
import tempfile
import unittest


def main():
    parser = argparse.ArgumentParser(description="Pruebas del lector documental, sin pytest ni descargas.")
    parser.add_argument("--formats", action="store_true", help="Exigir dependencias y ejecutar formatos/stdio reales ficticios.")
    options = parser.parse_args()
    directory = Path(__file__).resolve().parent
    suite = unittest.TestSuite(unittest.defaultTestLoader.discover(str(directory), pattern=pattern)
                               for pattern in ("test_document_resources.py", "test_reader_dependencies.py", "test_reader_native_build.py"))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        return 1
    if options.formats:
        from reader_dependencies import assert_locked_reader_versions, assert_bootstrap_versions
        assert_locked_reader_versions()
        assert_bootstrap_versions(directory.parent.parent / "bootstrap.lock")
        print("Dependencias:", {name: importlib.metadata.version(name) for name in ("pdfplumber", "openpyxl", "python-pptx", "python-docx")}, flush=True)
        tests = runpy.run_path(str(directory / "test_documents_privacy.py"))
        count = 0
        for name, function in tests.items():
            if name.startswith("test_") and callable(function):
                with tempfile.TemporaryDirectory(prefix="soflia-formatos-") as folder:
                    function(Path(folder)) if "tmp_path" in inspect.signature(function).parameters else function()
                print("APROBADA:", name, flush=True)
                count += 1
        print("Formatos/privacidad:", count, "aprobadas.", flush=True)
    print("Intérprete:", sys.version.split()[0], flush=True)
    return 0


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    import os
    os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
    os.environ["PYTHONIOENCODING"] = "utf-8"
    raise SystemExit(main())
