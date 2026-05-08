import { BASIC_FILE_TOOLS } from './filesystem/basic';
import { BULK_FILE_TOOLS } from './filesystem/bulk';
import { CLIPBOARD_AND_SEARCH_TOOLS } from './filesystem/clipboard-search';

export const FILESYSTEM_TOOLS = [
  ...BASIC_FILE_TOOLS,
  ...BULK_FILE_TOOLS,
  ...CLIPBOARD_AND_SEARCH_TOOLS,
];
