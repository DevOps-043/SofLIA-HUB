using System;
internal static class HarmlessEngine {
    // Motor de prueba: no escribe archivos, no registra ni instala nada.
    public static int Main(string[] args) {
        if (Environment.GetEnvironmentVariable("PULSE_INSTALLER_TEST_SECRET") != null) return 91;
        if (args.Length < 4 || args[0] != "/S" || args[1] != "/currentuser" || args[2] != "/pulseShell" || !args[3].StartsWith("/D=")) return 92;
        return 23;
    }
}
