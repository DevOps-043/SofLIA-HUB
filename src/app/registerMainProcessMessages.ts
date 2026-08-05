type MainProcessIpc = Pick<Window['ipcRenderer'], 'on'>;

export function registerMainProcessMessages(ipc: MainProcessIpc | undefined): void {
  if (!ipc) return;

  ipc.on('main-process-message', (_event, message) => {
    console.log(message);
  });
}
