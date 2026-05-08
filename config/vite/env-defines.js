var RUNTIME_ENV_KEYS = new Set(['VITE_DEV_SERVER_URL', 'VITE_PUBLIC']);
export function createMainProcessEnvDefines(env) {
    var defines = {};
    for (var _i = 0, _a = Object.keys(env); _i < _a.length; _i++) {
        var key = _a[_i];
        if (RUNTIME_ENV_KEYS.has(key))
            continue;
        defines["process.env.".concat(key)] = JSON.stringify(env[key]);
    }
    return defines;
}
