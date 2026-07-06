const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const MODEL_URL = process.env.OMNIPARSER_MODEL_URL
  || 'https://huggingface.co/onnx-community/OmniParser-icon_detect/resolve/main/onnx/model.onnx';
const TARGET_PATH = process.env.OMNIPARSER_MODEL_TARGET
  || path.join(process.cwd(), 'models', 'omniparser-icon-detect.onnx');

async function main() {
  const force = process.argv.includes('--force');
  printNotice();

  if (fs.existsSync(TARGET_PATH) && !force) {
    console.log(`[DesktopAgent] Modelo ya existe: ${TARGET_PATH}`);
    console.log('[DesktopAgent] Usa -- --force para descargarlo de nuevo.');
    return;
  }

  fs.mkdirSync(path.dirname(TARGET_PATH), { recursive: true });
  const tmpPath = `${TARGET_PATH}.tmp`;
  if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true });

  console.log(`[DesktopAgent] Descargando OmniParser icon_detect desde: ${MODEL_URL}`);
  console.log(`[DesktopAgent] Destino local: ${TARGET_PATH}`);
  await downloadFile(MODEL_URL, tmpPath, 0);
  fs.renameSync(tmpPath, TARGET_PATH);
  console.log('[DesktopAgent] Modelo OmniParser instalado correctamente.');
}

function printNotice() {
  console.log('');
  console.log('AVISO DE LICENCIA OMNIPARSER');
  console.log('Este comando descarga pesos ONNX de OmniParser icon_detect desde Hugging Face.');
  console.log('Los pesos de icon_detect tienen aviso de licencia AGPL en la documentacion del proyecto.');
  console.log('SofLIA no bundlea este modelo en el instalador ni lo descarga silenciosamente.');
  console.log('Al ejecutar este comando aceptas revisar y cumplir la licencia del modelo en tu entorno.');
  console.log('');
}

function downloadFile(url, targetPath, redirectCount) {
  if (redirectCount > 5) {
    return Promise.reject(new Error('Demasiadas redirecciones al descargar el modelo.'));
  }

  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const statusCode = response.statusCode || 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        const nextUrl = new URL(location, url).toString();
        downloadFile(nextUrl, targetPath, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Descarga fallida: HTTP ${statusCode}`));
        return;
      }

      const file = fs.createWriteStream(targetPath);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (error) => {
        file.close(() => {});
        fs.rmSync(targetPath, { force: true });
        reject(error);
      });
    });

    request.on('error', (error) => {
      fs.rmSync(targetPath, { force: true });
      reject(error);
    });
  });
}

main().catch((error) => {
  if (fs.existsSync(`${TARGET_PATH}.tmp`)) fs.rmSync(`${TARGET_PATH}.tmp`, { force: true });
  console.error(`[DesktopAgent] No se pudo instalar OmniParser: ${error.message}`);
  process.exitCode = 1;
});
