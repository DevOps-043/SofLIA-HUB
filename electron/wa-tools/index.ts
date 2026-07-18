/**
 * API pública del paquete wa-tools.
 *
 * Combina todas las declaraciones de tools por dominio en el objeto
 * `WA_TOOL_DECLARATIONS` que consume el agente WhatsApp. También expone los
 * sets de seguridad (`BLOCKED_TOOLS_WA`, `CONFIRM_TOOLS_WA`, `GROUP_BLOCKED_TOOLS`).
 *
 * Para agregar una herramienta nueva:
 *  1. Coloca su declaración en el módulo de dominio apropiado
 *  2. Si requiere confirmación, agrégala a `security.ts` -> `CONFIRM_TOOLS_WA`
 *  3. Si debe bloquearse en grupos, agrégala también a `GROUP_BLOCKED_TOOLS`
 *
 * No es necesario modificar este index — los arrays se concatenan automáticamente.
 */

import { AUTOMATION_TOOLS } from './automation';
import { COMMUNICATION_TOOLS } from './communication';
import { COMPUTER_TOOLS } from './computer';
import { EXTENSIBILITY_TOOLS } from './extensibility';
import { FILESYSTEM_TOOLS } from './filesystem';
import { GOOGLE_TOOLS } from './google';
import { IRIS_TOOLS } from './iris';
import { MEMORY_TOOLS } from './memory';
import { PROFILE_TOOLS } from './profile';
import { REMOTE_NODE_TOOLS } from './remote-nodes';
import { SDO_TOOLS } from './sdo';
import { SYSTEM_TOOLS } from './system';

export { BLOCKED_TOOLS_WA, CONFIRM_TOOLS_WA, GROUP_BLOCKED_TOOLS } from './security';

type WaToolDeclaration = {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export const WA_TOOL_DECLARATIONS = {
  functionDeclarations: [
    ...FILESYSTEM_TOOLS,
    ...COMMUNICATION_TOOLS,
    ...MEMORY_TOOLS,
    ...PROFILE_TOOLS,
    ...COMPUTER_TOOLS,
    ...REMOTE_NODE_TOOLS,
    ...SYSTEM_TOOLS,
    ...EXTENSIBILITY_TOOLS,
    ...IRIS_TOOLS,
    ...GOOGLE_TOOLS,
    ...AUTOMATION_TOOLS,
    ...SDO_TOOLS,
  ] as WaToolDeclaration[],
};
