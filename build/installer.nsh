; =============================================================================
; SofLIA Hub - Custom NSIS Installer Script (High Premium Theme)
; =============================================================================

; ─── Brand Colors ───
!define MUI_BGCOLOR "12151A"
!define MUI_TEXTCOLOR "FFFFFF"

; ─── Header & Sidebar Image Config ───
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "build\installer\installerHeader.bmp"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_WELCOMEFINISHPAGE_BITMAP "build\installer\installerSidebar.bmp"

; ─── Finish Page Customization ───
!define MUI_FINISHPAGE_TITLE_3LINES
!define MUI_FINISHPAGE_LINK "Visita el portal oficial de SofLIA Hub"
!define MUI_FINISHPAGE_LINK_LOCATION "https://soflia.com"
!define MUI_FINISHPAGE_LINK_COLOR "00D4B3"

; ─── Installation Progress styling ───
!define MUI_INSTFILESPAGE_COLORS "00D4B3 12151A" ; Accent text on dark bg
!define MUI_PROGRESSBAR_COLOR "00D4B3" ; Wait, MUI might not support this directly without plugins, but good to have
