import os from 'node:os';
import path from 'node:path';

export const TYPE_CATEGORIES: Record<string, string[]> = {
  Documentos: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv', 'epub'],
  Imagenes: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif', 'raw', 'heic', 'heif', 'avif'],
  Videos: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'mpg', 'mpeg', 'm4v', '3gp'],
  Audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus', 'aiff'],
  Comprimidos: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'cab', 'iso'],
  Programas: ['exe', 'msi', 'dmg', 'deb', 'rpm', 'appimage', 'bat', 'cmd', 'ps1', 'sh'],
  Codigo: ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sql', 'md'],
  Fuentes: ['ttf', 'otf', 'woff', 'woff2', 'eot'],
  Diseno: ['psd', 'ai', 'sketch', 'fig', 'xd', 'indd', 'cdr'],
  Datos: ['db', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'bak'],
};

export const MANIFEST_DIR = path.join(os.homedir(), '.soflia-hub', 'file-op-manifests');
