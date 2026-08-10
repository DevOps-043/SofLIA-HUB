import { app } from 'electron';
import { logBootstrapError } from './main/bootstrap-steps';
import { runBootstrap } from './main/bootstrap';
import { registerPresentationScheme } from './skill-workspace/protocol';

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Electron exige declarar los esquemas privilegiados antes de que la app este
// lista. Sin esto, el documento de la presentacion se serviria en un origen
// sin privilegios y no podria cargar su CSS ni sus imagenes relativas.
registerPresentationScheme();

type BootstrapGuard = typeof globalThis & {
  __SOFLIA_BOOTSTRAP_COMPLETE__?: boolean;
};

const bootstrapGuard = globalThis as BootstrapGuard;
if (bootstrapGuard.__SOFLIA_BOOTSTRAP_COMPLETE__) {
  console.log(`[BOOT] Duplicate bootstrap avoided in PID ${process.pid}`);
} else {
  bootstrapGuard.__SOFLIA_BOOTSTRAP_COMPLETE__ = true;

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    console.log(`[BOOT] Second instance blocked for PID ${process.pid}`);
    app.exit(0);
  } else {
    runBootstrap().catch((error) => logBootstrapError('runBootstrap', error));
  }
}
