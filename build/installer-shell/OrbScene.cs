using System;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace PulseInstaller {
    // Host local del componente React original; no hay mallas alternativas ni herramientas nativas expuestas.
    internal sealed class OrbScene : IDisposable {
        readonly Grid host;
        WebView2 view;
        bool ready, disposed, motion = true, busy;
        const string Origin = "https://installer.pulse.invalid/";
        public bool Busy { get { return busy; } set { busy = value; SendState(); } }

        public OrbScene(Grid target) {
            host = target;
            // Esperar HWND y Dispatcher de WPF: antes de Loaded el await pierde el contexto UI.
            host.Loaded += Loaded;
        }
        void Loaded(object sender, RoutedEventArgs args) { host.Loaded -= Loaded; Initialize(); }

        async void Initialize() {
            string phase = "recursos";
            try {
                string stage = EmbeddedAssets.ExtractOrb();
                phase = "runtime";
                CoreWebView2Environment.SetLoaderDllFolderPath(stage);
                var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(stage, "profile"));
                phase = "control";
                if (disposed) return;
                view = new WebView2 { DefaultBackgroundColor = System.Drawing.Color.Transparent, AllowExternalDrop = false };
                host.Children.Add(view);
                await view.EnsureCoreWebView2Async(environment);
                phase = "políticas";
                if (disposed) return;
                var core = view.CoreWebView2;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false;
                core.Settings.AreHostObjectsAllowed = false;
                core.Settings.IsGeneralAutofillEnabled = false;
                core.Settings.IsPasswordAutosaveEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsZoomControlEnabled = false;
                core.Settings.IsPinchZoomEnabled = false;
                core.Settings.AreDefaultScriptDialogsEnabled = false;
                core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs args) { args.Handled = true; };
                core.DownloadStarting += delegate(object sender, CoreWebView2DownloadStartingEventArgs args) { args.Cancel = true; };
                core.PermissionRequested += delegate(object sender, CoreWebView2PermissionRequestedEventArgs args) { args.State = CoreWebView2PermissionState.Deny; args.Handled = true; };
                core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs args) { args.Cancel = args.Uri != Origin + "index.html"; };
                core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
                core.WebResourceRequested += delegate(object sender, CoreWebView2WebResourceRequestedEventArgs args) {
                    if (!args.Request.Uri.StartsWith(Origin, StringComparison.Ordinal)) args.Response = environment.CreateWebResourceResponse(null, 403, "Bloqueado", "");
                };
                core.SetVirtualHostNameToFolderMapping("installer.pulse.invalid", Path.Combine(stage, "content"), CoreWebView2HostResourceAccessKind.DenyCors);
                core.NavigationCompleted += delegate(object sender, CoreWebView2NavigationCompletedEventArgs args) {
                    if (!args.IsSuccess) { ShowFailure(); return; }
                    ready = true; SendState();
                };
                core.ProcessFailed += delegate { ShowFailure(); };
                core.Navigate(Origin + "index.html");
            } catch (Exception error) { if (!disposed) ShowFailure(phase + " / " + error.GetType().Name + " / " + error.HResult.ToString("X8")); }
        }

        void ShowFailure(string code = "navegación") {
            ready = false;
            if (view != null) { view.Dispose(); view = null; }
            host.Children.Clear();
            host.Children.Add(new TextBlock {
                Text = "No se pudo cargar la orbe original. Requiere WebView2 y aceleración WebGL.\n\nPuedes continuar con la instalación.\n\nCódigo: " + code,
                TextWrapping = TextWrapping.Wrap, Foreground = new SolidColorBrush(Color.FromRgb(172, 195, 206)),
                Margin = new Thickness(40), VerticalAlignment = VerticalAlignment.Center
            });
        }

        void SendState() {
            if (!ready || disposed || view == null) return;
            view.CoreWebView2.PostWebMessageAsJson("{\"type\":\"installer-orb-state\",\"visualState\":\"" + (busy ? "thinking" : "idle") + "\",\"motion\":" + (motion ? "true" : "false") + "}");
        }
        public void SetMotion(bool enabled) { motion = enabled; SendState(); }
        public void SetVisible(bool visible) { host.Visibility = visible ? Visibility.Visible : Visibility.Hidden; }
        public void Dispose() { disposed = true; ready = false; host.Loaded -= Loaded; if (view != null) { view.Dispose(); view = null; } }
    }
}
