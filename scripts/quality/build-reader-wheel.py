"""Candidato macOS Intel en CI: fuentes fijadas, OpenSSL estático y pruebas.

No modifica el lock del repositorio ni publica/promociona el artefacto.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    "openssl": ("https://github.com/openssl/openssl/releases/download/openssl-4.0.3/openssl-4.0.3.tar.gz",
                "325b5c806167c13b40b1ffeadfe0248197c00eccc4cf123ec1e28d2d2fd216d9", "openssl-4.0.3"),
    "cryptography": ("https://files.pythonhosted.org/packages/9d/af/182eb91b0df3fe75c4d9f26fe70684569566745f6ba7e5c9c73a862c5252/cryptography-50.0.2.tar.gz",
                     "7b46165bb56eb4704e2eaaf86f3c940d19154535d9b0ca7d6d590b04060e00d5", "cryptography-50.0.2"),
}
RUST_VERSION = "1.99.1"


def sha256(file: Path) -> str:
    with file.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def download(url: str, file: Path, expected: str) -> None:
    with urllib.request.urlopen(url, timeout=30) as response, file.open("xb") as output:
        if not response.url.startswith("https://"):
            raise RuntimeError("La descarga dejó HTTPS.")
        total = 0
        while block := response.read(65536):
            total += len(block)
            if total > 64 * 1024 * 1024:
                raise RuntimeError("Archivo fuente excesivo.")
            output.write(block)
    if sha256(file) != expected:
        raise RuntimeError("SHA256 de fuente incompatible; no se extrae ni ejecuta.")


def extract_source(file: Path, destination: Path, prefix: str) -> Path:
    with tarfile.open(file, "r:gz") as archive:
        members = []
        total = 0
        for member in archive:
            total += member.size
            if len(members) >= 100000 or total > 512 * 1024 * 1024:
                raise RuntimeError("Fuente fuera de presupuesto.")
            name = PurePosixPath(member.name)
            if name.is_absolute() or ".." in name.parts or not name.parts or name.parts[0] != prefix or not (member.isfile() or member.isdir()):
                raise RuntimeError("Fuente con ruta o tipo no permitido.")
            members.append(member)
        destination.mkdir()
        archive.extractall(destination, members=members, filter="data")
    return destination / prefix


def candidate_lock(text: str, digest: str) -> str:
    if not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise RuntimeError("Huella de candidato inválida.")
    blocks = text.split("\n\n")
    matches = 0
    for index, block in enumerate(blocks):
        if block.startswith("cryptography==50.0.2 "):
            lines = block.splitlines()
            if not lines[-1].strip().startswith("--hash=sha256:") or lines[-1].endswith(chr(92)):
                raise RuntimeError("Bloque cryptography incompatible.")
            blocks[index] = block + " " + chr(92) + "\n    --hash=sha256:" + digest
            matches += 1
    if matches != 1:
        raise RuntimeError("No se encontró un único pin del candidato.")
    return "\n\n".join(blocks)


def inspect_linkage(output: str) -> list[str]:
    libraries = [line.strip().split(" (")[0] for line in output.splitlines()[1:] if line.strip()]
    if not libraries or any(not name.startswith(("/usr/lib/", "/System/Library/")) for name in libraries):
        raise RuntimeError("La wheel depende de bibliotecas externas al sistema.")
    return libraries


def main() -> None:
    parser = argparse.ArgumentParser(description="Construir candidato CI macOS Intel sin publicar.")
    parser.add_argument("--output", required=True, type=Path)
    options = parser.parse_args()
    if platform.system() != "Darwin" or platform.machine() != "x86_64" or sys.version_info[:3] != (3, 12, 11):
        raise RuntimeError("La construcción exige macOS Intel y CPython 3.12.11 nativos.")
    runner = Path(os.environ["RUNNER_TEMP"]).resolve()
    output = options.output.resolve()
    if not output.is_relative_to(runner) or output == runner or output.exists():
        raise RuntimeError("La salida debe ser un directorio nuevo dentro de RUNNER_TEMP.")
    environment = dict(os.environ, MACOSX_DEPLOYMENT_TARGET="13.0", PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8",
                       RUSTUP_TOOLCHAIN=RUST_VERSION, CARGO_BUILD_TARGET="x86_64-apple-darwin", OPENSSL_STATIC="1")
    def run(arguments, cwd=None, capture=False):
        return subprocess.run([str(value) for value in arguments], cwd=cwd, env=environment, check=True,
                              text=True, encoding="utf-8", stdout=subprocess.PIPE if capture else None, timeout=1200)
    rust = run(["rustc", "--version"], capture=True).stdout.strip()
    if not rust.startswith("rustc " + RUST_VERSION + " "):
        raise RuntimeError("La versión Rust no coincide con el pin.")
    work = Path(tempfile.mkdtemp(prefix="soflia-native-reader-", dir=runner))
    sources = {}
    for name, (url, digest, prefix) in SOURCES.items():
        archive = work / (name + ".tar.gz")
        download(url, archive, digest)
        sources[name] = extract_source(archive, work / name, prefix)
    openssl = work / "openssl-static"
    run(["perl", "Configure", "darwin64-x86_64-cc", "no-shared", "no-tests", "--prefix=" + str(openssl)], sources["openssl"])
    run(["make", "-j3"], sources["openssl"])
    run(["make", "install_sw"], sources["openssl"])
    environment["OPENSSL_DIR"] = str(openssl)
    environment["CARGO_TARGET_DIR"] = str(work / "cargo-target")
    run([sys.executable, "-I", "-m", "venv", work / "venv"])
    python = work / "venv/bin/python3"
    pip = [python, "-I", "-m", "pip", "--isolated", "--disable-pip-version-check"]
    run(pip + ["install", "--require-hashes", "--only-binary=:all:", "-r", ROOT / "test/python-native-build.lock"])
    wheelhouse = work / "wheelhouse"
    wheelhouse.mkdir()
    run(pip + ["wheel", "--no-deps", "--no-build-isolation", "--wheel-dir", wheelhouse, sources["cryptography"]])
    wheels = list(wheelhouse.glob("*.whl"))
    if len(wheels) != 1 or not re.fullmatch(r"cryptography-50\.0\.2-[^-]+-[^-]+-macosx_13_0_x86_64\.whl", wheels[0].name):
        raise RuntimeError("Wheel con versión, arquitectura o target inesperados.")
    wheel = wheels[0]
    digest = sha256(wheel)
    linkage = []
    inspection = work / "inspection"
    inspection.mkdir()
    with zipfile.ZipFile(wheel) as archive:
        for index, name in enumerate(archive.namelist()):
            if name.endswith(".so"):
                library = inspection / f"extension-{index}.so"
                library.write_bytes(archive.read(name))
                linkage.append(inspect_linkage(run(["otool", "-L", library], capture=True).stdout))
                commands = run(["otool", "-l", library], capture=True).stdout
                match = re.search(r"cmd LC_BUILD_VERSION.*?minos (\d+(?:\.\d+)*)", commands, re.DOTALL)
                if not match or tuple(map(int, match[1].split("."))) > (13, 0, 0):
                    raise RuntimeError("No se verificó el target mínimo macOS 13.")
    if not linkage:
        raise RuntimeError("No se encontró una extensión nativa verificable.")
    lock = work / "candidate-requirements.lock"
    lock.write_text(candidate_lock((ROOT / "python/tools_sidecar/requirements.lock").read_text(encoding="utf-8"), digest), encoding="utf-8")
    run(pip + ["download", "--require-hashes", "--only-binary=:all:", "--find-links", wheelhouse, "--dest", wheelhouse, "-r", lock])
    run(pip + ["install", "--no-index", "--find-links", wheelhouse, "--require-hashes", "--only-binary=:all:", "-r", lock])
    run(pip + ["check"])
    run([python, "-I", "-B", "-X", "utf8", ROOT / "python/tools_sidecar/tests/run_tests.py", "--formats"])
    output.mkdir()
    shutil.copyfile(wheel, output / wheel.name)
    shutil.copyfile(lock, output / lock.name)
    for filename in ("LICENSE", "LICENSE.APACHE", "LICENSE.BSD"):
        shutil.copyfile(sources["cryptography"] / filename, output / ("cryptography-" + filename))
    shutil.copyfile(sources["openssl"] / "LICENSE.txt", output / "openssl-LICENSE.txt")
    (output / "receipt.json").write_text(json.dumps({"state": "candidate_requires_review", "wheel": wheel.name, "sha256": digest,
        "python": sys.version.split()[0], "rust": rust, "sources": SOURCES, "libraries": linkage,
        "nativeBuildLockSha256": sha256(ROOT / "test/python-native-build.lock"), "repositoryModified": False,
        "published": False, "fullVoiceRuntimeCertified": False}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
