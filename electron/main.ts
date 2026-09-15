import { app } from 'electron';
import { logBootstrapError } from './main/bootstrap-steps';
import { runBootstrap } from './main/bootstrap';
import { registerPresentationScheme } from './skill-workspace/protocol';
import { configureChromiumUserAgentFallback } from './integrated-browser/user-agent';

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/**
 * El registro `ssl_client_socket_impl.cc handshake failed; SSL error code 1,
 * net_error -2` contra dominios como google.com no es un certificado invalido:
 * es el ClientHello con intercambio de claves post-cuantico (Kyber/ML-KEM) que
 * Chromium activa por defecto desde la version 124 y que routers, antivirus o
 * proxies con inspeccion TLS todavia no saben fragmentar. Desactivar el
 * feature evita el fallo de handshake sin tocar la verificacion de
 * certificados de `certificate-policy.ts`.
 */
app.commandLine.appendSwitch('disable-features', 'PostQuantumKyber');

/**
 * Debe configurarse antes de crear sesiones, workers o ventanas. Aplicarlo
 * después en cada `WebContents` deja la primera navegación de un popup y los
 * fetch de su service worker con la identidad Electron predeterminada.
 */
configureChromiumUserAgentFallback(app);

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
