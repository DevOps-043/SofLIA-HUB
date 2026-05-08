import type { InstallableToolsetDefinition } from './types';

const COMMON_CLIENT = `function getConfig() {
  const baseUrl = process.env.SOFLIA_HOME_ASSISTANT_URL?.trim();
  const token = process.env.SOFLIA_HOME_ASSISTANT_TOKEN?.trim();
  if (!baseUrl || !token) throw new Error('Faltan SOFLIA_HOME_ASSISTANT_URL y/o SOFLIA_HOME_ASSISTANT_TOKEN en el entorno.');
  return { baseUrl: baseUrl.replace(/\\\\/+$/, ''), token };
}

async function callApi(endpoint, init = {}) {
  const { baseUrl, token } = getConfig();
  const response = await fetch(baseUrl + endpoint, { ...init, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (!response.ok) throw new Error('Home Assistant devolvio ' + response.status + ': ' + await response.text());
  if (response.status === 204) return [];
  const rawText = await response.text();
  return rawText ? JSON.parse(rawText) : [];
}`;

function buildTool(name: string, description: string, inputSchema: Record<string, any>, handlerBody: string): string {
  return `${COMMON_CLIENT}

export default {
  name: '${name}',
  description: '${description}',
  inputSchema: ${JSON.stringify(inputSchema, null, 2)},
  async handler(args = {}) {
${handlerBody}
  },
};
`;
}

function buildHomeAssistantListStatesTool(): string {
  return buildTool(
    'home_assistant_list_states',
    'Lista estados y entidades de Home Assistant. Util para descubrir entity_id antes de controlar luces, enchufes o sensores.',
    { type: 'object', properties: { domain: { type: 'string', description: 'Filtro opcional por dominio.' }, entity_id: { type: 'string', description: 'Filtro opcional por entity_id exacto.' } } },
    `    const allStates = await callApi('/api/states');
    let filtered = Array.isArray(allStates) ? allStates : [];
    if (args.domain) filtered = filtered.filter((item) => String(item.entity_id || '').startsWith(String(args.domain) + '.'));
    if (args.entity_id) filtered = filtered.filter((item) => item.entity_id === args.entity_id);
    return { success: true, count: filtered.length, states: filtered.slice(0, 100) };`,
  );
}

function buildHomeAssistantGetStateTool(): string {
  return buildTool(
    'home_assistant_get_state',
    'Obtiene el estado actual de una entidad especifica de Home Assistant.',
    { type: 'object', properties: { entity_id: { type: 'string', description: 'Entity ID completo, por ejemplo light.sala.' } }, required: ['entity_id'] },
    `    if (!args.entity_id) throw new Error('entity_id es obligatorio.');
    return { success: true, state: await callApi('/api/states/' + encodeURIComponent(String(args.entity_id))) };`,
  );
}

function buildHomeAssistantCallServiceTool(): string {
  return buildTool(
    'home_assistant_call_service',
    'Ejecuta un servicio de Home Assistant para controlar luces, enchufes, escenas y dominios soportados.',
    { type: 'object', properties: { domain: { type: 'string', description: 'Dominio del servicio.' }, service: { type: 'string', description: 'Servicio a ejecutar.' }, entity_id: { type: 'string', description: 'Entity ID opcional.' }, data_json: { type: 'string', description: 'JSON opcional para el cuerpo del servicio.' } }, required: ['domain', 'service'] },
    `    if (!args.domain || !args.service) throw new Error('domain y service son obligatorios.');
    let body = args.data_json ? JSON.parse(String(args.data_json)) : {};
    if (args.entity_id) body.entity_id = args.entity_id;
    const endpoint = '/api/services/' + encodeURIComponent(String(args.domain)) + '/' + encodeURIComponent(String(args.service));
    return { success: true, result: await callApi(endpoint, { method: 'POST', body: JSON.stringify(body) }) };`,
  );
}

export function buildBuiltinToolsetCatalog(): Record<string, InstallableToolsetDefinition> {
  return {
    'home-assistant': {
      id: 'home-assistant',
      name: 'Home Assistant',
      description: 'Controla luces, switches, escenas, sensores y entidades expuestas por Home Assistant mediante su API REST.',
      envRequired: ['SOFLIA_HOME_ASSISTANT_URL', 'SOFLIA_HOME_ASSISTANT_TOKEN'],
      toolNames: ['home_assistant_list_states', 'home_assistant_get_state', 'home_assistant_call_service'],
      promptHints: [
        'Usa este toolset cuando el usuario pida prender o apagar luces, escenas, sensores o automatizaciones de Home Assistant.',
        'Si faltan variables de entorno, informa exactamente cuales faltan.',
      ],
      buildFiles: () => [
        { fileName: 'home-assistant.home_assistant_list_states.js', content: buildHomeAssistantListStatesTool() },
        { fileName: 'home-assistant.home_assistant_get_state.js', content: buildHomeAssistantGetStateTool() },
        { fileName: 'home-assistant.home_assistant_call_service.js', content: buildHomeAssistantCallServiceTool() },
      ],
    },
  };
}
