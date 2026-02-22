import * as tsNode from 'node:path';
import 'dotenv/config';
import { AutoDevService } from '../electron/autodev-service';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runStandalone() {
  console.log('----------------------------------------------------');
  console.log('🤖 Starting AutoDev Standalone (Terminal Mode)');
  console.log('----------------------------------------------------');

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: VITE_GEMINI_API_KEY no detectada en .env\n');
    console.log('Por favor, asegúrate de tener tu API Key en el archivo .env de tu proyecto:');
    console.log('VITE_GEMINI_API_KEY=tu-api-key\n');
    process.exit(1);
  }

  const repoPath = join(__dirname, '..');
  const autoDev = new AutoDevService(repoPath);

  autoDev.setApiKey(apiKey);

  autoDev.on('status-changed', (d: any) => console.log(`[AutoDev Status] ${d.status}`));
  autoDev.on('agent-completed', (d: any) => console.log(`[AutoDev Agent] ${d.agent} (${d.role}) -> ${d.status}`));

  try {
    const run = await autoDev.runNow();
    if (run.status === 'completed') {
      console.log('\n✅ AutoDev Ejecución Exitosa');
      console.log(`PR creado: ${run.prUrl}`);
      console.log(run.summary);
    } else {
      console.log(`\n❌ AutoDev finalizó con fallas (${run.status}).`);
      console.log(`Error: ${run.error}`);
    }
  } catch (err: any) {
    console.error('\n❌ No se pudo completar el run de AutoDev:', err.message);
  }

  console.log('\n[!] Presiona ENTER para salir de esta terminal...');
  process.stdin.resume();
  process.stdin.on('data', () => process.exit(0));
}

runStandalone();
