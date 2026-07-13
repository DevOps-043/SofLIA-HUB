const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

module.exports = async function verifyPackagedPython(context) {
  const platform = context.electronPlatformName;
  const productFilename = context.packager.appInfo.productFilename;
  const resourcesDir = platform === 'darwin'
    ? path.join(context.appOutDir, `${productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const pythonExecutable = platform === 'win32'
    ? path.join(resourcesDir, 'python', 'python.exe')
    : path.join(resourcesDir, 'python', 'bin', 'python3');
  const sidecar = path.join(resourcesDir, 'python-sidecar', 'main.py');

  for (const requiredPath of [pythonExecutable, sidecar]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`[Installer] Recurso Python ausente: ${requiredPath}`);
    }
  }

  const output = execFileSync(pythonExecutable, [
    '-c',
    'import vosk, sounddevice; print("python-bundle-ok")',
  ], {
    encoding: 'utf8',
    env: platform === 'linux' ? {
      ...process.env,
      LD_LIBRARY_PATH: [path.join(resourcesDir, 'python', 'lib'), process.env.LD_LIBRARY_PATH]
        .filter(Boolean)
        .join(path.delimiter),
    } : process.env,
  }).trim();
  if (!output.includes('python-bundle-ok')) {
    throw new Error(`[Installer] El runtime Python empaquetado no supero la verificacion: ${output}`);
  }
  console.log(`[Installer] Runtime Python verificado: ${pythonExecutable}`);
};
