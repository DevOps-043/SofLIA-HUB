const fs = require('node:fs');
const path = require('node:path');
const { pythonExecutable, validateRuntime } = require('./python-runtime-support.cjs');

module.exports = async function verifyPackagedPython(context) {
  const platform = context.electronPlatformName;
  const productFilename = context.packager.appInfo.productFilename;
  const resourcesDir = platform === 'darwin'
    ? path.join(context.appOutDir, `${productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const runtimeDir = path.join(resourcesDir, 'python');
  const executable = pythonExecutable(runtimeDir, platform);
  const sidecar = path.join(resourcesDir, 'python-sidecar', 'main.py');
  const toolsSidecar = path.join(resourcesDir, 'python-tools', 'main.py');

  for (const requiredPath of [executable, sidecar, toolsSidecar]) {
    const stat = fs.existsSync(requiredPath) ? fs.statSync(requiredPath) : null;
    if (!stat?.isFile() || stat.size === 0) {
      throw new Error(`[Instalador] Recurso Python ausente o incompleto: ${requiredPath}`);
    }
  }

  // La misma compuerta de preparación comprueba versión, pip, voz y documentos.
  validateRuntime(runtimeDir, platform);
  console.log(`[Instalador] Runtime Python y ambos sidecars verificados: ${executable}`);
};
