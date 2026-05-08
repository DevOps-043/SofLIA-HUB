export const GET_FOREGROUND_UI_ELEMENTS_SCRIPT = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -Name FgWin -Namespace W -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern IntPtr GetForegroundWindow();'
$hwnd = [W.FgWin]::GetForegroundWindow()
$root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
$elements = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
$result = @()
$id = 1
$interestingTypes = @('Button','Edit','TextBox','Hyperlink','MenuItem','ListItem','TreeItem','TabItem','Document','CheckBox','RadioButton','ComboBox','DataItem')
foreach ($el in $elements) {
  $rect = $el.Current.BoundingRectangle
  $controlType = $el.Current.ControlType.ProgrammaticName -replace 'ControlType\\.', ''
  $hasInteractivePattern = (
    $el.Current.IsInvokePatternAvailable -or
    $el.Current.IsValuePatternAvailable -or
    $el.Current.IsTogglePatternAvailable -or
    $el.Current.IsSelectionItemPatternAvailable -or
    $el.Current.IsExpandCollapsePatternAvailable -or
    $el.Current.IsScrollItemPatternAvailable -or
    $el.Current.IsTextPatternAvailable
  )
  $looksInteractive = $interestingTypes -contains $controlType
  $hasIdentity = -not [string]::IsNullOrWhiteSpace($el.Current.Name) -or -not [string]::IsNullOrWhiteSpace($el.Current.AutomationId)
  if (
    $rect.Width -gt 0 -and
    $rect.Height -gt 0 -and
    $rect.Width -lt 2000 -and
    $rect.Height -lt 2000 -and
    -not $el.Current.IsOffscreen -and
    ($hasInteractivePattern -or $looksInteractive -or $hasIdentity)
  ) {
    $value = ''
    try {
      $vp = $null
      if ($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp) -and $vp) {
        $value = $vp.Current.Value
      }
    } catch {}
    $result += @{
      id = $id
      name = $el.Current.Name
      controlType = $controlType
      x = [int]$rect.X
      y = [int]$rect.Y
      width = [int]$rect.Width
      height = [int]$rect.Height
      isEnabled = $el.Current.IsEnabled
      automationId = $el.Current.AutomationId
      value = $value
    }
    $id++
    if ($id -gt 60) { break }
  }
}
$result | ConvertTo-Json -Compress -Depth 3
`;
