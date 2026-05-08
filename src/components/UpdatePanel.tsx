import { CheckButton } from './update-panel/CheckButton';
import { CurrentVersionCard } from './update-panel/CurrentVersionCard';
import { DevUnavailable } from './update-panel/DevUnavailable';
import { UpdateAvailableCard } from './update-panel/UpdateAvailableCard';
import { UpdateHeader } from './update-panel/UpdateHeader';
import { UpdateInfoFooter } from './update-panel/UpdateInfoFooter';
import { UpdateResultCards } from './update-panel/UpdateResultCards';
import { useUpdatePanel } from './update-panel/useUpdatePanel';

export function UpdatePanel() {
  const update = useUpdatePanel();

  if (typeof window.updater === 'undefined') return <DevUnavailable />;

  return (
    <div className="p-6 space-y-6">
      <UpdateHeader />
      <CurrentVersionCard state={update.state} checking={update.checking} currentVersion={update.currentVersion} />
      <CheckButton checking={update.checking} state={update.state} onCheck={update.handleCheck} />
      <UpdateAvailableCard
        state={update.state}
        availableVersion={update.availableVersion}
        notes={update.notes || undefined}
        progress={update.progress}
        onDownload={update.handleDownload}
        onInstall={update.handleInstall}
      />
      <UpdateResultCards
        state={update.state}
        checking={update.checking}
        currentVersion={update.currentVersion}
        error={update.error}
        status={update.status}
      />
      <UpdateInfoFooter />
    </div>
  );
}
