"""Admisión ZIP/XML sin extracción ni DOM; no sustituye un sandbox de parsers."""
import re
import struct
from dataclasses import dataclass
from typing import BinaryIO
from xml.etree.ElementTree import ParseError, XMLParser
import zipfile
from document_errors import DocumentError, resource_limit
from document_budget import MAX_SHEET_ROWS, MAX_COLUMNS, MAX_TABLES, MAX_SECTIONS

MAX_ENTRIES = 4096
MAX_DIRECTORY_BYTES = 2 * 1024 * 1024
MAX_ENTRY_BYTES = 16 * 1024 * 1024
MAX_INFLATED_BYTES = 64 * 1024 * 1024
MAX_RATIO = 1000
MAX_XML_DEPTH = 128
MAX_XML_ELEMENTS = 500000
CHUNK = 65536


def invalid_package() -> DocumentError:
    return DocumentError("DOC_PARSE_FAILED", "El contenedor Office no es válido para lectura local.")


@dataclass
class XmlBudget:
    elements: int = 0
    tables: int = 0
    sections: int = 0


class XmlGuard:
    def __init__(self, sheet: bool, counter: XmlBudget):
        self.sheet = sheet
        self.counter = counter
        self.depth = 0

    def start(self, tag, attributes):
        self.depth += 1
        self.counter.elements += 1
        if self.depth > MAX_XML_DEPTH or self.counter.elements > MAX_XML_ELEMENTS:
            raise resource_limit()
        local = tag.rsplit("}", 1)[-1]
        if local == "tbl":
            self.counter.tables += 1
            if self.counter.tables > MAX_TABLES:
                raise resource_limit()
        if local in ("worksheet", "sld"):
            self.counter.sections += 1
            if self.counter.sections > MAX_SECTIONS:
                raise resource_limit()
        # Word expande gridSpan al enumerar celdas, aun con un XML diminuto.
        if local in ("gridSpan", "gridBefore", "gridAfter"):
            for key, value in attributes.items():
                if key.rsplit("}", 1)[-1] == "val" and (not re.fullmatch(r"[0-9]{1,3}", value) or int(value) > MAX_COLUMNS):
                    raise resource_limit()
        for key, value in attributes.items():
            if key.rsplit("}", 1)[-1] in ("gridSpan", "rowSpan") and (not re.fullmatch(r"[1-9][0-9]{0,3}", value) or int(value) > MAX_COLUMNS):
                raise resource_limit()
        if self.sheet:
            position = attributes.get("r")
            if local == "row" and position is not None:
                if not re.fullmatch(r"[1-9][0-9]{0,3}", position) or int(position) > MAX_SHEET_ROWS:
                    raise resource_limit()
            if local == "c" and position is not None:
                match = re.fullmatch(r"([A-Z]{1,3})([1-9][0-9]{0,3})", position)
                if not match:
                    raise resource_limit()
                column = 0
                for char in match[1]:
                    column = column * 26 + ord(char) - 64
                if column > MAX_COLUMNS or int(match[2]) > MAX_SHEET_ROWS:
                    raise resource_limit()

    def end(self, _tag):
        self.depth -= 1

    def data(self, _text):
        pass

    def doctype(self, _name, _public, _system):
        raise invalid_package()

    def close(self):
        return None


def validate_office(source: BinaryIO, size: int) -> None:
    """Acotar el directorio antes de instanciar ZipFile y la expansión al leer."""
    source.seek(max(0, size - 65557))
    tail = source.read(65557)
    offset = tail.rfind(b"PK\x05\x06")
    if offset < 0 or len(tail) - offset < 22:
        raise invalid_package()
    _, disk, start_disk, on_disk, entries, directory_size, directory_offset, comment_size = struct.unpack_from("<4s4H2LH", tail, offset)
    if disk or start_disk or on_disk != entries or offset + 22 + comment_size != len(tail):
        raise invalid_package()
    if entries == 65535 or entries > MAX_ENTRIES or directory_size > MAX_DIRECTORY_BYTES:
        raise resource_limit()
    eocd_position = max(0, size - 65557) + offset
    if directory_offset + directory_size != eocd_position:
        raise invalid_package()
    source.seek(0)
    total = 0
    names = set()
    xml_counter = XmlBudget()
    try:
        with zipfile.ZipFile(source) as archive:
            info = archive.infolist()
            if len(info) != entries or len(info) > MAX_ENTRIES:
                raise invalid_package()
            declared = 0
            for item in info:
                name = item.filename
                if not name or item.orig_filename != name or len(name) > 1024 or name in names or "\\" in name or ":" in name or name.startswith("/") or any(part in (".", "..", "") for part in name.rstrip("/").split("/")):
                    raise invalid_package()
                names.add(name)
                if item.flag_bits & 1:
                    raise DocumentError("DOC_ENCRYPTED", "El contenedor está cifrado.")
                if item.extract_version >= 45:
                    raise invalid_package()
                if item.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                    raise invalid_package()
                declared += item.file_size
                if item.file_size > MAX_ENTRY_BYTES or declared > MAX_INFLATED_BYTES or item.file_size > max(1, item.compress_size) * MAX_RATIO:
                    raise resource_limit()
            for item in info:
                lower = item.filename.lower()
                guard = XmlGuard(lower.startswith("xl/worksheets/") and lower.endswith(".xml"), xml_counter)
                parser = XMLParser(target=guard) if lower.endswith((".xml", ".rels")) else None
                actual = 0
                with archive.open(item) as entry:
                    while True:
                        block = entry.read(CHUNK)
                        if not block:
                            break
                        actual += len(block)
                        total += len(block)
                        if actual > MAX_ENTRY_BYTES or total > MAX_INFLATED_BYTES:
                            raise resource_limit()
                        if parser:
                            parser.feed(block)
                if actual != item.file_size:
                    raise invalid_package()
                if parser:
                    parser.close()
    except DocumentError:
        raise
    except (zipfile.BadZipFile, ParseError, EOFError, ValueError, NotImplementedError, RuntimeError) as error:
        raise invalid_package() from error
    finally:
        source.seek(0)
