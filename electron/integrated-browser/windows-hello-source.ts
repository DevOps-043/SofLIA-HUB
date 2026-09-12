// ABI comprobada contra los encabezados oficiales UserConsentVerifierInterop,
// windows.security.credentials.ui y AsyncInfo de microsoft/win32metadata.
// Sólo tipos del sistema: no descarga ensamblados ni solicita credenciales.
export const WINDOWS_HELLO_CSHARP = String.raw`
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
public static class PulseVaultHello {
  [DllImport("combase.dll")] static extern int RoInitialize(uint mode);
  [DllImport("combase.dll")] static extern void RoUninitialize();
  [DllImport("combase.dll", CharSet=CharSet.Unicode)] static extern int WindowsCreateString(string text, int length, out IntPtr value);
  [DllImport("combase.dll")] static extern int WindowsDeleteString(IntPtr value);
  [DllImport("combase.dll")] static extern int RoGetActivationFactory(IntPtr name, ref Guid iid, out IntPtr factory);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
  [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int AsyncCall(IntPtr self, out IntPtr operation);
  [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int VerifyCall(IntPtr self, IntPtr window, IntPtr message, ref Guid iid, out IntPtr operation);
  [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int IntegerCall(IntPtr self, out int value);
  [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int VoidCall(IntPtr self);
  static T Method<T>(IntPtr instance, int slot) where T : class {
    return Marshal.GetDelegateForFunctionPointer(Marshal.ReadIntPtr(Marshal.ReadIntPtr(instance), slot * IntPtr.Size), typeof(T)) as T;
  }
  static void Check(int result) { Marshal.ThrowExceptionForHR(result); }
  static IntPtr Factory(string iid) {
    string name = "Windows.Security.Credentials.UI.UserConsentVerifier";
    IntPtr text = IntPtr.Zero, factory = IntPtr.Zero; Guid id = new Guid(iid);
    try { Check(WindowsCreateString(name, name.Length, out text)); Check(RoGetActivationFactory(text, ref id, out factory)); return factory; }
    finally { if (text != IntPtr.Zero) WindowsDeleteString(text); }
  }
  static int Await(IntPtr operation) {
    IntPtr info = IntPtr.Zero; Guid iid = new Guid("00000036-0000-0000-C000-000000000046");
    try {
      Check(Marshal.QueryInterface(operation, ref iid, out info));
      var clock = Stopwatch.StartNew(); int status;
      do {
        Check(Method<IntegerCall>(info, 7)(info, out status));
        if (status != 0) break;
        if (clock.ElapsedMilliseconds >= 55000) { Method<VoidCall>(info, 9)(info); return -1; }
        Thread.Sleep(50);
      } while (true);
      if (status != 1) return -1;
      int result; Check(Method<IntegerCall>(operation, 8)(operation, out result)); return result;
    } finally {
      if (info != IntPtr.Zero) { Method<VoidCall>(info, 10)(info); Marshal.Release(info); }
      if (operation != IntPtr.Zero) Marshal.Release(operation);
    }
  }
  public static string Run(long handle, bool probe) {
    IntPtr factory = IntPtr.Zero, message = IntPtr.Zero;
    bool initialized = false;
    try {
      Check(RoInitialize(1)); initialized = true;
      factory = Factory("af4f3f91-564c-4ddc-b8b5-973447627c65");
      IntPtr operation; Check(Method<AsyncCall>(factory, 6)(factory, out operation));
      int available = Await(operation); Marshal.Release(factory); factory = IntPtr.Zero;
      if (available != 0) return "unavailable";
      factory = Factory("39E050C3-4E74-441A-8DC0-B81104DF949C");
      if (probe) return "available";
      IntPtr window = new IntPtr(handle);
      if (handle <= 0 || !IsWindow(window)) return "unavailable";
      string reason = "Desbloquear el gestor de contraseñas de Pulse Hub";
      Check(WindowsCreateString(reason, reason.Length, out message));
      Guid resultId = new Guid("fd596ffd-2318-558f-9dbe-d21df43764a5");
      Check(Method<VerifyCall>(factory, 6)(factory, window, message, ref resultId, out operation));
      int result = Await(operation);
      return result == 0 ? "verified" : result == 6 ? "cancelled" : "unavailable";
    } catch { return "unavailable"; }
    finally {
      if (message != IntPtr.Zero) WindowsDeleteString(message);
      if (factory != IntPtr.Zero) Marshal.Release(factory);
      if (initialized) RoUninitialize();
    }
  }
}
`;

export function windowsHelloScript(handle: bigint, probe = false): string {
  if (handle < 0n || handle > 0x7fffffffffffffffn || (!probe && handle === 0n)) throw new Error('Ventana de autenticación inválida.');
  return `$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
Add-Type -TypeDefinition @'
${WINDOWS_HELLO_CSHARP}
'@ -ErrorAction Stop
[Console]::Write([PulseVaultHello]::Run(${handle.toString()}, $${probe ? 'true' : 'false'}))
} catch { [Console]::Write('unavailable') }`;
}
