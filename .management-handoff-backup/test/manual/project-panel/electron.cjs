// Proceso de prueba aislado; nunca monta credenciales ni el preload del producto.
const { app, BrowserWindow } = require("electron");
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
