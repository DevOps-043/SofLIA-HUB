# Estandar Electron e IPC

## Contrato de cuatro capas

Todo feature accesible desde renderer debe mantener:

1. Servicio de negocio en el proceso main.
2. Registro `ipcMain.handle()` con validacion y respuesta consistente.
3. Canal incluido en `electron/preload/channel-group-*.ts` y exposicion segura.
4. Wrapper tipado en `src/services/` o en el feature renderer correspondiente.

Formato de respuesta:

```ts
{ success: boolean, error?: string, ...data }
```

## Reglas

- Nombrar canales `namespace:action`.
- Validar payload antes de invocar servicios.
- No exponer `ipcRenderer` directamente al renderer.
- No omitir CSP ni `contextIsolation`.
- Agregar pruebas del handler, allowlist y wrapper cuando cambie un contrato.
- Mantener los entrypoints `electron/main.ts` y `electron/preload.ts` pequenos.
- Importar implementaciones nuevas desde la API publica del feature, no desde
  archivos internos.

## Checklist de cambio IPC

- [ ] Servicio o caso de uso
- [ ] Handler con manejo de error
- [ ] Canal allowlisted
- [ ] API preload
- [ ] Tipo global de renderer
- [ ] Wrapper renderer
- [ ] Pruebas main y renderer
- [ ] Documentacion del contrato
