using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.Versioning;

[assembly: TargetFramework(".NETFramework,Version=v4.8")]
namespace SofliaVoiceEngine {
  internal static class RestoreEngine {
    private const long MaximumBytes = 2L * 1024 * 1024 * 1024;
    private static void AssertNoLinks(string path) {
      for (var current = new DirectoryInfo(path); current != null; current = current.Parent) {
        if ((Directory.Exists(current.FullName) || File.Exists(current.FullName)) &&
            (File.GetAttributes(current.FullName) & FileAttributes.ReparsePoint) != 0)
          throw new InvalidDataException("El destino contiene un enlace.");
      }
    }
    internal static string EntryDestination(string stage, string name) {
      name = name.Replace('\\', '/');
      if (name.Length == 0 || name.StartsWith("/") || name.IndexOf(':') >= 0)
        throw new InvalidDataException("Ruta de archivo no permitida.");
      var parts = name.TrimEnd('/').Split('/');
      foreach (var part in parts) {
        if (part.Length == 0 || part == "." || part == ".." || part.EndsWith(".") || part.EndsWith(" ") || part.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
          throw new InvalidDataException("Ruta de archivo no permitida.");
      }
      var resolved = Path.GetFullPath(Path.Combine(stage, name.Replace('/', Path.DirectorySeparatorChar)));
      if (!resolved.StartsWith(Path.GetFullPath(stage) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        throw new InvalidDataException("El archivo sale del directorio de preparación.");
      return resolved;
    }
    private static bool Inside(string path, string root) {
      return !String.IsNullOrEmpty(root) && path.StartsWith(Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
    }
    private static void Extract(string stage) {
      using (var input = Assembly.GetExecutingAssembly().GetManifestResourceStream("Soflia.VoiceEngine")) {
        if (input == null) throw new InvalidDataException("Falta el motor integrado.");
        using (var zip = new ZipArchive(input, ZipArchiveMode.Read)) {
          if (zip.Entries.Count > 50000) throw new InvalidDataException("Demasiados archivos.");
          long total = 0;
          foreach (var entry in zip.Entries) {
            if (((entry.ExternalAttributes >> 16) & 0xF000) == 0xA000 || (entry.ExternalAttributes & (int)FileAttributes.ReparsePoint) != 0)
              throw new InvalidDataException("El paquete contiene un enlace.");
            var destination = EntryDestination(stage, entry.FullName);
            if (entry.FullName.EndsWith("/")) { Directory.CreateDirectory(destination); continue; }
            total = checked(total + entry.Length);
            if (total > MaximumBytes) throw new InvalidDataException("El motor supera el tamaño permitido.");
            Directory.CreateDirectory(Path.GetDirectoryName(destination));
            AssertNoLinks(destination);
            using (var source = entry.Open())
            using (var output = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None)) {
              var buffer = new byte[65536];
              long written = 0; int size;
              while ((size = source.Read(buffer, 0, buffer.Length)) > 0) {
                written = checked(written + size);
                if (written > entry.Length) throw new InvalidDataException("Tamaño de archivo incorrecto.");
                output.Write(buffer, 0, size);
              }
              if (written != entry.Length) throw new InvalidDataException("Archivo incompleto.");
            }
          }
        }
      }
      foreach (var file in new[] { "python/python.exe", "python-sidecar/main.py", "python-tools/main.py", "models/vosk-model-small-es-0.42/am/final.mdl", "models/vosk-model-small-es-0.42/conf/model.conf" }) {
        var item = new FileInfo(Path.Combine(stage, file.Replace('/', Path.DirectorySeparatorChar)));
        if (!item.Exists || item.Length == 0) throw new InvalidDataException("Motor incompleto.");
      }
    }
    private static int Main(string[] args) {
      try {
        AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling", false);
        AppContext.SetSwitch("Switch.System.IO.BlockLongPaths", false);
        if (args.Length != 2 || args[0] != "--destination" || !Path.IsPathRooted(args[1])) throw new ArgumentException("Destino inválido.");
        var destination = Path.GetFullPath(args[1]).TrimEnd(Path.DirectorySeparatorChar);
        var folder = new DirectoryInfo(destination);
        if (folder.Name != BuildInfo.Version || folder.Parent == null || folder.Parent.Name != "voice-engine" ||
            !(Inside(destination, Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData)) || Inside(destination, Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData))))
          throw new ArgumentException("El destino debe ser el motor versionado del perfil.");
        AssertNoLinks(destination);
        Directory.CreateDirectory(folder.Parent.FullName);
        AssertNoLinks(destination);
        var lockFile = Path.Combine(folder.Parent.FullName, ".restore.lock");
        AssertNoLinks(lockFile);
        using (var mutex = new FileStream(lockFile, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None)) {
          var stage = Path.Combine(folder.Parent.FullName, ".staging-" + Guid.NewGuid().ToString("N"));
          Directory.CreateDirectory(stage);
          Extract(stage);
          AssertNoLinks(destination);
          string backup = null;
          if (Directory.Exists(destination)) {
            backup = Path.Combine(folder.Parent.FullName, ".previous-" + Guid.NewGuid().ToString("N"));
            Directory.Move(destination, backup);
          }
          try { Directory.Move(stage, destination); }
          catch { if (backup != null) Directory.Move(backup, destination); throw; }
        }
        Console.WriteLine("voice-engine-restored");
        return 0;
      } catch {
        Console.Error.WriteLine("No se pudo restaurar el motor de voz de forma segura.");
        return 1;
      }
    }
  }
}
