/**
 * Constantes de dominio para clasificación de remitentes Gmail.
 *
 * Aisladas en un archivo para que sean fáciles de revisar y extender.
 * Si se agrega soporte para nuevos TLDs o brands, este es el único lugar.
 */

/**
 * TLDs de segundo nivel donde el dominio "real" tiene 3 partes en lugar de 2.
 * Necesario para que `getBaseDomain('mail.empresa.com.mx')` devuelva
 * `empresa.com.mx` y no `com.mx`.
 */
export const SECOND_LEVEL_TLDS = new Set([
  'com.mx',
  'com.br',
  'com.ar',
  'co.uk',
  'org.uk',
  'gov.uk',
  'com.au',
  'com.co',
  'com.pe',
  'com.ve',
]);

/**
 * Dominios genéricos donde el "remitente" no aporta información de marca.
 * Para emails de estos dominios, agrupamos por persona en lugar de por dominio.
 */
export const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
]);

/**
 * Mapeo de dominios conocidos → nombre de marca presentable.
 * Usado para que las etiquetas autocreadas tengan nombres legibles
 * en lugar de identificadores técnicos.
 */
export const BRAND_LABELS = new Map<string, string>([
  ['openai.com', 'OpenAI'],
  ['anthropic.com', 'Anthropic'],
  ['google.com', 'Google'],
  ['github.com', 'GitHub'],
  ['microsoft.com', 'Microsoft'],
  ['supabase.com', 'Supabase'],
  ['deeplearning.ai', 'DeepLearning.AI'],
  ['notion.so', 'Notion'],
  ['stripe.com', 'Stripe'],
  ['slack.com', 'Slack'],
  ['zoom.us', 'Zoom'],
]);
