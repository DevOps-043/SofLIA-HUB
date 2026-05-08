import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';

const execFileAsync = util.promisify(execFile);

export async function createNativeBackup(
  sourceDirs: string[],
  outputPath: string,
  warn: (message: string) => void,
) {
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const validSourceDirs = sourceDirs.filter((directory) => {
    if (fs.existsSync(directory)) return true;
    warn(`El directorio ${directory} no existe, se omitira en el respaldo.`);
    return false;
  });
  if (validSourceDirs.length === 0) {
    throw new Error('Ninguno de los directorios fuente especificados existe en el sistema.');
  }

  const command = buildBackupCommand(validSourceDirs, outputPath);
  await execFileAsync(command.executable, command.args, { maxBuffer: 1024 * 1024 * 50 });
  if (!fs.existsSync(command.outputPath)) throw new Error('El archivo de respaldo no fue creado por el comando del sistema.');

  const sizeBytes = fs.statSync(command.outputPath).size;
  const sizeMB = Number((sizeBytes / 1024 / 1024).toFixed(2));
  return {
    path: command.outputPath,
    sizeBytes,
    sizeMB,
    message: `Respaldo completado exitosamente.\nRuta: ${command.outputPath}\nTamano: ${sizeMB} MB`,
  };
}

function buildBackupCommand(sourceDirs: string[], requestedOutputPath: string) {
  if (process.platform === 'win32') {
    const outputPath = requestedOutputPath.toLowerCase().endsWith('.zip') ? requestedOutputPath : `${requestedOutputPath}.zip`;
    const pathsArg = sourceDirs.map((directory) => `'${directory.replace(/'/g, "''")}'`).join(', ');
    const safeOutputPath = outputPath.replace(/'/g, "''");
    return {
      outputPath,
      executable: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-Command', `Compress-Archive -Path ${pathsArg} -DestinationPath '${safeOutputPath}' -Force`],
    };
  }

  const outputPath = requestedOutputPath.toLowerCase().endsWith('.tar.gz') ? requestedOutputPath : `${requestedOutputPath}.tar.gz`;
  return {
    outputPath,
    executable: 'tar',
    args: ['-czf', outputPath, ...sourceDirs],
  };
}
