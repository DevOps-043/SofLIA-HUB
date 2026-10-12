import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createPdfDocument } from '../../../electron/wa-executor/handlers/create-document/pdf-document';

const directory = path.resolve(process.argv[2]);
app.setPath('userData', path.join(directory, 'electron-profile'));
app.on('window-all-closed', () => { /* El smoke genera más de un PDF consecutivo. */ });
void app.whenReady().then(async () => {
  try {
    for (const name of ['breve', 'informe']) {
      const options = JSON.parse(await fs.readFile(path.join(directory, name + '.json'), 'utf8'));
      await createPdfDocument({ ...options, saveDir: directory, filename: name + '-electron' });
    }
  } finally { app.quit(); }
});
