; Pulse Hub: arte propio, texto nativo y flujo de actualización de electron-builder.
!include nsDialogs.nsh
; electron-builder omite estos símbolos al declarar customCheckAppRunning.
!include "getProcessInfo.nsh"
Var pid
!define MUI_BGCOLOR "F4FAF9"
!define MUI_TEXTCOLOR "0A2540"
!define MUI_ABORTWARNING
!define MUI_INSTFILESPAGE_HEADER_TEXT "Tu espacio está tomando forma"
!define MUI_INSTFILESPAGE_HEADER_SUBTEXT "Instalando Pulse Hub y su motor Python privado."
!define MUI_INSTFILESPAGE_COLORS "0A2540 F4FAF9"
!define MUI_DIRECTORYPAGE_TEXT_TOP "Elige dónde guardar Pulse Hub. Python queda dentro de la aplicación: no cambia el Python ni el PATH de tu equipo."
!define MUI_FINISHPAGE_TITLE "Tu próximo paso empieza aquí."
!define MUI_FINISHPAGE_TEXT "Pulse Hub se instaló con su motor Python privado.$\r$\n$\r$\nAl abrirlo podrás iniciar sesión y conectar tus herramientas. Los modelos de voz se descargan cuando los necesites; algunas funciones requieren conexión."
!define MUI_FINISHPAGE_RUN_TEXT "Abrir Pulse Hub ahora"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_UNWELCOMEPAGE_TITLE "Hasta la próxima."
!define MUI_UNWELCOMEPAGE_TEXT "Se retirará Pulse Hub y su motor Python privado.$\r$\n$\r$\nTus datos de usuario se conservan. El Python del sistema no se modifica."

!macro customHeader
  BrandingText "Pulse Hub  ${VERSION}"
  ShowInstDetails hide
!macroend

; La entrada visual no autoriza cerrar procesos. El actualizador conserva su flujo.
!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/pulseShell" $R1
  ${IfNot} ${Errors}
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 == 0
      SetErrorLevel 73
      Quit
    ${EndIf}
  ${Else}
    !insertmacro _CHECK_APP_RUNNING
  ${EndIf}
!macroend

!macro customWelcomePage
  !insertmacro MUI_PAGE_INIT
  !insertmacro MUI_PAGE_FUNCTION_FULLWINDOW
  Var PulseWelcome
  Var PulseArtwork
  Var PulseArtworkHandle
  Var PulseTitleFont
  Var PulseBrandFont
  Page custom PulseWelcomeShow

  Function PulseWelcomeShow
    ; Las actualizaciones silenciosas conservan el recorrido del actualizador.
    ${If} ${isUpdated}
      Abort
    ${EndIf}
    InitPluginsDir
    File "/oname=$PLUGINSDIR\pulse-welcome.bmp" "${BUILD_RESOURCES_DIR}\installer\welcome-scene.bmp"
    nsDialogs::Create 1044
    Pop $PulseWelcome
    ${If} $PulseWelcome == error
      Abort
    ${EndIf}
    SetCtlColors $PulseWelcome "0A2540" "F4FAF9"
    ${NSD_CreateBitmap} 205u 0u 121u 193u ""
    Pop $PulseArtwork
    ${NSD_SetStretchedImage} $PulseArtwork "$PLUGINSDIR\pulse-welcome.bmp" $PulseArtworkHandle

    CreateFont $PulseTitleFont "Segoe UI" 21 600
    CreateFont $PulseBrandFont "Segoe UI" 10 600
    ${NSD_CreateLabel} 20u 15u 180u 14u "PULSE HUB  /  SOFLIA"
    Pop $0
    SendMessage $0 ${WM_SETFONT} $PulseBrandFont 0
    SetCtlColors $0 "0A2540" "F4FAF9"
    ${NSD_CreateLabel} 20u 42u 180u 62u "Menos fricción.$\r$\nMás posibilidades."
    Pop $0
    SendMessage $0 ${WM_SETFONT} $PulseTitleFont 0
    SetCtlColors $0 "0A2540" "F4FAF9"
    ${NSD_CreateLabel} 20u 112u 177u 30u "Tu navegador, tu asistente y tus herramientas. Un mismo espacio para trabajar."
    Pop $0
    SetCtlColors $0 "0A2540" "F4FAF9"
    ${NSD_CreateLabel} 20u 153u 180u 30u "Python privado incluido.$\r$\nSin modificar el Python de tu equipo."
    Pop $0
    SetCtlColors $0 "0A2540" "F4FAF9"
    Call muiPageLoadFullWindow
    GetDlgItem $0 $HWNDPARENT 1
    SendMessage $0 ${WM_SETTEXT} 0 "STR:&Continuar"
    nsDialogs::Show
    Call muiPageUnloadFullWindow
    ${NSD_FreeImage} $PulseArtworkHandle
    System::Call 'gdi32::DeleteObject(p $PulseTitleFont)'
    System::Call 'gdi32::DeleteObject(p $PulseBrandFont)'
  FunctionEnd
!macroend
