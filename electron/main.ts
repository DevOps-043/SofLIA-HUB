import { app } from 'electron';
import { logBootstrapError } from './main/bootstrap-steps';
import { runBootstrap } from './main/bootstrap';

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
