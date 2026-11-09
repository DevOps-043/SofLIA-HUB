// Proceso de prueba aislado; nunca monta credenciales ni el preload del producto.
const { app, BrowserWindow } = require("electron");
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'soflia-project-panel-qa-')));
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 1000,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  await window.loadURL(process.env.PROJECT_PANEL_PREVIEW_URL);
});
app.on("window-all-closed", () => app.quit());
