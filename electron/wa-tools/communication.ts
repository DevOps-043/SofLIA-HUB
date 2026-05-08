import { APP_CHAT_TOOLS } from './communication/app-chat';
import { EMAIL_TOOLS } from './communication/email';
import { FILE_DELIVERY_TOOLS } from './communication/file-delivery';
import { WEB_ACCESS_TOOLS } from './communication/web-access';

export const COMMUNICATION_TOOLS = [
  ...FILE_DELIVERY_TOOLS,
  ...APP_CHAT_TOOLS,
  ...WEB_ACCESS_TOOLS,
  ...EMAIL_TOOLS,
];
