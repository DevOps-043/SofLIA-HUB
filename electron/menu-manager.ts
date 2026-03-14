import { Menu, app } from 'electron';

/**
 * Gestiona la configuración del menú de la aplicación.
 * Siguiendo principios de modularidad y limpieza de código,
 * este servicio centraliza la definición de la interfaz de menús.
 */
export class MenuManager {
  /**
   * Configura el menú de la aplicación eliminando los elementos 'File', 'Edit' y 'View'
   * según lo solicitado para mantener una UI más limpia y enfocada.
   */
  static setup() {
    const isMac = process.platform === 'darwin';

    // Definimos una plantilla modular que excluye File, Edit y View.
    // En Windows/Linux, si estos se eliminan, la barra queda muy vacía o innecesaria.
    // Si la intención es ocultar totalmente la barra pero mantener consistencia,
    // se puede optar por una plantilla mínima o nula.

    if (isMac) {
      // En macOS, el menú de la aplicación (nombre de la app) es obligatorio para una buena UX.
      const template: Electron.MenuItemConstructorOptions[] = [
        {
          label: app.name,
          submenu: [
            { role: 'about', label: 'Acerca de ' + app.name },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide', label: 'Ocultar ' + app.name },
            { role: 'hideOthers', label: 'Ocultar otros' },
            { role: 'unhide', label: 'Mostrar todo' },
            { type: 'separator' },
            { role: 'quit', label: 'Salir' }
          ]
        },
        {
          label: 'Ventana',
          submenu: [
            { role: 'minimize', label: 'Minimizar' },
            { role: 'zoom', label: 'Zoom' },
            { type: 'separator' },
            { role: 'front', label: 'Traer todo al frente' }
          ]
        },
        {
          role: 'help',
          label: 'Ayuda',
          submenu: [
            {
              label: 'Documentación',
              click: async () => {
                const { shell } = await import('electron');
                await shell.openExternal('https://github.com/Pulse-Hub/SofLIA-HUB');
              }
            }
          ]
        }
      ];
      const menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);
    } else {
      // En Windows/Linux, si el usuario solo pidió quitar File, Edit y View,
      // podemos dejar un menú mínimo con Window y Help, o simplemente quitarlo todo (null)
      // para la "limpieza" que solicita. 
      // Dado que dijo "que ya no van a estar aquí", optamos por la limpieza total (null)
      // que es el estándar para aplicaciones modernas de este tipo.
      Menu.setApplicationMenu(null);
      
      console.log('[MenuManager] Menú estándar desactivado para Windows/Linux para máxima limpieza visual.');
    }
  }

  /**
   * Esconde la barra de menú en una ventana específica sin eliminar la lógica global.
   * Útil para ventanas secundarias o si se prefiere auto-hide.
   */
  static hideForWindow(window: Electron.BrowserWindow) {
    if (process.platform !== 'darwin') {
      window.setMenuBarVisibility(false);
      window.setAutoHideMenuBar(true);
    }
  }
}
