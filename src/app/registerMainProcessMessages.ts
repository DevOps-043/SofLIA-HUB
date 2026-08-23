type MainProcessIpc = Pick<Window['ipcRenderer'], 'on'>;

export function registerMainProcessMessages(ipc: MainProcessIpc | undefined): void {
  if (!ipc) return;

  try {
    ipc.on('main-process-message', (_event, message) => {
      console.log(message);
    });
  } catch (error) {
    // Es un canal informativo. Una discrepancia entre preload y renderer debe
    // quedar visible en consola, pero nunca bloquear la pantalla de arranque.
    console.warn('[BOOT] No se pudo registrar main-process-message:', error);
  }
}
