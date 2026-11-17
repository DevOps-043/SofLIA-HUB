// Cargar únicamente los servicios usados evita parsear el catálogo completo de
// Google tanto en TypeScript como al abrir una conexión en el proceso main.
import { calendar } from 'googleapis/build/src/apis/calendar/index.js';
import { drive } from 'googleapis/build/src/apis/drive/index.js';
import { gmail } from 'googleapis/build/src/apis/gmail/index.js';
import { chat } from 'googleapis/build/src/apis/chat/index.js';
import { oauth2, auth } from 'googleapis/build/src/apis/oauth2/index.js';
export { googleAuthLibrary as Auth } from 'googleapis-common';

export const google = { calendar, drive, gmail, chat, oauth2, auth };
