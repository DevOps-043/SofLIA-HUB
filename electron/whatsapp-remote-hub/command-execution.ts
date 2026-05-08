import { exec } from 'child_process';
import { promisify } from 'util';
import type { SendTextMessage } from './types';

const execAsync = promisify(exec);
const STDOUT_LIMIT = 1000;
const STDERR_LIMIT = 500;

export async function executeSystemCommand(command: string, jid: string, sendMessage: SendTextMessage): Promise<void> {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 15000 });
    let response = `*Resultado de Ejecucion:*\n\n`;

    if (stdout) {
      response += `*Output:*\n\`\`\`\n${stdout.substring(0, STDOUT_LIMIT)}${stdout.length > STDOUT_LIMIT ? '\n...[truncado]' : ''}\n\`\`\`\n`;
    }
    if (stderr) {
      response += `*Errores:*\n\`\`\`\n${stderr.substring(0, STDERR_LIMIT)}\n\`\`\``;
    }
    if (!stdout && !stderr) {
      response += '(Comando ejecutado sin salida)';
    }

    await sendMessage(jid, response);
  } catch (error: any) {
    await sendMessage(jid, `*Error al ejecutar:*\n\`\`\`\n${error.message}\n\`\`\``);
  }
}
