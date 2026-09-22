using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace PulseInstaller {
    internal sealed class InstallerWindow {
        readonly Window window;
        readonly OrbScene orb;
        readonly Button primary, secondary, motion;
        readonly TextBlock status, detail;
        readonly ProgressBar progress;
        CancellationTokenSource cancellation;
        bool active, writing, done, paused, closing, requiresRestart;
        int previewStep;
        string destination = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Pulse Hub");

        T Find<T>(string name) where T : class { return window.FindName(name) as T; }

        public InstallerWindow() {
            using (var xaml = Assembly.GetExecutingAssembly().GetManifestResourceStream("Pulse.Window")) window = (Window)XamlReader.Load(xaml);
            using (var logo = Assembly.GetExecutingAssembly().GetManifestResourceStream("Pulse.Logo")) {
                var bitmap = new BitmapImage(); bitmap.BeginInit(); bitmap.CacheOption = BitmapCacheOption.OnLoad; bitmap.StreamSource = logo; bitmap.EndInit(); bitmap.Freeze();
                Find<Image>("BrandLogo").Source = bitmap;
            }
            using (var icon = Assembly.GetExecutingAssembly().GetManifestResourceStream("Pulse.Icon")) {
                window.Icon = BitmapFrame.Create(icon, BitmapCreateOptions.None, BitmapCacheOption.OnLoad);
            }
            window.Width = Math.Min(980, SystemParameters.WorkArea.Width - 24);
            window.Height = Math.Min(640, window.Width * 640 / 980);
            if (window.Height > SystemParameters.WorkArea.Height - 24) { window.Height = SystemParameters.WorkArea.Height - 24; window.Width = window.Height * 980 / 640; }
            primary = Find<Button>("Primary"); secondary = Find<Button>("Secondary"); motion = Find<Button>("Motion");
            status = Find<TextBlock>("Status"); detail = Find<TextBlock>("Detail"); progress = Find<ProgressBar>("Progress");
            orb = new OrbScene(Find<Grid>("OrbHost"));
            paused = !SystemParameters.ClientAreaAnimation || SystemParameters.HighContrast;
            Find<TextBlock>("Version").Text = "WINDOWS x64   /   " + BuildInfo.Version;
            Find<Grid>("TitleBar").MouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs args) { if (args.OriginalSource is Grid || args.OriginalSource is TextBlock || args.OriginalSource is Image) window.DragMove(); };
            Find<Button>("Minimize").Click += delegate { window.WindowState = WindowState.Minimized; };
            Find<Button>("Close").Click += delegate { window.Close(); };
            motion.Click += delegate { paused = !paused; Motion(); };
            window.StateChanged += delegate { Motion(); };
            window.Closing += delegate(object sender, System.ComponentModel.CancelEventArgs args) {
                if (!active) return;
                args.Cancel = true;
                if (writing) { detail.Text = "La instalación sigue en curso. Puedes minimizar; se habilitará Cerrar al terminar."; return; }
                closing = true; cancellation.Cancel(); detail.Text = "Cancelando la preparación de forma segura…";
            };
            window.Closed += delegate { orb.Dispose(); if (cancellation != null) cancellation.Dispose(); };
            primary.Click += async delegate { await Start(); };
            secondary.Click += delegate {
                if (active) { if (!writing) cancellation.Cancel(); return; }
                if (done) { window.Close(); return; }
                Find<TextBox>("Destination").Text = destination;
                Find<TextBlock>("OptionsError").Text = "";
                Find<Border>("OptionsPanel").Visibility = Visibility.Visible;
                orb.SetVisible(false);
                Find<TextBox>("Destination").Focus();
            };
            Find<Button>("OptionsDone").Click += delegate {
                try { destination = InstallService.ValidateDestination(Find<TextBox>("Destination").Text); Find<Border>("OptionsPanel").Visibility = Visibility.Collapsed; orb.SetVisible(true); primary.Focus(); }
                catch (Exception error) { Find<TextBlock>("OptionsError").Text = error.Message; }
            };
            Find<Button>("OptionsCancel").Click += delegate { Find<Border>("OptionsPanel").Visibility = Visibility.Collapsed; orb.SetVisible(true); primary.Focus(); };
#if PREVIEW
            Find<TextBlock>("Footer").Text = "VISTA PREVIA · No instala Pulse Hub · Recursos gráficos temporales";
            primary.Content = "Ver estado de instalación   ↗";
#endif
            Motion();
        }

        void Motion() { motion.Content = paused ? "Activar animación" : "Pausar animación"; orb.SetMotion(!paused && window.WindowState != WindowState.Minimized); }

        void Update(InstallProgress value) {
            if (!active) return;
            writing = value.Phase == InstallPhase.Installing;
            progress.Visibility = Visibility.Visible;
            progress.IsIndeterminate = value.Phase != InstallPhase.Preparing;
            progress.Value = value.Percent;
            secondary.IsEnabled = !writing;
            status.Text = writing ? "Instalando tu nuevo espacio…" : value.Phase == InstallPhase.Verifying ? "Verificando la integridad del paquete…" : "Preparando el motor · " + value.Percent + "%";
            detail.Text = writing ? "Pulse Hub y Python privado · El motor no informa un porcentaje global. Puedes minimizar esta ventana." : "Preparación local. No se está descargando ningún componente.";
        }

        async Task Start() {
#if PREVIEW
            previewStep = (previewStep + 1) % 4;
            progress.Visibility = previewStep == 0 ? Visibility.Collapsed : Visibility.Visible;
            progress.IsIndeterminate = previewStep == 1;
            progress.Value = previewStep == 2 ? 100 : 0;
            orb.Busy = previewStep == 1;
            status.Text = new[] { "Un nuevo lugar para tus ideas.", "Instalando tu nuevo espacio…", "Todo listo. Hazlo tuyo.", "No se pudo completar la instalación." }[previewStep];
            detail.Text = new[] { "Demostración visual. No se instalará nada.", "VISTA PREVIA · Espera indeterminada durante la instalación real.", "VISTA PREVIA · Este estado no acredita una instalación.", "VISTA PREVIA · Así se muestra un error, con opción de reintentar." }[previewStep];
            primary.Content = "Ver siguiente estado   ↗";
            await Task.CompletedTask;
#else
            if (active) return;
            if (done) {
                if (requiresRestart) { window.Close(); return; }
                try { Process.Start(new ProcessStartInfo(Path.Combine(destination, InstallService.AppFile)) { UseShellExecute = false, WorkingDirectory = destination }); window.Close(); }
                catch (Exception) { detail.Text = "No se pudo abrir Pulse Hub. Inténtalo desde el menú Inicio."; }
                return;
            }
            active = true; writing = false; orb.Busy = true; primary.IsEnabled = false;
            secondary.Content = "Cancelar preparación";
            if (cancellation != null) cancellation.Dispose();
            cancellation = new CancellationTokenSource();
            try {
                destination = InstallService.ValidateDestination(destination);
                InstallService.EnsureAppClosed();
                var updates = new Progress<InstallProgress>(Update);
                int exit = await Task.Run(() => InstallService.Install(destination, updates, cancellation.Token));
                if (exit != 0 && exit != 3010) throw new InvalidOperationException("El motor terminó con código " + exit + ". Cierra Pulse Hub, revisa espacio y permisos de la carpeta y vuelve a intentarlo.");
                if (!File.Exists(Path.Combine(destination, InstallService.AppFile))) throw new InvalidOperationException("El motor terminó, pero no se encontró la aplicación en el destino. No se puede confirmar la instalación.");
                done = true;
                requiresRestart = exit == 3010;
                status.Text = "Todo listo. Hazlo tuyo.";
                detail.Text = exit == 3010 ? "Windows solicita un reinicio. Reinicia antes de abrir Pulse Hub." : "Pulse Hub y Python privado están instalados. Tú decides cuándo abrir la aplicación.";
                primary.Content = exit == 3010 ? "Cerrar" : "Abrir Pulse Hub   ↗";
                secondary.Content = "Cerrar";
                progress.IsIndeterminate = false; progress.Value = 100;
            } catch (OperationCanceledException) {
                status.Text = "Preparación cancelada."; detail.Text = "No se inició el motor de instalación.";
            } catch (Exception error) {
                status.Text = "No se pudo completar la instalación."; detail.Text = error.Message;
            } finally {
                active = false; writing = false; orb.Busy = false; primary.IsEnabled = true; secondary.IsEnabled = true;
                if (!done) { primary.Content = "Volver a intentar   ↗"; secondary.Content = "Opciones de instalación"; progress.Visibility = Visibility.Collapsed; }
                if (closing) window.Close();
            }
#endif
        }

        [STAThread]
        public static int Main(string[] args) {
            if (args.Length != 0) return 2; // Nunca aceptar /S, rutas a motores ni autoejecución.
            EmbeddedAssets.RegisterLibraries();
            bool owner;
            using (var mutex = new Mutex(true, "Local\\PulseHub.BrandedInstaller." + WindowsIdentity.GetCurrent().User.Value, out owner)) {
                if (!owner) { MessageBox.Show("Ya hay un instalador de Pulse Hub abierto.", "Pulse Hub"); return 1; }
                try { var app = new Application(); var ui = new InstallerWindow(); app.Run(ui.window); return 0; }
                catch (Exception) { MessageBox.Show("No se pudo abrir el instalador. Comprueba .NET Framework 4.8 y descarga una copia nueva si el problema continúa.", "Pulse Hub"); return 1; }
            }
        }
    }
}
