/**
 * ¿El mensaje pide EJECUTAR algo?
 *
 * De esto depende que el agente pueda usar herramientas operativas: con `false`,
 * `guardUnrequestedOperationalTools` las bloquea todas y fuerza una respuesta de
 * texto. Es decir, un verbo que falte aqui no degrada la deteccion: apaga la
 * capacidad de actuar y el agente contesta explicando como hacerlo a mano.
 *
 * Las dos listas se mantienen en paralelo a proposito: la forma imperativa es
 * como se escribe la orden directa ("activa el modo orbe") y la infinitiva es la
 * que sigue a una formula cortes ("puedes activar el modo orbe"). Cuando agregues
 * un verbo, agregalo en AMBAS.
 */
const ACTION_VERBS_IMPERATIVE = [
  'organiza', 'crea', 'envia', 'enviame', 'mandame', 'pasame', 'comparteme', 'adjunta', 'busca',
  'descarga', 'sube', 'elimina', 'borra', 'abre', 'programa', 'mueve', 'copia', 'lee', 'revisa',
  'hazme', 'haz', 'manda', 'pon', 'mete', 'clasifica', 'ordena', 'etiqueta', 'agenda', 'escribe',
  'genera', 'analiza', 'actualiza', 'cambia', 'guardalo', 'guarda', 'recuerda', 'llamame', 'saca',
  'quita', 'repite', 'termina', 'continua', 'rehaz', 'reintenta',
  // Control de la aplicacion y del sistema: faltaban por completo, asi que
  // "activa el modo orbe" o "reinicia el servicio" no contaban como acciones.
  'activa', 'activame', 'desactiva', 'ejecuta', 'corre', 'reinicia', 'conecta', 'desconecta',
  'instala', 'desinstala', 'muestra', 'muestrame', 'configura', 'inicia', 'deten', 'detente',
  'cierra', 'apaga', 'enciende', 'verifica', 'comprueba', 'checa',
];

const ACTION_VERBS_INFINITIVE = [
  'organizar', 'crear', 'enviar', 'mandar', 'pasar', 'compartir', 'adjuntar', 'buscar', 'descargar',
  'subir', 'eliminar', 'borrar', 'abrir', 'programar', 'mover', 'copiar', 'leer', 'revisar', 'hacer',
  'generar', 'analizar', 'actualizar', 'cambiar', 'guardar', 'recordar', 'etiquetar', 'clasificar',
  'ordenar', 'sacar', 'quitar', 'repetir', 'terminar', 'continuar', 'rehacer', 'reintentar',
  'activar', 'desactivar', 'ejecutar', 'correr', 'reiniciar', 'conectar', 'desconectar',
  'instalar', 'desinstalar', 'mostrar', 'configurar', 'iniciar', 'detener', 'cerrar', 'apagar',
  'encender', 'verificar', 'comprobar', 'checar',
];

/** Formulas que introducen una orden sin llevar el verbo pegado. */
const ACTION_PHRASES = [
  'necesito que', 'ayudame a', 'volver a', 'vuelve a', 'hazlo otra vez', 'otra vez', 'sigue con',
  'intenta de nuevo', 'volver a intentar',
];

const POLITE_OPENERS = ['puedes', 'podrias', 'me ayudas a', 'puedes ayudarme a'];

function alternation(values: string[]): string {
  return values.join('|');
}

/**
 * Pronombre enclitico opcional. En español se pega al verbo constantemente
 * ("activarlo", "reinicialo", "mostrarme") y sin esto el limite de palabra
 * impedia reconocer la orden.
 */
const ENCLITIC = '(?:melo|mela|selo|sela|nos|los|las|me|te|lo|la|le|se)?';

const ACTION_PATTERN = new RegExp(
  `\\b(${alternation([...ACTION_VERBS_IMPERATIVE, ...ACTION_VERBS_INFINITIVE])})${ENCLITIC}\\b`
  + `|\\b(${alternation(ACTION_PHRASES)})\\b`,
  'i',
);

/**
 * "Puedes <verbo de accion>" si cuenta como orden, pero "puedes platicar
 * conmigo" no: la cortesia sola no basta, tiene que aparecer un verbo operativo.
 */
const POLITE_ACTION_PATTERN = new RegExp(
  `\\b(${alternation(POLITE_OPENERS)})\\b.{0,80}\\b(${alternation(ACTION_VERBS_INFINITIVE)})${ENCLITIC}\\b`,
  'i',
);

const RESEARCH_PATTERN = /\b(investiga|investigar|averigua|averiguar|indaga|indagar|consulta|consultar|profundiza|profundizar)\b/i;

export function detectActionRequest(message: string): boolean {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return RESEARCH_PATTERN.test(normalized) || ACTION_PATTERN.test(normalized) || POLITE_ACTION_PATTERN.test(normalized);
}
