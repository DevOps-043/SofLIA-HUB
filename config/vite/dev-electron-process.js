var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { execSync, spawn } from 'node:child_process';
var electronRuntime = process;
export function stopElectronDevProcess() {
    return __awaiter(this, void 0, void 0, function () {
        var child;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    child = electronRuntime.electronApp;
                    if (!child)
                        return [2 /*return*/];
                    electronRuntime.electronApp = null;
                    child.removeAllListeners();
                    if (child.exitCode !== null || child.killed) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, new Promise(function (resolve) {
                            var settled = false;
                            var finish = function () {
                                if (settled)
                                    return;
                                settled = true;
                                resolve();
                            };
                            child.once('exit', finish);
                            try {
                                if (!child.pid) {
                                    finish();
                                    return;
                                }
                                if (process.platform === 'win32') {
                                    execSync("taskkill /pid ".concat(child.pid, " /T /F"), { stdio: 'ignore' });
                                }
                                else {
                                    child.kill('SIGTERM');
                                }
                            }
                            catch (_a) {
                                finish();
                            }
                            setTimeout(finish, 2000);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function startElectronDevProcess() {
    return __awaiter(this, arguments, void 0, function (argv) {
        var electronModule, electronPath, child;
        var _a;
        if (argv === void 0) { argv = ['.', '--no-sandbox']; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, import('electron')];
                case 1:
                    electronModule = _b.sent();
                    electronPath = typeof electronModule === 'string'
                        ? electronModule
                        : (_a = electronModule.default) !== null && _a !== void 0 ? _a : String(electronModule);
                    return [4 /*yield*/, stopElectronDevProcess()];
                case 2:
                    _b.sent();
                    child = spawn(electronPath, argv, {
                        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                    });
                    electronRuntime.electronApp = child;
                    child.once('exit', function () {
                        if (electronRuntime.electronApp === child) {
                            electronRuntime.electronApp = null;
                            process.exit();
                        }
                    });
                    return [2 /*return*/];
            }
        });
    });
}
