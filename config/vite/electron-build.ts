import { builtinModules } from 'node:module';

type RollupWarning = { code?: string; message: string };
type WarningHandler = (warning: RollupWarning) => void;

const COMMONJS_NATIVE_OPTIONALS = ['bufferutil', 'utf-8-validate'];

export function createElectronExternals(dependencies: Record<string, string> = {}): string[] {
  return [
    ...builtinModules,
    ...builtinModules.map((moduleName) => `node:${moduleName}`),
    ...Object.keys(dependencies).filter((dependency) => dependency !== '@whiskeysockets/baileys'),
    ...COMMONJS_NATIVE_OPTIONALS,
  ];
}

export function onElectronRollupWarning(warning: RollupWarning, warn: WarningHandler): void {
  if (isIgnorableRollupWarning(warning)) return;
  warn(warning);
}

function isIgnorableRollupWarning(warning: RollupWarning): boolean {
  if (
    warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
    warning.message.includes('"WriteStream" is imported from external module "fs" but never used')
  ) {
    return true;
  }

  if (
    warning.code === 'EVAL' &&
    warning.message.includes('Use of eval in "node_modules/@protobufjs/inquire/index.js"')
  ) {
    return true;
  }

  return false;
}
