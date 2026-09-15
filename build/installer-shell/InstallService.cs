using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Threading;

namespace PulseInstaller {
    internal enum InstallPhase { Preparing, Verifying, Installing }
    internal sealed class InstallProgress {
        public readonly InstallPhase Phase;
        public readonly int Percent;
        public InstallProgress(InstallPhase phase, int percent) { Phase = phase; Percent = percent; }
    }
    internal static class InstallService {
        public const string AppFile = "Pulse Hub.exe";

        public static string ValidateDestination(string value) {
            if (String.IsNullOrWhiteSpace(value) || value.Length > 180 || value != value.Trim() ||
                !System.Text.RegularExpressions.Regex.IsMatch(value, @"^[A-Za-z]:\\") ||
                value.Substring(3).IndexOfAny(new[] { ':', '"', '\'', '<', '>', '|', '?', '*', '\r', '\n', '\t' }) >= 0)
                throw new InvalidOperationException("Elige una ruta local válida de hasta 180 caracteres, sin comillas ni caracteres especiales.");
            string full = Path.GetFullPath(value).TrimEnd('\\');
            if (full.Length <= 3 || !String.Equals(full, value.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Usa una carpeta dedicada, sin segmentos relativos ni la raíz del disco.");
            foreach (string part in full.Substring(3).Split('\\'))
                if (part.EndsWith(".") || part.EndsWith(" ") || part.Length == 0)
                    throw new InvalidOperationException("La carpeta contiene segmentos ambiguos.");
            for (var dir = new DirectoryInfo(full); dir != null; dir = dir.Parent)
                if (dir.Exists && (dir.Attributes & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidOperationException("La carpeta de instalación no puede atravesar enlaces o redirecciones.");
            string windows = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
            if (full.StartsWith(windows.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase) || String.Equals(full, windows, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("No se puede instalar dentro de la carpeta de Windows.");
            if (File.Exists(full)) throw new InvalidOperationException("El destino es un archivo, no una carpeta.");
            if (Directory.Exists(full) && Directory.GetFileSystemEntries(full).Length > 0 &&
                !(File.Exists(Path.Combine(full, AppFile)) && File.Exists(Path.Combine(full, "Uninstall Pulse Hub.exe"))))
                throw new InvalidOperationException("La carpeta contiene otros archivos. Elige una carpeta vacía o una instalación de Pulse Hub.");
            return full;
        }

        public static string Arguments(string destination) {
            // NSIS exige /D al final y sin comillas. La validación excluye saltos y comillas.
            return "/S /currentuser /pulseShell /D=" + ValidateDestination(destination);
        }

        public static void EnsureAppClosed() {
            foreach (var process in Process.GetProcessesByName("Pulse Hub")) {
                using (process) {
                    if (!process.HasExited) throw new InvalidOperationException("Cierra Pulse Hub, incluida su bandeja del sistema, y vuelve a intentarlo. No cerraremos tu trabajo automáticamente.");
                }
            }
        }

        public static void CopyVerified(Stream source, Stream destination, string expectedHash, IProgress<InstallProgress> progress, CancellationToken token) {
            if (source.Length <= 0 || source.Length > 2L * 1024 * 1024 * 1024 ||
                !System.Text.RegularExpressions.Regex.IsMatch(expectedHash ?? "", "^[a-f0-9]{64}$"))
                throw new InvalidOperationException("El paquete integrado no es válido.");
            using (var hash = SHA256.Create()) {
                byte[] buffer = new byte[128 * 1024];
                long total = 0;
                int last = -1, count;
                while ((count = source.Read(buffer, 0, buffer.Length)) != 0) {
                    token.ThrowIfCancellationRequested();
                    destination.Write(buffer, 0, count);
                    hash.TransformBlock(buffer, 0, count, buffer, 0);
                    total += count;
                    int percent = (int)(total * 100 / source.Length);
                    if (percent != last) { progress.Report(new InstallProgress(InstallPhase.Preparing, percent)); last = percent; }
                }
                hash.TransformFinalBlock(new byte[0], 0, 0);
                destination.Flush();
                token.ThrowIfCancellationRequested();
                progress.Report(new InstallProgress(InstallPhase.Verifying, 100));
                string actual = BitConverter.ToString(hash.Hash).Replace("-", "").ToLowerInvariant();
                if (actual != expectedHash) throw new InvalidOperationException("El paquete no superó la verificación de integridad. Descarga otra copia del instalador.");
            }
        }

        public static int Install(string destination, IProgress<InstallProgress> progress, CancellationToken token) {
#if PREVIEW
            throw new InvalidOperationException("La vista previa no contiene un motor de instalación.");
#else
            string arguments = Arguments(destination);
            EnsureAppClosed();
            string stage = Path.Combine(Path.GetTempPath(), "PulseHub-install-" + Guid.NewGuid().ToString("N"));
            var security = new DirectorySecurity();
            var sid = WindowsIdentity.GetCurrent().User;
            security.SetAccessRuleProtection(true, false);
            security.AddAccessRule(new FileSystemAccessRule(sid, FileSystemRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            Directory.CreateDirectory(stage, security);
            string payload = Path.Combine(stage, "engine.exe");
            try {
                using (var source = Assembly.GetExecutingAssembly().GetManifestResourceStream("Pulse.Payload")) {
                    if (source == null) throw new InvalidOperationException("Falta el motor integrado de instalación.");
                    using (var output = new FileStream(payload, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.Read)) {
                        CopyVerified(source, output, BuildInfo.PayloadHash, progress, token);
                    }
                    using (var locked = new FileStream(payload, FileMode.Open, FileAccess.Read, FileShare.Read)) {
                        // Windows no permite ejecutar una imagen abierta para escritura.
                        // Revalidar bajo un bloqueo de lectura cierra el intervalo entre handles.
                        using (var hash = SHA256.Create()) {
                            string actual = BitConverter.ToString(hash.ComputeHash(locked)).Replace("-", "").ToLowerInvariant();
                            if (actual != BuildInfo.PayloadHash) throw new InvalidOperationException("El motor extraído fue modificado. No se ejecutará.");
                        }
                        token.ThrowIfCancellationRequested();
                        EnsureAppClosed();
                        // El archivo queda abierto sin compartir escritura/borrado hasta que termine el motor.
                        var start = new ProcessStartInfo(payload, arguments) {
                            UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = stage
                        };
                        // No transmitir credenciales del proceso padre a NSIS ni a sus subprocesos.
                        start.EnvironmentVariables.Clear();
                        foreach (string key in new[] { "SystemRoot", "WINDIR", "ComSpec", "PATH", "PATHEXT", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "USERNAME" }) {
                            string value = Environment.GetEnvironmentVariable(key);
                            if (value != null) start.EnvironmentVariables[key] = value;
                        }
                        progress.Report(new InstallProgress(InstallPhase.Installing, 0));
                        using (var child = Process.Start(start)) {
                            if (child == null) throw new InvalidOperationException("No se pudo iniciar el motor de instalación.");
                            // No cancelar ni matar un motor que ya está escribiendo archivos.
                            child.WaitForExit();
                            return child.ExitCode;
                        }
                    }
                }
            } finally {
                // Solo los dos objetos creados aquí; jamás borrado recursivo ni del destino.
                try { if (File.Exists(payload)) File.Delete(payload); Directory.Delete(stage, false); }
                catch (IOException) { /* Windows puede retener el ejecutable: se conserva el temporal. */ }
                catch (UnauthorizedAccessException) { /* Se conserva el temporal sin elevar permisos. */ }
            }
#endif
        }
    }
}
