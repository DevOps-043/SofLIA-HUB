import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { UserAISettings } from "../services/settings-service";
import type { SofiaContext } from "../services/sofia-auth";
import { APP_VERSION } from "../shared/app-version";
import { SettingsContent } from "./unified-settings/SettingsContent";
import { HubGlyph } from "./ui/HubGlyph";
import {
  getSettingsCategoryGroups,
  resolveMasterTab,
  type SettingsTab,
} from "./unified-settings/settings-tabs";
import "./unified-settings/settings.css";

interface UnifiedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userSettings: UserAISettings | null;
  onSaveSettings: (settings: UserAISettings) => void;
  sofiaContext: SofiaContext | null;
  apiKey: string;
  initialTab?: SettingsTab;
}
export type { SettingsTab } from "./unified-settings/settings-tabs";

export const UnifiedSettingsModal = (props: UnifiedSettingsModalProps) =>
  props.isOpen ? (
    <SettingsDialog
      key={resolveMasterTab(props.initialTab ?? "identity")}
      {...props}
    />
  ) : null;

const SettingsDialog = ({
  isOpen,
  onClose,
  userId,
  onSaveSettings,
  sofiaContext,
  apiKey,
  initialTab = "identity",
}: UnifiedSettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    resolveMasterTab(initialTab),
  );
  const [currentVersion, setCurrentVersion] = useState(APP_VERSION);
  const dialog = useRef<HTMLDivElement>(null);
  const closeHandler = useRef(onClose);
  useLayoutEffect(() => { closeHandler.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    let canceled = false;
    void window.updater
      ?.getStatus()
      .then((status) => {
        if (!canceled && status?.currentVersion)
          setCurrentVersion(status.currentVersion);
      })
      .catch(() => {
        /* La versión de compilación sigue disponible sin el servicio. */
      });
    return () => {
      canceled = true;
    };
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHandler.current();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((node) => node.getClientRects().length > 0);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.current?.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes de SofLIA Hub"
        className="settings-workspace"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="settings-close"
          aria-label="Cerrar Ajustes"
          title="Cerrar ajustes · Esc"
        >
          <HubGlyph name="close" size={18} />
        </button>
        <aside className="settings-sidebar">
          <div className="settings-brand">
            <span className="settings-brand-icon">
              <HubGlyph name="settings" size={23} />
            </span>
            <div>
              <strong>Ajustes</strong>
              <span>Tu espacio de SofLIA</span>
            </div>
          </div>
          <nav
            className="settings-navigation"
            aria-label="Secciones de ajustes"
          >
            {getSettingsCategoryGroups(sofiaContext).map((group) => (
              <div className="settings-nav-group" key={group.title}>
                <span className="settings-eyebrow">{group.title}</span>
                {group.tabs
                  .filter((tab) => !tab.hidden)
                  .map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      aria-current={activeTab === tab.id ? "page" : undefined}
                      title={tab.description}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                      {activeTab === tab.id && (
                        <span className="settings-nav-indicator" />
                      )}
                    </button>
                  ))}
              </div>
            ))}
          </nav>
          <footer className="settings-sidebar-footer">
            <span>SofLIA Hub</span>
            <span className="settings-version">v{currentVersion}</span>
          </footer>
        </aside>
        <div className="settings-main">
          <SettingsContent
            activeTab={activeTab}
            onClose={onClose}
            userId={userId}
            onSaveSettings={onSaveSettings}
            sofiaContext={sofiaContext}
            apiKey={apiKey}
          />
        </div>
      </div>
    </div>
  );
};
