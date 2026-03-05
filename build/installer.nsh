; =============================================================================
; SofLIA Hub - Custom NSIS Installer Script
; =============================================================================
; This script customizes the look and feel of the NSIS installer
; for SofLIA Hub, providing a modern, branded installation experience.
; =============================================================================

; ─── Modern UI Colors ───
!define MUI_BGCOLOR "0A2540"
!define MUI_TEXTCOLOR "FFFFFF"

; ─── Custom UI Elements ───
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "¿Estás seguro de que deseas cancelar la instalación de SofLIA Hub?"
!define MUI_ABORTWARNING_CANCEL_DEFAULT

; ─── Finish Page Configuration ───
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_RUN_TEXT "Iniciar SofLIA Hub"
!define MUI_FINISHPAGE_LINK "Visita el portal SofLIA"
!define MUI_FINISHPAGE_LINK_LOCATION "https://soflia.ai"

; ─── Uninstaller Finish Page ───
!define MUI_UNFINISHPAGE_NOAUTOCLOSE
