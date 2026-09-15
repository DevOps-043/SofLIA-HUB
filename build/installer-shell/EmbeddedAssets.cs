using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Principal;

namespace PulseInstaller {
    internal static class EmbeddedAssets {
        public static void RegisterLibraries() {
            AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs args) {
                string name = new AssemblyName(args.Name).Name;
                if (name != "Microsoft.Web.WebView2.Core" && name != "Microsoft.Web.WebView2.Wpf") return null;
                using (var source = Assembly.GetExecutingAssembly().GetManifestResourceStream("Pulse." + name)) {
                    if (source == null) return null;
                    using (var memory = new MemoryStream()) { source.CopyTo(memory); return Assembly.Load(memory.ToArray()); }
                }
            };
        }

        public static string ExtractOrb() {
            string stage = Path.Combine(Path.GetTempPath(), "PulseHub-orb-" + Guid.NewGuid().ToString("N"));
            var security = new DirectorySecurity();
            security.SetAccessRuleProtection(true, false);
            security.AddAccessRule(new FileSystemAccessRule(WindowsIdentity.GetCurrent().User, FileSystemRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            Directory.CreateDirectory(stage, security);
            string content = Path.Combine(stage, "content");
            Directory.CreateDirectory(content);
            using (var source = Assembly.GetExecutingAssembly().GetManifestResourceStream("Pulse.Orb"))
            using (var zip = new ZipArchive(source, ZipArchiveMode.Read)) {
                if (zip.Entries.Count > 80) throw new InvalidOperationException("Demasiados recursos de orbe.");
                long total = 0;
                foreach (var entry in zip.Entries) {
                    if (entry.FullName.EndsWith("/")) continue;
                    total += entry.Length;
                    if (entry.Length > 8 * 1024 * 1024 || total > 40 * 1024 * 1024 || entry.FullName.Contains("\\") || entry.FullName.Contains(":") || entry.FullName.Contains(".."))
                        throw new InvalidOperationException("Recurso de orbe inválido.");
                    string file = Path.GetFullPath(Path.Combine(content, entry.FullName));
                    if (!file.StartsWith(content + "\\", StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Recurso fuera del directorio privado.");
                    Directory.CreateDirectory(Path.GetDirectoryName(file));
                    using (var input = entry.Open()) using (var output = new FileStream(file, FileMode.CreateNew)) input.CopyTo(output);
                }
            }
            using (var input = Assembly.GetExecutingAssembly().GetManifestResourceStream("Pulse.WebView2Loader"))
            using (var output = new FileStream(Path.Combine(stage, "WebView2Loader.dll"), FileMode.CreateNew)) input.CopyTo(output);
            return stage;
        }
    }
}
