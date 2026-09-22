using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Threading;
using PulseInstaller;

internal sealed class Updates : IProgress<InstallProgress> {
    internal readonly List<InstallProgress> Items = new List<InstallProgress>();
    public void Report(InstallProgress value) { Items.Add(value); }
}
internal static class ServiceTests {
    static int count;
    static void Check(bool value, string name) { if (!value) throw new Exception(name); count++; }
    static void Reject(Action action, string name) { bool rejected = false; try { action(); } catch (InvalidOperationException) { rejected = true; } Check(rejected, name); }
    public static int Main() {
        string safe = Path.Combine(Path.GetTempPath(), "PulseHub-destino-" + Guid.NewGuid().ToString("N"));
        try {
            foreach (string value in new[] { "", " ", "C:\\", "C:", @"\\servidor\destino", @"C:\uno\..\dos", "C:\\uno\nmal", "C:\\uno\rmal", "C:\\uno\tmal", "C:\\uno\"mal", "C:\\uno'mal", @"C:\uno:flujo", @"C:\uno.\dos", @"C:\uno \dos", @"C:\uno|dos", @"C:\uno?dos", @"C:\uno*dos", "C:\\" + new string('a', 180), Environment.GetFolderPath(Environment.SpecialFolder.Windows) })
                Reject(() => InstallService.ValidateDestination(value), "rechazar destino: " + value);
            Check(InstallService.ValidateDestination(safe) == safe, "aceptar carpeta nueva");
            Check(InstallService.Arguments(safe + " con espacio") == "/S /currentuser /pulseShell /D=" + safe + " con espacio", "argumentos fijos con espacios");
            byte[] bytes = new byte[300000]; new Random(41).NextBytes(bytes);
            string expected;
            using (var hash = SHA256.Create()) expected = BitConverter.ToString(hash.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
            var updates = new Updates();
            using (var source = new MemoryStream(bytes)) using (var target = new MemoryStream()) {
                InstallService.CopyVerified(source, target, expected, updates, CancellationToken.None);
                Check(target.Length == bytes.Length, "copiar todos los bytes");
                Check(updates.Items[updates.Items.Count - 1].Phase == InstallPhase.Verifying, "verificación posterior a extracción");
                Check(updates.Items[updates.Items.Count - 2].Percent == 100, "progreso medido al completar bytes");
            }
            Reject(() => { using (var source = new MemoryStream(bytes)) using (var target = new MemoryStream()) InstallService.CopyVerified(source, target, new string('0', 64), new Updates(), CancellationToken.None); }, "rechazar hash distinto");
            Reject(() => { using (var source = new MemoryStream()) using (var target = new MemoryStream()) InstallService.CopyVerified(source, target, expected, new Updates(), CancellationToken.None); }, "rechazar payload vacío");
            var cancel = new CancellationTokenSource(); cancel.Cancel(); bool cancelled = false;
            using (var source = new MemoryStream(bytes)) using (var target = new MemoryStream()) {
                try { InstallService.CopyVerified(source, target, expected, new Updates(), cancel.Token); } catch (OperationCanceledException) { cancelled = true; }
                Check(cancelled && target.Length == 0, "cancelación antes de escribir");
            }
            cancel.Dispose();
            Environment.SetEnvironmentVariable("PULSE_INSTALLER_TEST_SECRET", "valor-sintético-no-propagar");
            var execution = new Updates();
            int exit = InstallService.Install(safe, execution, CancellationToken.None);
            Check(exit == 23, "ejecutar motor inocuo conservando código y sin propagar variable ajena");
            Check(!Directory.Exists(safe), "motor de prueba no instala ni crea destino");
            Check(execution.Items[execution.Items.Count - 1].Phase == InstallPhase.Installing, "estado real antes del proceso");
            Console.WriteLine("Instalador: " + count + " comprobaciones nativas correctas; motor inocuo, sin instalación.");
            return 0;
        } catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
