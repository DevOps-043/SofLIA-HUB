// Autoconexion de WhatsApp ligada al estado de sesion del Hub.
//
// La autoconexion del arranque ocurre antes de que el renderer publique la
// sesion, asi que el gate la deniega (correcto: no debe conectarse sin sesion).
// Este modulo reintenta la autoconexion cuando el usuario inicia sesion y
// desconecta cuando la cierra, de modo que el gate no deje WhatsApp inservible.

import { onAuthStateChange } from './auth-state';

export interface WhatsAppAutoConnectPort {
  shouldAutoConnect(): Promise<boolean>;
  getSavedApiKey(): Promise<string | undefined>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface WhatsAppAuthGateInput {
  waService: WhatsAppAutoConnectPort;
  initWhatsAppAgent: (apiKey: string) => void;
}

async function autoConnectWithSession(input: WhatsAppAuthGateInput): Promise<void> {
  if (!(await input.waService.shouldAutoConnect())) return;
  const savedKey = await input.waService.getSavedApiKey();
  if (savedKey) input.initWhatsAppAgent(savedKey);
  await input.waService.connect();
}

/** Suscribe la autoconexion/desconexion de WhatsApp a los cambios de sesion. */
export function registerWhatsAppAuthGate(input: WhatsAppAuthGateInput): () => void {
  return onAuthStateChange((state) => {
    if (!state.authenticated) {
      void input.waService
        .disconnect()
        .catch((error) => console.error('[AUTH] No se pudo desconectar WhatsApp al cerrar sesion:', error));
      return;
    }

    void autoConnectWithSession(input).catch((error) =>
      console.error('[AUTH] Autoconexion de WhatsApp tras iniciar sesion fallo:', error),
    );
  });
}
