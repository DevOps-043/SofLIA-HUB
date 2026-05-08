var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { builtinModules } from 'node:module';
var COMMONJS_NATIVE_OPTIONALS = ['bufferutil', 'utf-8-validate'];
export function createElectronExternals(dependencies) {
    if (dependencies === void 0) { dependencies = {}; }
    return __spreadArray(__spreadArray(__spreadArray(__spreadArray([], builtinModules, true), builtinModules.map(function (moduleName) { return "node:".concat(moduleName); }), true), Object.keys(dependencies).filter(function (dependency) { return dependency !== '@whiskeysockets/baileys'; }), true), COMMONJS_NATIVE_OPTIONALS, true);
}
export function onElectronRollupWarning(warning, warn) {
    if (isIgnorableRollupWarning(warning))
        return;
    warn(warning);
}
function isIgnorableRollupWarning(warning) {
    if (warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
        warning.message.includes('"WriteStream" is imported from external module "fs" but never used')) {
        return true;
    }
    if (warning.code === 'EVAL' &&
        warning.message.includes('Use of eval in "node_modules/@protobufjs/inquire/index.js"')) {
        return true;
    }
    return false;
}
