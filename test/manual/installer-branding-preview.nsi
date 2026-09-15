; Vista nativa de la bienvenida real: sin instalar archivos, registro ni app.
Unicode true
Name "Pulse Hub - Vista de diseno"
OutFile "${PREVIEW_OUT}"
RequestExecutionLevel user
!include MUI2.nsh
!include LogicLib.nsh
!define VERSION "vista-previa"
!define isUpdated '0 = 1'
!include "${BUILD_RESOURCES_DIR}\installer.nsh"
!insertmacro customWelcomePage
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"
Section
  DetailPrint "Vista de diseño: no se instala la aplicación."
SectionEnd
