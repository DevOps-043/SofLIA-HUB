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

export const SYSTEM_LABEL_IDS = new Set([
  'INBOX', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT',
  'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES', 'CATEGORY_FORUMS', 'CHAT',
]);
