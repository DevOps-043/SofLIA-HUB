import { app, BrowserWindow } from 'electron';

console.log('[MINIMAL-BOOT] PID:', process.pid);

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[MINIMAL-BOOT] ⚠️ Second instance detected. Exiting.');
  app.exit();
}

app.whenReady().then(() => {
  console.log('[MINIMAL-BOOT] app.whenReady() fired.');
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  win.loadURL('https://www.google.com');
  console.log('[MINIMAL-BOOT] Window created and loading Google.');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
