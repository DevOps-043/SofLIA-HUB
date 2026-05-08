export const REMOTE_NODE_REGISTRY_TOOLS = [
  {
    name: 'get_remote_node_host_status',
    description: 'Obtiene el estado del host de nodo remoto de esta instancia de SofLIA.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'configure_remote_node_host',
    description: 'Configura el host de nodo remoto de esta instancia. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        enabled: { type: 'BOOLEAN' as const, description: 'Activa o desactiva el host remoto.' },
        bind_address: { type: 'STRING' as const, description: 'Direccion de escucha. Usa 127.0.0.1 para loopback o 0.0.0.0 para LAN.' },
        port: { type: 'NUMBER' as const, description: 'Puerto TCP del host remoto.' },
        node_name: { type: 'STRING' as const, description: 'Nombre legible del nodo.' },
        advertise_url: { type: 'STRING' as const, description: 'URL publica opcional para que otros nodos se conecten.' },
        rotate_token: { type: 'BOOLEAN' as const, description: 'Si es true, regenera el token del host remoto.' },
      },
    },
  },
  {
    name: 'list_remote_nodes',
    description: 'Lista los nodos remotos registrados.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'register_remote_node',
    description: 'Registra o actualiza un nodo remoto de SofLIA. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID opcional del nodo.' },
        name: { type: 'STRING' as const, description: 'Nombre del nodo remoto.' },
        base_url: { type: 'STRING' as const, description: 'URL base del nodo remoto. Ejemplo: http://192.168.1.50:47825' },
        token: { type: 'STRING' as const, description: 'Token del nodo remoto.' },
        enabled: { type: 'BOOLEAN' as const, description: 'Si es false, queda registrado pero deshabilitado.' },
      },
      required: ['name', 'base_url', 'token'],
    },
  },
  {
    name: 'remove_remote_node',
    description: 'Elimina un nodo remoto registrado. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto a eliminar.' },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'test_remote_node',
    description: 'Prueba conectividad y capacidades de un nodo remoto.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
      },
      required: ['node_id'],
    },
  },
];
