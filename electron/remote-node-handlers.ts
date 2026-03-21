import { ipcMain } from 'electron';
import { remoteNodeService } from './remote-node-service';

export function registerRemoteNodeHandlers() {
  ipcMain.handle('remote-node:get-host-status', async () => remoteNodeService.getHostStatus());
  ipcMain.handle('remote-node:update-host-config', async (_event, updates: any) => remoteNodeService.updateHostConfig(updates || {}));
  ipcMain.handle('remote-node:list-nodes', async () => ({ success: true, nodes: await remoteNodeService.listNodes() }));
  ipcMain.handle('remote-node:register-node', async (_event, node: any) => remoteNodeService.registerNode(node || {}));
  ipcMain.handle('remote-node:remove-node', async (_event, nodeId: string) => remoteNodeService.removeNode(String(nodeId || '').trim()));
  ipcMain.handle('remote-node:test-node', async (_event, nodeId: string) => remoteNodeService.testNode(String(nodeId || '').trim()));
  ipcMain.handle('remote-node:open-application', async (_event, nodeId: string, args: any) => remoteNodeService.openApplicationOnNode(String(nodeId || '').trim(), args || {}));
  ipcMain.handle('remote-node:run-background-command', async (_event, nodeId: string, args: any) => remoteNodeService.runBackgroundCommandOnNode(String(nodeId || '').trim(), args || {}));
  ipcMain.handle('remote-node:execute-task', async (_event, nodeId: string, args: any) => remoteNodeService.executeDesktopTaskOnNode(String(nodeId || '').trim(), args || {}));
  ipcMain.handle('remote-node:take-screenshot', async (_event, nodeId: string, args: any) => remoteNodeService.takeScreenshotOnNode(String(nodeId || '').trim(), args || {}));
  ipcMain.handle('remote-node:list-process-sessions', async (_event, nodeId: string) => remoteNodeService.listProcessSessionsOnNode(String(nodeId || '').trim()));
  ipcMain.handle('remote-node:poll-process-session', async (_event, nodeId: string, sessionId: string) => remoteNodeService.pollProcessSessionOnNode(String(nodeId || '').trim(), String(sessionId || '').trim()));
  ipcMain.handle('remote-node:kill-process-session', async (_event, nodeId: string, sessionId: string) => remoteNodeService.killProcessSessionOnNode(String(nodeId || '').trim(), String(sessionId || '').trim()));
}
