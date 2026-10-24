"""Regresiones sin dependencias de terceros; fixtures pequeñas y temporales."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from unittest.mock import Mock
from types import SimpleNamespace
import zipfile
import warnings

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import documents
import document_budget as budget
import office_preflight as office


class ResourceRegressionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="soflia-recursos-")
        self.addCleanup(self.temporary.cleanup)
        self.file = Path(self.temporary.name) / "ficticio.docx"
        self.package({"word/document.xml": b"<document/>"})

    def package(self, entries):
        with zipfile.ZipFile(self.file, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, content in entries.items():
                archive.writestr(name, content)

    def parsed(self, markdown="texto", tables=None):
        return {"markdown": markdown, "tables": tables or [], "metadata": {}}

    def rejected(self, result, code="DOC_RESOURCE_LIMIT"):
        with patch.object(documents, "_parse_docx", return_value=result):
            with self.assertRaises(documents.DocumentError) as error:
                documents.parse_document(str(self.file))
        self.assertEqual(error.exception.code, code)

    def test_markdown_excesivo_no_devuelve_un_sufijo_fuera_de_contrato(self):
        self.rejected(self.parsed("x" * 400001))

    def test_unicode_cuenta_unidades_utf16_del_consumidor(self):
        self.rejected(self.parsed("😀" * 200001))

    def test_celdas_acumuladas_se_rechazan(self):
        self.rejected(self.parsed(tables=[{"rows": [["x"] * 20 for _ in range(1001)]}]))

    def test_expansion_zip_se_rechaza_antes_del_parser(self):
        self.package({"word/document.xml": b"x" * (2 * 1024 * 1024)})
        with patch.object(documents, "_parse_docx", return_value=self.parsed()) as parser:
            with self.assertRaises(documents.DocumentError) as error:
                documents.parse_document(str(self.file))
            self.assertEqual(error.exception.code, "DOC_RESOURCE_LIMIT")
            parser.assert_not_called()

    def test_dtd_utf16_se_rechaza_antes_del_parser(self):
        self.package({"word/document.xml": '<!DOCTYPE x [<!ENTITY a "privado">]><x>&a;</x>'.encode("utf-16")})
        with patch.object(documents, "_parse_docx", return_value=self.parsed()) as parser:
            with self.assertRaises(documents.DocumentError):
                documents.parse_document(str(self.file))
            parser.assert_not_called()

    def test_limites_zip_antes_de_parser(self):
        for limit, entries in [("MAX_ENTRIES", {"a": b"a", "b": b"b"}),
                               ("MAX_ENTRY_BYTES", {"a": b"xx"}),
                               ("MAX_INFLATED_BYTES", {"a": b"a", "b": b"b"}),
                               ("MAX_DIRECTORY_BYTES", {"a": b"a"})]:
            with self.subTest(limit=limit):
                self.package(entries)
                with patch.object(office, limit, 1), patch.object(documents, "_parse_docx", return_value=self.parsed()) as parser:
                    with self.assertRaises(documents.DocumentError) as error:
                        documents.parse_document(str(self.file))
                    self.assertEqual(error.exception.code, "DOC_RESOURCE_LIMIT")
                    parser.assert_not_called()

    def test_xml_profundo_y_coordenadas_falsas(self):
        for xml in [b"<a>" * 129 + b"</a>" * 129,
                    b'<worksheet><dimension ref="A1"/><sheetData><row r="2001"><c r="A2001"/></row></sheetData></worksheet>',
                    b'<worksheet><sheetData><row r="1"><c r="GS1"/></row></sheetData></worksheet>']:
            with self.subTest(xml=xml[:40]):
                self.package({"xl/worksheets/sheet1.xml": xml})
                with patch.object(documents, "_parse_docx", return_value=self.parsed()) as parser:
                    with self.assertRaises(documents.DocumentError) as error:
                        documents.parse_document(str(self.file))
                    self.assertEqual(error.exception.code, "DOC_RESOURCE_LIMIT")
                    parser.assert_not_called()

    def test_rechaza_ambiguos_zip_y_crc(self):
        for name in ["../document.xml", "/document.xml", "a\\b.xml", "C:document.xml"]:
            emitted = name.replace("\\", "/")
            self.package({emitted: b"<document/>"})
            if emitted != name:
                # ZipInfo normaliza separadores Windows al escribir: alterar bytes
                # locales/centrales prueba la entrada real, sin depender del parser.
                self.file.write_bytes(self.file.read_bytes().replace(emitted.encode(), name.encode()))
            with patch.object(documents, "_parse_docx", return_value=self.parsed()) as parser:
                with self.assertRaises(documents.DocumentError):
                    documents.parse_document(str(self.file))
                parser.assert_not_called()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(self.file, "w") as archive:
                archive.writestr("duplicado", "uno")
                archive.writestr("duplicado", "dos")
        with patch.object(documents, "_parse_docx", return_value=self.parsed()) as parser:
            with self.assertRaises(documents.DocumentError):
                documents.parse_document(str(self.file))
            parser.assert_not_called()
        with zipfile.ZipFile(self.file, "w") as archive:
            archive.writestr("a", "contenido-ficticio")
        data = self.file.read_bytes().replace(b"contenido-ficticio", b"contenido-distinto")
        self.file.write_bytes(data)
        with patch.object(documents, "_parse_docx", return_value=self.parsed()) as parser:
            with self.assertRaises(documents.DocumentError):
                documents.parse_document(str(self.file))
            parser.assert_not_called()

    def test_xml_utf16_bien_formado_no_se_confunde_con_dtd(self):
        self.package({"word/document.xml": "<document>ficticio</document>".encode("utf-16")})
        with patch.object(documents, "_parse_docx", return_value=self.parsed()):
            self.assertEqual(documents.parse_document(str(self.file))["markdown"], "texto")

    def test_word_rechaza_expansion_de_celdas_por_atributo(self):
        self.package({"word/document.xml": b'<w:document xmlns:w="urn:prueba"><w:gridSpan w:val="2147483647"/></w:document>'})
        with patch.object(documents, "_parse_docx", return_value=self.parsed()) as parser:
            with self.assertRaises(documents.DocumentError) as error:
                documents.parse_document(str(self.file))
            self.assertEqual(error.exception.code, "DOC_RESOURCE_LIMIT")
            parser.assert_not_called()

    def test_libro_se_cierra_al_exceder_presupuesto(self):
        sheet = SimpleNamespace(title="Hoja", reset_dimensions=Mock(), iter_rows=lambda **_: [["x" * 400001]])
        workbook = SimpleNamespace(worksheets=[sheet], close=Mock())
        with patch.dict(sys.modules, {"openpyxl": SimpleNamespace(load_workbook=lambda *_, **__: workbook)}):
            with self.assertRaises(documents.DocumentError):
                documents._parse_xlsx(None)
        workbook.close.assert_called_once()

    def test_utf16_admite_limite_exacto(self):
        self.assertEqual(budget.units("😀" * 200000), 400000)

    def test_cuotas_xml_son_acumuladas(self):
        for name, entries in [("MAX_XML_ELEMENTS", {"a.xml": b"<a><b/></a>"}),
                              ("MAX_TABLES", {"a.xml": b"<a><tbl/><tbl/></a>"}),
                              ("MAX_SECTIONS", {"a.xml": b"<worksheet/>", "b.xml": b"<worksheet/>"})]:
            with self.subTest(name=name):
                self.package(entries)
                with patch.object(office, name, 1), patch.object(documents, "_parse_docx", return_value=self.parsed()) as parser:
                    with self.assertRaises(documents.DocumentError) as error:
                        documents.parse_document(str(self.file))
                    self.assertEqual(error.exception.code, "DOC_RESOURCE_LIMIT")
                    parser.assert_not_called()

    def test_zip64_local_no_pasa_a_la_biblioteca(self):
        with zipfile.ZipFile(self.file, "w") as archive:
            with archive.open("a", "w", force_zip64=True) as entry:
                entry.write(b"dato")
        with patch.object(documents, "_parse_docx", return_value=self.parsed()) as parser:
            with self.assertRaises(documents.DocumentError):
                documents.parse_document(str(self.file))
            parser.assert_not_called()

    def test_ctime_de_ruta_no_equivale_a_cambio_del_descriptor(self):
        before = self.file.stat()
        snapshot = SimpleNamespace(**{name: getattr(before, name) for name in ("st_mode", "st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")})
        snapshot.st_ctime_ns -= 100
        with patch.object(documents.os, "stat", return_value=snapshot), patch.object(documents, "_parse_docx", return_value=self.parsed()):
            self.assertEqual(documents.parse_document(str(self.file))["markdown"], "texto")

    def test_presupuesto_incremental_y_relleno(self):
        builder = budget.DocumentBuilder()
        builder.text("x" * 399999)
        with self.assertRaises(documents.DocumentError):
            builder.text("x")
        self.assertEqual(len(builder.lines), 1)
        builder = budget.DocumentBuilder()
        with patch.object(budget, "MAX_CELLS", 4):
            with self.assertRaises(documents.DocumentError):
                builder.table([["a", "b", "c"], ["d"]])
        self.assertEqual(builder.tables, [])

    def test_documento_modificado_se_descarta_y_descriptor_cierra(self):
        captured = []
        def parse(source):
            captured.append(source)
            self.file.write_bytes(b"cambio-ficticio")
            return self.parsed()
        with patch.object(documents, "_parse_docx", side_effect=parse):
            with self.assertRaises(documents.DocumentError) as error:
                documents.parse_document(str(self.file))
        self.assertEqual(error.exception.code, "DOCUMENT_CHANGED")
        self.assertTrue(captured[0].closed)

    def test_lectura_abierta_cierra_si_parser_falla(self):
        captured = []
        def parse(source):
            captured.append(source)
            raise documents.DocumentError("DOC_PARSE_FAILED", "fallo ficticio")
        with patch.object(documents, "_parse_docx", side_effect=parse):
            with self.assertRaises(documents.DocumentError):
                documents.parse_document(str(self.file))
        self.assertTrue(captured[0].closed)

    def test_rechaza_ampliacion_de_marcadores_de_privacidad(self):
        import main
        import privacy
        with patch.object(privacy, "redact", return_value={"redacted": "x" * 400001, "redactedCount": 0}):
            with self.assertRaises(documents.DocumentError):
                main._redact_document(self.parsed("correo ficticio"), privacy)


if __name__ == "__main__":
    unittest.main()
