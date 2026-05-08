import { AvailableUpdateCard } from './update-panel/AvailableUpdateCard'
import { CheckUpdatesButton } from './update-panel/CheckUpdatesButton'
import { CurrentVersionCard } from './update-panel/CurrentVersionCard'
import { DevUnavailable } from './update-panel/DevUnavailable'
import { StatusNoticeCards } from './update-panel/StatusNoticeCards'
import { UpdateHeader } from './update-panel/UpdateHeader'
import { useUpdatePanel } from './update-panel/useUpdatePanel'

export function UpdatePanel() {
  const panel = useUpdatePanel()

  if (!panel.isUpdaterAvailable) {
    return <DevUnavailable />
  }

  return (
    <div className="p-6 space-y-6">
      <UpdateHeader />
      <CurrentVersionCard currentVersion={panel.currentVersion} state={panel.state} checking={panel.checking} />
      <CheckUpdatesButton checking={panel.checking} state={panel.state} onCheck={panel.handleCheck} />
      <AvailableUpdateCard
        state={panel.state}
        availableVersion={panel.availableVersion}
        notes={panel.notes}
        progress={panel.progress}
        onDownload={panel.handleDownload}
        onInstall={panel.handleInstall}
      />
      <StatusNoticeCards
        state={panel.state}
        checking={panel.checking}
        currentVersion={panel.currentVersion}
        error={panel.error}
        statusError={panel.status?.error}
      />
      <div className="pt-4 border-t border-white/5">
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Las actualizaciones se verifican automÃ¡ticamente cada 4 horas. TambiÃ©n puedes verificar manualmente usando el botÃ³n de arriba.
        </p>
      </div>
    </div>
  )
}
